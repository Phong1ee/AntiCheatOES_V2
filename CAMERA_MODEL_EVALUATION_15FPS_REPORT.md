# Camera Model Evaluation Report - 15 FPS

## 1. Executive conclusion

**YuNet is selected as the recommended face-count detector for the AntiCheatOES_V2 camera anti-cheat flow.**

The decision is based on the paired, same-frame accuracy test, which is the fairest comparison because all four models receive the same sampled frames. YuNet achieved the highest overall accuracy (96.08%) and the highest `ONE_FACE` accuracy (94.97%). Its isolated P95 inference time was 40.11 ms, below the 66.67 ms budget of a 15 FPS sampling configuration.

Face Landmarker remains a credible fallback: it is faster (23.53 ms isolated P95) but is 3.74 percentage points behind YuNet in the paired accuracy result. BlazeFace Short is the latency-oriented alternative, while SCRFD-10GF is excluded from deployment at 15 FPS because it only achieved 1.63 effective FPS when measured in isolation.

## 2. Evaluation objective

The evaluation compares four browser-side detectors for the three anti-cheat camera states used by the project:

| State | Expected interpretation in the exam flow |
| --- | --- |
| `NO_FACE` | Candidate absent from camera view; an absence-related signal can be considered. |
| `ONE_FACE` | Normal candidate-present state; this must not create a false anti-cheat warning. |
| `MULTIPLE_FACES` | More than one face visible; a second-person signal can be considered. |

The selected model must preserve the normal `ONE_FACE` state, recognize absence and multiple-face states, and remain practical with a camera sampling target of 15 FPS.

## 3. Test artifact and protocol

### Source artifact

- Archive: `D:\DATN\result_15fps_scenario.zip`
- SHA-256: `E58EBD0EAC197E79126135AA6D6D5805D9540B20F1ED42FAE70BA186E73DD4D0`
- Parsed source: `result_15fps_scenario_samples/result.csv`
- Records parsed: 408
- Models: Face Landmarker, BlazeFace Short, YuNet, and SCRFD-10GF

### Scenarios and repetitions

The archive contains 17 labeled scenarios, each repeated three times:

- `NO_FACE` (5): normal, low light, cluttered background, tilted camera, and student leaves.
- `ONE_FACE` (6): normal, glasses, head movement, far distance, partial occlusion, and low light.
- `MULTIPLE_FACES` (6): side, background, far second face, partial occlusion, low light, and enter/leave.

Two complementary modes were retained instead of mixing their timing values:

1. **Paired same-frame accuracy:** all four models evaluate the same sampled frames. This is used for model selection accuracy.
2. **Isolated performance:** each model runs independently. This is used for deployment latency and feasibility at the configured 15 FPS target.

Each model has 1,071 paired frames (17 scenarios x 3 runs); this yields 4,284 model-frame evaluations. The non-SCRFD models have 15,504 isolated frames each; SCRFD processed fewer frames because it was substantially slower.

## 4. Paired same-frame accuracy results

Accuracy below is frame-weighted: `sum(correct frames) / sum(frames)`. This avoids giving a short run the same weight as a long run.

| Model | Paired frames | Overall accuracy | NO_FACE accuracy | ONE_FACE accuracy | MULTIPLE_FACES accuracy |
| --- | ---: | ---: | ---: | ---: | ---: |
| **YuNet** | 1,071 | **96.08%** | 98.73% | **94.97%** | 94.97% |
| SCRFD-10GF | 1,071 | 92.44% | **98.73%** | 82.80% | **96.83%** |
| Face Landmarker | 1,071 | 92.34% | 97.46% | 91.53% | 88.89% |
| BlazeFace Short | 1,071 | 89.92% | 98.10% | 89.68% | 83.33% |

### Interpretation

- YuNet ranks first overall and is the only model that combines the strongest `ONE_FACE` result with a strong `MULTIPLE_FACES` result.
- SCRFD-10GF performs well on `NO_FACE` and `MULTIPLE_FACES`, but its lower `ONE_FACE` accuracy would create more unnecessary warnings during ordinary student use. Its speed also fails the 15 FPS deployment criterion.
- Face Landmarker is stable and relatively fast, but its second-face recognition is lower than YuNet in this sample.
- BlazeFace Short is the fastest candidate, but has the lowest paired overall accuracy and the weakest multiple-face result.

## 5. Isolated performance results at a 15 FPS target

The 15 FPS target has a per-sampled-frame budget of 66.67 ms. `Effective FPS` is the measured processing rate reported by the evaluation export; it should not be confused with the camera capture frame rate.

| Model | Isolated frames | Overall accuracy | Mean inference | Weighted P95 inference | Effective FPS | Meets 15 FPS target? |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| **YuNet** | 15,504 | **95.82%** | 36.34 ms | 40.11 ms | 15.15 | Yes |
| Face Landmarker | 15,504 | 92.15% | 20.26 ms | 23.53 ms | 15.15 | Yes |
| BlazeFace Short | 15,504 | 89.93% | **8.83 ms** | **11.08 ms** | 15.16 | Yes |
| SCRFD-10GF | 1,734 | 92.27% | 674.79 ms | 639.60 ms | 1.63 | **No** |

YuNet's P95 of 40.11 ms leaves approximately 26.56 ms inside the 66.67 ms sampling budget. Its latency is higher than Face Landmarker and BlazeFace Short, but remains compatible with the selected 15 FPS configuration on the tested machine.

## 6. Recommendation for the project

### Recommended production configuration

- **Primary detector:** YuNet
- **Sampling configuration:** 15 FPS
- **Decision role:** classify `NO_FACE`, `ONE_FACE`, and `MULTIPLE_FACES`; let the existing anti-cheat event policy decide when a sustained state becomes a violation.
- **Do not deploy SCRFD-10GF** for this browser-side 15 FPS path because its isolated throughput is below target.

This selection does not mean the system immediately punishes a student for one incorrect frame. A robust exam policy should aggregate consecutive detections or use a short persistence/cooldown rule before emitting a backend anti-cheat event. That keeps model noise separate from the backend-owned violation count and prevents a transient lighting or motion error from terminating an attempt.

### Why YuNet rather than retaining Face Landmarker?

Face Landmarker is still a technically defensible baseline because it is fast and its paired accuracy is 92.34%. However, the goal of this comparison is to select the strongest detector from the tested candidates at the same 15 FPS operating point. YuNet improves paired accuracy by **3.74 percentage points** (96.08% versus 92.34%) while staying within the 15 FPS time budget. Therefore YuNet is the more evidence-supported choice for the camera face-count detector in this project.

## 7. Scope, validity, and limitations

The scenario catalog embedded in the supplied archive labels every scenario as `SYNTHETIC SAMPLE ONLY`. Therefore this report supports the conclusion **for this controlled evaluation set and tested device/configuration only**. It must not be presented as a claim of universal real-world accuracy, demographic fairness, spoof/liveness resistance, or a security guarantee.

For a stronger final defense, retain the archive and this checksum, demonstrate YuNet live in the application, and explain that a future validation round should use consented real webcam sessions across additional devices, lighting conditions, cameras, distances, and more participants. The current evidence is nevertheless sufficient to justify selecting YuNet among the four tested candidates for the stated 15 FPS controlled evaluation.

## 8. Suggested oral presentation

> "Em so sánh bốn model đếm khuôn mặt tại cùng cấu hình 15 FPS. Để so sánh công bằng, em dùng accuracy cùng khung hình để chọn model và đo riêng từng model để đánh giá độ trễ. YuNet có accuracy paired cao nhất, 96.08%, trong đó trạng thái bình thường một sinh viên là 94.97%; P95 khi chạy riêng là 40.11 ms, thấp hơn ngân sách 66.67 ms của 15 FPS. SCRFD không phù hợp vì chỉ đạt 1.63 FPS hiệu dụng. Vì vậy em tích hợp YuNet làm detector đếm khuôn mặt, còn backend vẫn là nơi quyết định đếm vi phạm và kết thúc bài thi."

## 9. Reproducibility notes

The report was generated from the supplied CSV export without altering its source values. Overall accuracy and timing aggregates are frame-weighted. The export's per-row `macro_f1`, `false_incidents`, and `missed_incidents` columns are not used as a cross-scenario selection score because their denominators and semantics are not established by the export; accuracy and independently measured timing are reported directly instead.
