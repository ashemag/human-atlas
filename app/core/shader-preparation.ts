// Prewarming is optional: a slow or lost graphics context must never block loading.
export async function prepareShaders(
  supported: boolean,
  compile: () => Promise<unknown>,
  signal: AbortSignal,
  timeoutMs = 1500,
): Promise<void> {
  if (!supported || signal.aborted) return;

  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  try {
    const cancelled = new Promise<void>((resolve) => {
      onAbort = resolve;
      signal.addEventListener("abort", onAbort, { once: true });
      timer = setTimeout(resolve, timeoutMs);
    });
    await Promise.race([Promise.resolve().then(() => signal.aborted ? undefined : compile()), cancelled]);
  } catch {
    // Normal rendering can compile the materials on demand.
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    if (onAbort) signal.removeEventListener("abort", onAbort);
  }
}
