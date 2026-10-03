# Question Structure & Multimedia — project ổ D

Project đích: `D:/School/SUPER_FINAL/AntiCheatOES_V2`.

Các thay đổi ban đầu được triển khai trong Codex worktree ổ C. Sau khi người dùng yêu cầu sửa trực tiếp project ổ D, code được ghép ba chiều từ baseline worktree, giữ các thay đổi anti-cheat policy, camera monitoring, teacher lock, notification và các cấu hình local hiện có của project đích. Không sửa `.env`, không commit, không reset database hay dữ liệu.

## Kiến trúc và files chính

- Rich content: `backend/src/service/rich_content_service.py`, `question_content_service.py`, `models/teacher/requestModel/RichContentRequest.py`; `frontend/src/components/common/{RichEditor,RichContent,ContentEditor}.tsx`. Backend sanitize bằng closed allowlist; frontend dựng React nodes; KaTeX cô lập, trust=false và xử lý lỗi công thức. Plain text/search được giữ riêng, media-only không dùng nội dung giả.
- Media: tái sử dụng bảng **question_media_asset** hiện có, mở rộng immutable IDs/storage/ownership; `backend/src/route/teacherRoute/questionMediaRoute.py`, `service/question_media_service.py`, `a_db_config/__init__.py`. Ảnh 2 MB/audio 10 MB, kiểm tra magic bytes; GET student giới hạn reference trong snapshot của attempt chính chủ. Native audio controls, không autoplay; loading/error/retry; ảnh responsive và alt text.
- Structure/layout: `backend/src/route/teacherRoute/questionStructureRoute.py`, `service/question_layout_service.py`; `frontend/src/components/teacher/exam-manager/QuestionStructurePanel.tsx`. Exam-specific groups/parent stimuli/child order/global pins/keep-order/together; xóa container detach children; optimistic version check.
- Snapshot và pages: `backend/src/models/teacher/examModel.py`, `controller/teacherController/examController.py`, `models/resultModel.py`; `frontend/src/components/exam/{QuestionPage,QuestionArea,QuestionPanel,ExamInterface}.tsx`, `exam/question-pages.ts`, `teacher/exam-manager/StudentQuestionPreview.tsx`, `tabs/SettingsTab.tsx`. Teacher preview dùng engine server và chính Student QuestionPage; deterministic seed không ghi attempt thật. Resume/scoring/result giữ snapshot và option identities.
- Bank/exam flows: questionBankRoute/addQuestionsRoute/examPoolRoute/getExamsRoute/questionImageRoute/examSettingsRoute, existing approval/import flow, frontend QuestionEditor/QuestionsTab/detail/lists/services/types. Payload cập nhật cũ giữ các trường rich/media bị bỏ qua; thay thế options rich không rõ identity bị từ chối thay vì mất dữ liệu.
- Tests: `backend/tests/test_question_multimedia_structure.py`, `test_student_exam_flow.py`, `test_exam_data_migrations.py`; `frontend/src/components/common/rich-content.test.tsx`.

## Migration thực của project ổ D

`backend/alembic/versions/8a21c7e5b940_question_structure_multimedia.py`, down_revision **f2a7c9e4b106**, là head thực được xác minh bằng current/heads/history trước khi tạo migration tại project đích. Không sửa các migration cũ của ổ D.

Migration mở rộng question_media_asset thay vì tạo bảng media trùng, tạo exam_question_block, mở rộng content/options/membership, tăng MEDIUMTEXT, chuẩn hóa snapshot cũ và range questions_per_page 1–50. Các columns legacy đã có được giữ/reused. Downgrade từ chối rollback mất dữ liệu; cần forward migration được review nếu muốn revert.

Lần upgrade đầu lỗi JSON path tại bước backfill sau nontransactional MySQL DDL. Đã sửa bước backfill và bổ sung kiểm tra schema để tiếp tục migration chưa hoàn tất an toàn, không stamp/reset/drop dữ liệu. Lần upgrade tiếp theo thành công; current = **8a21c7e5b940 (head)**. Kiểm tra read-only: 1.195 attempt_question rows, 0 missing layout, 0 missing canonical content keys; ORM đọc Question/Media/AttemptQuestion thành công. Read-only getExamQuestions trên attempt legacy trả 2 câu có layout và không lộ correctness; validate_structure của exam tương ứng đọc 4 slots thành công.

## API additions

- POST /api/teacher/question-media?subject_id=…; GET/DELETE /api/teacher/question-media/{media_id}; POST /api/teacher/question-media/cleanup-staged.
- GET/PUT /api/teacher/exams/{exam_id}/question-structure (expected_version).
- GET /api/teacher/exams/{exam_id}/question-preview?seed=…&shuffle=…&shuffle_options=….
- GET /api/exams/attempts/{attempt_id}/media/{media_id}.
- Existing contracts retain IDs/plain fields and add optional rich/media/layout data.

## Verification thực chạy ở ổ D

- Focused backend: isolated REDIS_URL, uv run python -m pytest tests/test_question_multimedia_structure.py tests/test_student_exam_flow.py tests/test_teacher_question_bank.py tests/test_exam_pool_features.py -q --tb=short: **102 passed**, 81.31 s, trước bước mở rộng model media thành bảng legacy.
- Full backend sau migration/model adaptation, $env:REDIS_URL='redis://127.0.0.1:1/0'; uv run python -m pytest -q --tb=short: **514 passed, 4 failed, 4 skipped, 14 subtests passed**, 385.97 s. Bốn failures được chạy lại trên source HEAD ổ D trước merge, giữ hai local modifications database.py/constant.py có sẵn: **cùng 4 failures**, 4.53 s. Cụ thể: test_db_connection_pool expected kwargs thiếu charset/collation local; test_security_configuration fail-fast JWT; hai test_teacher_exam_integration thay đổi settings/result_visibility bị existing active-attempt lock trả 409. Không sửa policy/config có sẵn để ép test pass.
- npm test: **62 passed / 8 files**, gồm 28 tests mới.
- npm run build: **PASS**, 2.582 modules, 10.29 s; large-chunk warning.
- npm run typecheck: **FAIL**, 14 diagnostics ở các file anti-cheat/admin/dev/các teacher modal hiện có, không còn diagnostics ở các files mới/ghép của task sau sửa duplicate service fields. Không tuyên bố full typecheck pass.
- Python py_compile core/model/migration: **PASS**.
- Alembic current/heads/history trước migration: **PASS**; heads/upgrade/current sau recovery: **PASS**, một head.
- git diff --check tại project đích: **PASS**. Các generated MediaPipe asset-only changes do build đã được bỏ; dữ liệu untracked có sẵn của người dùng được giữ.

## Giới hạn còn lại

Dynamic pool group/parent và pin riêng một child bên trong logical block chưa hỗ trợ (409 validation); manual/fixed-randomization có structure. Native editor dùng execCommand cần kiểm tra thêm các browser mục tiêu. Staged media cleanup chạy cơ hội khi teacher upload hoặc gọi API, chưa có scheduled worker. Chưa thực hiện UI/browser live create/edit/start/resume/result/playback; migration/ORM reads đã xác minh trên database thật. Không lấy kết quả test worktree C làm kết quả test project D.

## Nghiệm thu theo evidence

PASS chỉ áp dụng code/test tương ứng, không thay thế kiểm thử UI end-to-end thực tế.

| 3–4. Question Structure & Multimedia | Status | Evidence (file/test/manual verification) |
| --- | --- | --- |
| Question group | PARTIAL | CRUD/order/pin/preview tests; dynamic pool còn thiếu |
| Parent question / sub-question | PARTIAL | Stimulus/child/continuation tests; dynamic pool/individual child pin còn thiếu |
| Cấu hình số câu hỏi trên một page | PARTIAL | Migration thật đã upgrade; range/layout/sequential/pin-conflict tests; chưa live browser resume |
| Rich-text/HTML editor | PASS | RichEditor serialize/restore/preview và backend/frontend XSS tests |
| Mathematical notation/formula | PASS | KaTeX inline/block/invalid syntax/recovery/trust-disabled tests |
| Text-only question | PASS | Backend roundtrip và shared teacher/student renderer parametrized tests |
| Image-only question | PASS | Cùng tests 7 tổ hợp và media authorization/snapshot tests |
| Audio-only question | PASS | Cùng tests; controls/loading/error/retry, không autoplay |
| Text + image | PASS | Backend/frontend parametrized tests |
| Text + audio | PASS | Backend/frontend parametrized tests |
| Image + audio | PASS | Backend/frontend parametrized tests |
| Text + image + audio | PASS | Backend/frontend parametrized tests |
| Media hiển thị đúng ở Student Exam UI | PARTIAL | Shared QuestionPage tests cả 7 tổ hợp; chưa live browser playback/network |

## UI refinement — group modal

Implemented directly in project D: group/parent/pins moved into a Radix dialog with a compact launcher, separate structure/preview sections, scrollable body and fixed footer; closing retains draft. Blue action buttons, underlined detach/remove, readable rich formatting toolbar and accessible upload controls. Files: QuestionStructurePanel.tsx/.css/.test.tsx, common RichEditor.tsx/ContentEditor.tsx/content-editor.css, StudentQuestionPreview.tsx.

Verification: npm test **64 passed / 9 files**, npm run build **PASS** (2.584 modules, 9.80 s); typecheck still has the same 14 unrelated diagnostics. Browser visual check performed on the actual components with temporary local fixture data (no auth or DB writes): compact launcher leaves editor visible, group modal has its own scroll and footer, closing returns to editor. Temporary harness removed and server stopped. Screenshots retained as local verification artifacts.
