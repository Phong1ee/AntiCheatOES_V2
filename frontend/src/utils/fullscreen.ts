/**
 * Some Chromium forks (observed in Vivaldi) resolve requestFullscreen()
 * without ever actually entering fullscreen. Trusting the promise alone lets
 * the exam start, only for the anti-cheat monitor to flag it as a fullscreen
 * exit and burn a violation. Verify the resulting state so failures surface
 * immediately, before the attempt starts, instead of mid-exam.
 */
export async function requestFullscreenOrThrow(): Promise<void> {
  await document.documentElement.requestFullscreen();
  if (!document.fullscreenElement) {
    throw new Error(
      "Your browser did not enter fullscreen mode. Try a different browser (e.g. Chrome or Edge), or check its fullscreen settings, then try again.",
    );
  }
}
