use serde::Serialize;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Mutex,
};
use std::time::Duration;
use tauri::{ipc::Channel, AppHandle, State};
use tauri_plugin_updater::{Update, UpdaterExt};

#[derive(Default)]
pub struct UpdateState {
    pending: Mutex<Option<Update>>,
    busy: AtomicBool,
    ready: AtomicBool,
    #[cfg(windows)]
    portable_path: Mutex<Option<std::path::PathBuf>>,
}

// One operation at a time; the guard also releases on network/install failure.
struct Operation<'a>(&'a AtomicBool);
impl Drop for Operation<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::Release);
    }
}
impl UpdateState {
    fn begin(&self) -> Result<Operation<'_>, String> {
        self.busy
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .map_err(|_| "busy".to_string())?;
        if self.ready.load(Ordering::Acquire) {
            self.busy.store(false, Ordering::Release);
            return Err("restart_required".into());
        }
        Ok(Operation(&self.busy))
    }
}

#[derive(Serialize)]
pub struct UpdateInfo {
    version: String,
    notes: String,
}

#[derive(Clone, Serialize)]
#[serde(tag = "event", rename_all = "camelCase")]
pub enum Progress {
    Download { downloaded: u64, total: Option<u64> },
    Installing,
}

#[cfg(windows)]
fn portable_executable() -> Option<std::path::PathBuf> {
    let executable = std::env::current_exe().ok()?;
    let marker = executable.parent()?.join("anatolume-portable.json");
    let value: serde_json::Value = serde_json::from_slice(&std::fs::read(marker).ok()?).ok()?;
    (value.get("edition")?.as_str()? == "portable").then_some(executable)
}

#[tauri::command]
pub async fn check_update(
    app: AppHandle,
    state: State<'_, UpdateState>,
) -> Result<Option<UpdateInfo>, String> {
    let _operation = state.begin()?;
    let mut builder = app.updater_builder().timeout(Duration::from_secs(20));
    #[cfg(windows)]
    if let Some(executable) = portable_executable() {
        builder = builder.target("windows-x86_64-portable");
        *state.portable_path.lock().map_err(|_| "state_failed")? = Some(executable);
    }
    #[cfg(target_os = "macos")]
    {
        builder = builder.target(format!("darwin-{}", std::env::consts::ARCH));
    }
    let update = builder
        .build()
        .map_err(|_| "check_failed")?
        .check()
        .await
        .map_err(|_| "check_failed")?;
    // Downloading the complete offline model can take several minutes.
    let update = update.map(|mut update| {
        update.timeout = Some(Duration::from_secs(900));
        update
    });
    let info = update.as_ref().map(|update| UpdateInfo {
        version: update.version.clone(),
        notes: update.body.clone().unwrap_or_default(),
    });
    *state.pending.lock().map_err(|_| "state_failed")? = update;
    Ok(info)
}

#[tauri::command]
pub async fn install_update(
    state: State<'_, UpdateState>,
    progress: Channel<Progress>,
) -> Result<(), String> {
    let _operation = state.begin()?;
    let update = state
        .pending
        .lock()
        .map_err(|_| "state_failed")?
        .clone()
        .ok_or("no_update")?;
    let mut downloaded = 0u64;
    // Tauri verifies the signature AND its bound version before returning bytes.
    let bytes = update
        .download(
            |length, total| {
                downloaded += length as u64;
                let _ = progress.send(Progress::Download { downloaded, total });
            },
            || {},
        )
        .await
        .map_err(|_| "download_failed")?;
    let _ = progress.send(Progress::Installing);
    #[cfg(windows)]
    if state
        .portable_path
        .lock()
        .map_err(|_| "state_failed")?
        .is_some()
    {
        let version = update.version.clone();
        tauri::async_runtime::spawn_blocking(move || install_portable(&bytes, &version))
            .await
            .map_err(|_| "install_failed")?
            .map_err(|_| "install_failed")?;
        state.ready.store(true, Ordering::Release);
        return Ok(());
    }
    tauri::async_runtime::spawn_blocking(move || update.install(bytes))
        .await
        .map_err(|_| "install_failed")?
        .map_err(|_| "install_failed")?;
    state.ready.store(true, Ordering::Release);
    Ok(())
}

#[tauri::command]
pub fn restart_updated_app(app: AppHandle, state: State<'_, UpdateState>) -> Result<(), String> {
    if !state.ready.load(Ordering::Acquire) {
        return Err("not_ready".into());
    }
    #[cfg(windows)]
    if let Some(executable) = state
        .portable_path
        .lock()
        .map_err(|_| "state_failed")?
        .as_ref()
    {
        // Keep the original portable path across replacement and restart.
        std::process::Command::new(executable)
            .spawn()
            .map_err(|_| "restart_failed")?;
        app.exit(0);
        return Ok(());
    }
    app.restart();
}

#[cfg(windows)]
fn portable_binary(
    bytes: &[u8],
    version: &str,
) -> Result<Vec<u8>, Box<dyn std::error::Error + Send + Sync>> {
    use std::io::{Cursor, Read};
    let mut archive = zip::ZipArchive::new(Cursor::new(bytes))?;
    let expected = [
        "Anatolume.exe",
        "README.txt",
        "ATTRIBUTION.md",
        "LICENSE",
        "anatolume-portable.json",
    ];
    if archive.len() != expected.len() {
        return Err("Unexpected portable archive".into());
    }
    let mut seen = std::collections::HashSet::new();
    let mut binary = None;
    for index in 0..archive.len() {
        let mut entry = archive.by_index(index)?;
        if !expected.contains(&entry.name())
            || !seen.insert(entry.name().to_string())
            || entry.is_symlink()
        {
            return Err("Unexpected archive entry".into());
        }
        if entry.size() > 512 * 1024 * 1024 {
            return Err("Archive entry too large".into());
        }
        let name = entry.name().to_string();
        let mut contents = Vec::new();
        entry
            .by_ref()
            .take(512 * 1024 * 1024 + 1)
            .read_to_end(&mut contents)?;
        if contents.len() > 512 * 1024 * 1024 {
            return Err("Archive entry too large".into());
        }
        if name == "Anatolume.exe" {
            if !contents.starts_with(b"MZ") {
                return Err("Invalid Windows executable".into());
            }
            binary = Some(contents);
        } else if name == "anatolume-portable.json" {
            let marker: serde_json::Value = serde_json::from_slice(&contents)?;
            if marker["edition"] != "portable" || marker["version"] != version {
                return Err("Portable version mismatch".into());
            }
        }
    }
    binary.ok_or_else(|| "Portable executable missing".into())
}

#[cfg(windows)]
fn install_portable(
    bytes: &[u8],
    version: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    use std::io::Write;
    let binary = portable_binary(bytes, version)?;
    let mut staged = tempfile::NamedTempFile::new()?;
    staged.write_all(&binary)?;
    staged.flush()?;
    // Replace only the executable. Keep local settings and the original license/credits.
    self_replace::self_replace(staged.path())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn operation_lock_recovers_and_blocks_after_install() {
        let state = UpdateState::default();
        let operation = state.begin().unwrap();
        assert!(state.begin().is_err());
        drop(operation);
        assert!(state.begin().is_ok());
        state.ready.store(true, Ordering::Release);
        assert!(state.begin().is_err());
        assert!(!state.busy.load(Ordering::Acquire));
    }

    #[cfg(windows)]
    #[test]
    fn portable_archive_rejects_traversal_unknown_files_and_wrong_version() {
        use std::io::{Cursor, Write};
        fn package(extra: Option<&str>, version: &str) -> Vec<u8> {
            let mut writer = zip::ZipWriter::new(Cursor::new(Vec::new()));
            let mut entries = vec![
                "Anatolume.exe",
                "README.txt",
                "ATTRIBUTION.md",
                "LICENSE",
                "anatolume-portable.json",
            ];
            if let Some(extra) = extra {
                entries[1] = extra;
            }
            for name in entries {
                writer
                    .start_file(name, zip::write::SimpleFileOptions::default())
                    .unwrap();
                writer
                    .write_all(if name == "Anatolume.exe" {
                        b"MZfixture"
                    } else if name == "anatolume-portable.json" {
                        b"{\"edition\":\"portable\",\"version\":\"1.2.3\"}"
                    } else {
                        b"license"
                    })
                    .unwrap();
            }
            let bytes = writer.finish().unwrap().into_inner();
            assert!(
                portable_binary(&bytes, version).is_err()
                    == (extra.is_some() || version != "1.2.3")
            );
            bytes
        }
        assert_eq!(
            portable_binary(&package(None, "1.2.3"), "1.2.3").unwrap(),
            b"MZfixture"
        );
        package(Some("../Anatolume.exe"), "1.2.3");
        // ZipWriter itself rejects duplicate names, so replace a harmless file with an unknown path.
        package(Some("other.exe"), "1.2.3");
        package(None, "1.2.4");
        assert!(portable_binary(b"invalid zip", "1.2.3").is_err());
    }

    #[cfg(windows)]
    #[test]
    fn portable_replacement_restarts_from_original_path() {
        const NAME: &str = "updater::tests::portable_replacement_restarts_from_original_path";
        if std::env::var_os("ANATOLUME_REPLACED_TEST").is_some() {
            assert!(std::fs::read(std::env::current_exe().unwrap())
                .unwrap()
                .ends_with(b"ANATOLUME_PORTABLE_UPDATE_FIXTURE"));
            println!("Replacement started at the original portable path");
            return;
        }
        if let Some(source) = std::env::var_os("ANATOLUME_REPLACE_TEST") {
            let original = std::env::current_exe().unwrap();
            self_replace::self_replace(&source).unwrap();
            let output = std::process::Command::new(&original)
                .args(["--exact", NAME, "--nocapture"])
                .env_remove("ANATOLUME_REPLACE_TEST")
                .env("ANATOLUME_REPLACED_TEST", "1")
                .output()
                .unwrap();
            assert!(output.status.success());
            assert!(String::from_utf8_lossy(&output.stdout)
                .contains("Replacement started at the original portable path"));
            return;
        }
        // Run a disposable copy of the test binary; never replace an installed application.
        let directory = tempfile::tempdir().unwrap();
        let original = directory.path().join("Anatolume.exe");
        let replacement = directory.path().join("replacement.exe");
        let executable = std::env::current_exe().unwrap();
        std::fs::copy(&executable, &original).unwrap();
        std::fs::copy(&executable, &replacement).unwrap();
        use std::io::Write;
        std::fs::OpenOptions::new()
            .append(true)
            .open(&replacement)
            .unwrap()
            .write_all(b"ANATOLUME_PORTABLE_UPDATE_FIXTURE")
            .unwrap();
        let output = std::process::Command::new(&original)
            .args(["--exact", NAME, "--nocapture"])
            .env("ANATOLUME_REPLACE_TEST", &replacement)
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
        assert!(original.is_file());
        assert_eq!(
            std::fs::read(&original).unwrap(),
            std::fs::read(&replacement).unwrap()
        );
        // self-replace's helper waits for process exit before deleting the old locked image.
        let deadline = std::time::Instant::now() + Duration::from_secs(5);
        while std::fs::read_dir(directory.path()).unwrap().count() > 2
            && std::time::Instant::now() < deadline
        {
            std::thread::sleep(Duration::from_millis(50));
        }
    }
}
