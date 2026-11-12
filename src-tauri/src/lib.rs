mod updater;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(updater::UpdateState::default())
        .invoke_handler(tauri::generate_handler![
            updater::check_update,
            updater::install_update,
            updater::restart_updated_app
        ])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                if let Some(monitor) = window.current_monitor()? {
                    let area = monitor.work_area();
                    let scale = monitor.scale_factor();
                    let width = (area.size.width as f64 / scale).min(1280.0);
                    let height = (area.size.height as f64 / scale).min(800.0);
                    window.set_min_size(Some(tauri::LogicalSize::new(
                        width.min(960.0),
                        height.min(640.0),
                    )))?;
                    window.set_size(tauri::LogicalSize::new(width, height))?;
                    window.center()?;
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Could not start Anatolume");
}
use tauri::Manager;
