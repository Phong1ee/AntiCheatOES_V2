# Anti-Cheat Model Manifest

All production model and MediaPipe runtime URLs are local project assets. These
files are processed transiently in the browser; no image, audio, frame, or
model output is an evidence artifact.

## Runtime

- Packages: `@mediapipe/tasks-vision@1.0.1` and `@mediapipe/tasks-audio@1.0.1`
- Local runtime root: `/wasm/mediapipe/`
- Source: the Apache-2.0 MediaPipe npm packages listed above.
- Runtime asset size: 55,800,394 bytes (53.22 MiB). The copied files are the
  package-provided SIMD, non-SIMD, and module WASM/loader variants.
- Development classic-worker proof bundle: `vision_bundle.js`, copied from
  `@mediapipe/tasks-vision@1.0.1`, SHA-256
  `98db72469ffb176f5e9f2687be0f70783893aca681f7789c34b872b0a764371a`,
  155,465 bytes. It is used only by the isolated diagnostics route after a
  module-worker test stalls; production proctoring continues to use workers.

## Models

| Detector | Local file | Official source and version | SHA-256 | Size | License / terms | Verified labels or landmarks |
| --- | --- | --- | --- | ---: | --- | --- |
| Face detection | `blaze_face_short_range.tflite` | [MediaPipe BlazeFace Short Range, float16 v1](https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite) | `b4578f35940bf5a1a655214a1cce5cab13eba73c1297cd78e1a04c2380b0152f` | 229,746 bytes | [MediaPipe model terms](https://developers.google.com/mediapipe/solutions/vision/face_detector#models) | Face bounding box and detection confidence |
| Face landmark and detection | `face_landmarker.task` | [MediaPipe Face Landmarker, float16 v1](https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task) | `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff` | 3,758,596 bytes | [MediaPipe model terms](https://developers.google.com/mediapipe/solutions/vision/face_landmarker#models) | 478 facial landmarks and face-presence confidence |
| Pose landmarks | `pose_landmarker_lite.task` | [MediaPipe Pose Landmarker Lite, float16 v1](https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task) | `59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a` | 5,777,746 bytes | [MediaPipe model terms](https://developers.google.com/mediapipe/solutions/vision/pose_landmarker#models) | 33 pose landmarks, including left and right shoulders |
| Phone object detection | `efficientdet_lite0.tflite` | [MediaPipe EfficientDet Lite0, float32 v1](https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float32/1/efficientdet_lite0.tflite) | `40338edf5ec70d43e318b0a716a84d4564cd1802759a7a07170c7e43796dbf58` | 13,836,895 bytes | [MediaPipe model terms](https://developers.google.com/mediapipe/solutions/vision/object_detector#models) | COCO label map includes the exact category `cell phone` |
| Speech audio classification | `yamnet.tflite` | [MediaPipe YAMNet, float32 v1](https://storage.googleapis.com/mediapipe-models/audio_classifier/yamnet/float32/1/yamnet.tflite) | `4d8b4a53282dc83ef04e3e7dbc4fbc98082e34e44ed798e16c3a0cdd4c584faf` | 4,126,810 bytes | [MediaPipe audio classification model terms](https://developers.google.com/mediapipe/solutions/audio/audio_classifier#models) | AudioSet label map includes the exact category `Speech` |

Model asset size: 27,729,793 bytes (26.45 MiB). Runtime plus models: 83,530,187
bytes (78.00 MiB).

## Limitations

- Face and pose outputs depend on lighting, camera angle, occlusion, and the
  subject being in frame. They do not identify a student or prove attention.
- EfficientDet Lite0 can miss small, distant, occluded, or unusual phones.
  A `cell phone` detection is an observed object category, not proof of use.
- YAMNet recognizes audio classes only. Its `Speech` category cannot identify,
  count, or authenticate speakers, and background sound can affect confidence.
- A detector load failure must be reported as unavailable. It must not produce
  a pass result, fabricated detection, or synthetic proctoring event.
