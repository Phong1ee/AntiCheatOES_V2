export type ProctoringDetectorId = "faceDetector" | "face" | "pose" | "phone" | "speech";

export interface ProctoringModelDefinition {
  detector: ProctoringDetectorId;
  task: "FaceDetector" | "FaceLandmarker" | "PoseLandmarker" | "ObjectDetector" | "AudioClassifier";
  modelPath: string;
  version: string;
  sha256: string;
  labelsOrLandmarks: readonly string[];
  status: "available" | "blocked";
  limitations: string;
}

export const MEDIAPIPE_WASM_ROOT = "/wasm/mediapipe";

// These assets are versioned in public/ so production never resolves models or WASM from a CDN.
export const PROCTORING_MODELS = {
  faceDetector: {
    detector: "faceDetector",
    task: "FaceDetector",
    modelPath: "/models/anti-cheat/blaze_face_short_range.tflite",
    version: "1",
    sha256: "b4578f35940bf5a1a655214a1cce5cab13eba73c1297cd78e1a04c2380b0152f",
    labelsOrLandmarks: ["face bounding box", "detection confidence"],
    status: "available",
    limitations: "Short-range webcam detector only; lighting, occlusion, and profile views can reduce confidence.",
  },
  face: {
    detector: "face",
    task: "FaceLandmarker",
    modelPath: "/models/anti-cheat/face_landmarker.task",
    version: "1",
    sha256: "64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff",
    labelsOrLandmarks: ["478 facial landmarks", "face presence confidence"],
    status: "available",
    limitations: "Does not identify a person, prove attention, or establish cheating.",
  },
  pose: {
    detector: "pose",
    task: "PoseLandmarker",
    modelPath: "/models/anti-cheat/pose_landmarker_lite.task",
    version: "1",
    sha256: "59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a",
    labelsOrLandmarks: ["33 pose landmarks", "left shoulder", "right shoulder"],
    status: "available",
    limitations: "Lite pose quality depends on framing, lighting, and occlusion; it cannot infer intent.",
  },
  phone: {
    detector: "phone",
    task: "ObjectDetector",
    modelPath: "/models/anti-cheat/efficientdet_lite0.tflite",
    version: "1",
    sha256: "40338edf5ec70d43e318b0a716a84d4564cd1802759a7a07170c7e43796dbf58",
    labelsOrLandmarks: ["COCO cell phone"],
    status: "available",
    limitations: "Small, distant, occluded, or unusual phones may be missed; detections are not proof of use.",
  },
  speech: {
    detector: "speech",
    task: "AudioClassifier",
    modelPath: "/models/anti-cheat/yamnet.tflite",
    version: "1",
    sha256: "4d8b4a53282dc83ef04e3e7dbc4fbc98082e34e44ed798e16c3a0cdd4c584faf",
    labelsOrLandmarks: ["AudioSet Speech"],
    status: "available",
    limitations: "Classifies acoustic content only; it cannot identify, count, or verify speakers.",
  },
} as const satisfies Record<ProctoringDetectorId, ProctoringModelDefinition>;

export interface ProctoringRuntimeAsset {
  id: string;
  kind: "model" | "wasm-loader" | "wasm-binary";
  url: string;
  expectedSha256: string;
}

const wasmAsset = (filename: string, kind: "wasm-loader" | "wasm-binary", expectedSha256: string): ProctoringRuntimeAsset => ({
  id: filename,
  kind,
  url: `${MEDIAPIPE_WASM_ROOT}/${filename}`,
  expectedSha256,
});

// Expected hashes make the development runtime check detect stale, rewritten,
// or HTML-fallback assets before MediaPipe reports a generic initialization error.
export const PROCTORING_RUNTIME_ASSETS: readonly ProctoringRuntimeAsset[] = [
  ...Object.values(PROCTORING_MODELS).map((model) => ({ id: model.modelPath.split("/").at(-1) ?? model.detector, kind: "model" as const, url: model.modelPath, expectedSha256: model.sha256 })),
  wasmAsset("vision_wasm_internal.js", "wasm-loader", "e170ee67dd4e16c1a6fcd8840a206687e5a59b22c20e4a902bc445b095454d73"),
  wasmAsset("vision_wasm_internal.wasm", "wasm-binary", "8da277a733926eacd0474b8704b36742d6ec3231c57a860c5b889dff8f1df886"),
  wasmAsset("vision_wasm_module_internal.js", "wasm-loader", "da8934057f147b622e82cfb4c0dbd85461c598e268588b5a8ba9ca963a8ff82d"),
  wasmAsset("vision_wasm_module_internal.wasm", "wasm-binary", "2dabd8e23c60984628beb7bb338764c81a08e6837145273f59578684b5d53c1b"),
  wasmAsset("vision_wasm_nosimd_internal.js", "wasm-loader", "e81d715a3d42cc3373602eb2f7aff795d164934db680e32496b65dab537f9658"),
  wasmAsset("vision_wasm_nosimd_internal.wasm", "wasm-binary", "a28483cd42e74e855bf5ebdb6b40d9b66a5b49e35e95020bc97669e6822a3192"),
  wasmAsset("audio_wasm_internal.js", "wasm-loader", "958b3190bd16bc6836b5df1705ab9328fe9d4ac9855793895ef146d5e18c1d2c"),
  wasmAsset("audio_wasm_internal.wasm", "wasm-binary", "247f14f99a8cd03015e90013e6badc7ce9b4143267d5f1810f2aa05021902c1b"),
  wasmAsset("audio_wasm_module_internal.js", "wasm-loader", "8a18c5e623c08e6f4d9ffbc4b1993e6e127c560ee2707bc9a6a05359d25897f2"),
  wasmAsset("audio_wasm_module_internal.wasm", "wasm-binary", "03d3c9cb94c6984a525a59d2aa8ac514beb5775d5e9647278cb9966d45dced96"),
  wasmAsset("audio_wasm_nosimd_internal.js", "wasm-loader", "6c59f5274895af2f65f64a50e2038b19c8d77144479363d57035df89f97bf6b7"),
  wasmAsset("audio_wasm_nosimd_internal.wasm", "wasm-binary", "28fd8be948fcda801ba870bc4b1bbae6602c27c06df53a14f51c5f8f62e0cce9"),
];
