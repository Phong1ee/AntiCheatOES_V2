/* Classic-worker proof for MediaPipe Tasks 1.0.1 when module-worker loading stalls. */
importScripts("/wasm/mediapipe/vision_bundle.js");

const timeout = (promise) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("VISION_CLASSIC_INITIALIZATION_TIMEOUT")), 15000))]);
const modelFor = (test) => ({ "face-detector": "/models/anti-cheat/blaze_face_short_range.tflite", "face-landmarker": "/models/anti-cheat/face_landmarker.task", "pose-landmarker": "/models/anti-cheat/pose_landmarker_lite.task", "object-detector": "/models/anti-cheat/efficientdet_lite0.tflite" })[test];

self.onmessage = async ({ data }) => {
  const startedAt = new Date().toISOString(); const started = performance.now(); const modelPath = modelFor(data.test);
  try {
    const files = await timeout(Vision.FilesetResolver.forVisionTasks("/wasm/mediapipe", true));
    const modelByteLength = (await (await fetch(modelPath, { cache: "no-store" })).arrayBuffer()).byteLength;
    let task;
    if (data.test === "face-detector") task = await timeout(Vision.FaceDetector.createFromOptions(files, { baseOptions: { modelAssetPath: modelPath }, runningMode: "VIDEO" }));
    if (data.test === "face-landmarker") task = await timeout(Vision.FaceLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: modelPath }, runningMode: "VIDEO" }));
    if (data.test === "pose-landmarker") task = await timeout(Vision.PoseLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: modelPath }, runningMode: "VIDEO" }));
    if (data.test === "object-detector") task = await timeout(Vision.ObjectDetector.createFromOptions(files, { baseOptions: { modelAssetPath: modelPath }, runningMode: "VIDEO" }));
    task.close(); self.postMessage({ type: "result", test: data.test, startedAt, durationMs: performance.now() - started, wasmPath: "/wasm/mediapipe/vision_bundle.js", modelPath, modelByteLength, result: "PASS", runtime: "classic worker proof" });
  } catch (error) { self.postMessage({ type: "result", test: data.test, startedAt, result: "FAIL", sanitizedErrorCode: "VISION_CLASSIC_INITIALIZATION_FAILED", rawError: error instanceof Error ? error.message : String(error), runtime: "classic worker proof" }); }
};
