export type ProctoringCapability = {
  hardwareConcurrency: number | null;
  audioWorkletSupported: boolean;
  workerSupported: boolean;
  cameraWidth: number | null;
  cameraHeight: number | null;
  cameraFrameRate: number | null;
  profile: "standard" | "low_power";
};

export function assessProctoringCapability(stream?: MediaStream, audioContext?: AudioContext): ProctoringCapability {
  const settings = stream?.getVideoTracks()[0]?.getSettings();
  const cores = typeof navigator.hardwareConcurrency === "number" ? navigator.hardwareConcurrency : null;
  return {
    hardwareConcurrency: cores,
    audioWorkletSupported: Boolean(audioContext?.audioWorklet),
    workerSupported: typeof Worker !== "undefined",
    cameraWidth: settings?.width ?? null,
    cameraHeight: settings?.height ?? null,
    cameraFrameRate: settings?.frameRate ?? null,
    profile: cores !== null && cores <= 2 ? "low_power" : "standard",
  };
}
