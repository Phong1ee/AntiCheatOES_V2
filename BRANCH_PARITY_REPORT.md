# Đối chiếu question-group và camera_retinaface_eval

Ngày kiểm tra: 2026-10-04. Project thực hiện: `D:/School/SUPER_FINAL/AntiCheatOES_V2`.
Branch đang làm việc: `camera_retinaface_eval`. Không commit/push/deploy trong lần tích hợp này.

## Khác biệt và cách tích hợp

Hai branch có lịch sử chung tại `30d167d3`. Từ lịch sử chung, `question-group`
thêm/sửa 32 file backend. Ba thay đổi cấu hình riêng (`database.py`,
`constant.py`, `alembic.ini`) được giữ theo branch đích và chỉnh sửa của người dùng.
29 file tính năng còn lại đã được đối chiếu: một số đã có, một số được bổ sung
ở các bước trước; 23 file còn khác được ghép bằng merge ba chiều theo lịch sử chung.
Không có xung đột văn bản trong 23 file đó. Có phát hiện và sửa xung đột ngữ nghĩa
về khai báo lặp `questions_per_page` sau khi ghép.

| Khu vực | Trước tích hợp trên camera_retinaface_eval | Kết quả |
| --- | --- | --- |
| Request rich content | Thiếu RichContentRequest; request cũ chỉ nhận text | Bổ sung allowlist sanitizer, media IDs, semantic true/false và text fallback |
| Question/option content | Model/service chưa đồng bộ với migration đã có | Đồng bộ rich_html, media references, image_alt, semantic_value; giữ nội dung bị bỏ qua trong partial update |
| Media | Chủ yếu endpoint ảnh cũ | Bổ sung upload/read/delete/cleanup immutable media; authorization theo subject/ownership/attempt snapshot |
| Group/parent | Có UI modal nhưng thiếu API/backend structure | Bổ sung group/parent CRUD, reorder, pin, keep order/together, kiểm tra conflict và preview |
| Layout/attempt | Thiếu layout engine và snapshot rich/media | Bổ sung seeded logical-block layout, page/slot và content/layout snapshot khi tạo attempt |
| Student/results | API chưa trả các trường renderer cần | Trả rich/media/layout từ snapshot; phục hồi settings layout theo snapshot; giữ scoring option identity |
| Pagination settings | Frontend gửi nhưng ORM chưa có cột | Đồng bộ cột; lưu số câu/trang; kiểm tra pin conflict; omission giữ giá trị hiện tại |
| Import/clone | Chưa bảo toàn nội dung mới hoặc báo giới hạn | Clone giữ rich/media/semantic; import phát hiện dữ liệu không biểu diễn được theo contract nguồn |
| Frontend | Đã có rich editor, renderer, modal groups, teacher/student page UI | Giữ UI mới của branch đích; chạy lại toàn bộ test và build với backend đã tích hợp |
| Deployment/locking | Có sửa mới riêng trên branch đích | Giữ script migration deployment, exam version/lock, assignment/result-visibility và cấu hình môi trường |

## File chính

- `backend/src/a_db_config/__init__.py`
- `backend/src/models/teacher/requestModel/RichContentRequest.py`
- `backend/src/models/teacher/requestModel/QuestionAddToDBRequest.py`, `QuestionUpdateRequest.py`, `QuestionOptionsRequest.py`
- `backend/src/service/rich_content_service.py`, `question_content_service.py`, `question_media_service.py`, `question_layout_service.py`
- `backend/src/route/teacherRoute/questionMediaRoute.py`, `questionStructureRoute.py`
- `backend/src/route/teacherRoute/questionBankRoute.py`, `addQuestionsRoute.py`, `getExamsRoute.py`, `examPoolRoute.py`, `examSettingsRoute.py`
- `backend/src/models/teacher/examModel.py`, `backend/src/models/resultModel.py`
- `backend/src/controller/teacherController/examController.py`, `backend/main.py`
- `backend/src/service/exam_question_import_service.py`, `backend/src/route/adminRoute.py` (bảo toàn/validate nội dung trong các luồng dùng chung)
- `backend/tests/test_question_multimedia_structure.py`, `test_question_content_services.py`, `test_exam_settings_questions_per_page.py`, `test_teacher_exam_subject_permissions.py`

## Migration và dữ liệu

Giữ nguyên migration đã áp dụng `8a21c7e5b940_question_structure_multimedia.py`
với `down_revision=f2a7c9e4b106`. Không tạo, sửa, xóa migration cũ, stamp hoặc
reset database. `alembic heads` có đúng một head và `alembic current` đọc được
`8a21c7e5b940` từ MySQL cấu hình trên máy.

Kiểm tra read-only bằng SQLAlchemy Inspector đã xác nhận các cột liên quan trên
8 bảng: question, options, question_media_asset, exam_question_block,
exam_question, exam_setting, attempt_question, question_revision.
Đây là MySQL cấu hình trên máy; không khẳng định đã cập nhật Railway.

## Kiểm thử đã chạy

- `uv run pytest tests/test_question_content_services.py tests/test_question_multimedia_structure.py tests/test_deployment_migrations.py tests/test_exam_data_migrations.py tests/test_exam_settings_questions_per_page.py tests/test_teacher_exam_subject_permissions.py -q`: **106 passed**.
- `npm test`: **64 passed / 9 files**, gồm sanitized renderer/math/media và modal giữ draft.
- `npm run build`: **PASS**, 2584 modules, có warning kích thước bundle; không thêm build artifact vào diff.
- `npm run typecheck`: **FAIL**, 14 lỗi đã có ở frontend anti-cheat/audio/camera, AdminQuestionBankPage, UserManagementPage, PreExamSecurityDialog, CameraModelComparison, ExamResultsModal, ExamSettingsModal và AntiCheatMonitor. Frontend không thay đổi trong lần tích hợp này.
- `uv run python -m compileall -q src main.py`: **PASS**.
- `uv run alembic heads`, `uv run alembic current`: **PASS**, head/current `8a21c7e5b940`.
- `git diff --check`: **PASS**.

Lần full suite đầu: **563 passed, 7 failed, 4 skipped, 14 subtests passed**.
Bốn lỗi cũ được tái hiện trên bản camera_retinaface_eval HEAD trong thư mục
baseline độc lập, giữ chỉnh sửa constant.py của người dùng: test_db_connection_pool
(extra charset/collation), test_security_configuration (SECRET_KEY fail-fast),
và hai test_teacher_exam_integration (exam bị khóa khi có active attempt).
Ba lỗi quyền subject còn lại do fixture SQLite dùng teacher IDs trùng cache Redis
bên ngoài; chạy cả file với Redis không kết nối được cho **10 passed**. Đã cô lập
cache trong fixture test quyền subject để dữ liệu được lấy từ SQLite của chính test;
không thay đổi chính sách authorization runtime hay cấu hình Redis của project.

Lần full suite cuối (`uv run pytest -q --tb=short`): **567 passed, 4 failed, 4 skipped, 14 subtests passed**, 180.14 giây. Bốn lỗi còn lại đúng các lỗi đã tái hiện trên baseline trước tích hợp; không tuyên bố full suite pass.

## Phạm vi nghiệm thu

Đây là tích hợp tính năng đã có trên question-group, không tuyên bố đã mở rộng
những khả năng chưa có trên branch nguồn hoặc đã kiểm thử thủ công Railway.

| 3–4. Question Structure & Multimedia | Status | Evidence |
| --- | --- | --- |
| Question group | PARTIAL | Group CRUD/reorder/pin và modal có test; dynamic pool từ chối grouping với 409 như branch nguồn |
| Parent question / sub-question | PARTIAL | Parent stimulus + logical block có test; pin riêng child bị từ chối, cần pin toàn block như branch nguồn |
| Cấu hình số câu hỏi trên một page | PASS | test_exam_settings_questions_per_page; test_changing_page_size_rejects_shifted_pin; test_omitted_page_size_in_settings_update_preserves_pinned_layout |
| Rich-text/HTML editor | PASS | Frontend rich-content.test.tsx; request sanitize và serialize/restore tests |
| Mathematical notation/formula | PASS | Frontend math renderer tests; backend math, bounded nesting, XSS tests |
| Text-only question | PASS | test_seven_content_combinations_roundtrip và frontend renderer tests |
| Image-only question | PASS | Cùng test parameterized; media authorization tests |
| Audio-only question | PASS | Cùng test parameterized; media player tests |
| Text + image | PASS | Backend/frontend content combination tests |
| Text + audio | PASS | Backend/frontend content combination tests |
| Image + audio | PASS | Backend/frontend content combination tests |
| Text + image + audio | PASS | Backend/frontend content combination tests |
| Media hiển thị đúng ở Student Exam UI | PASS | Shared RichContent/QuestionPage; rich-content.test.tsx; snapshot-scoped media/backend attempt tests; frontend build |

## Rủi ro và việc còn lại

- Full suite/typecheck không được báo pass khi còn lỗi; các lỗi cũ nêu trên chưa sửa ngoài phạm vi tích hợp.
- Dynamic pool grouping, pin từng child, và những giới hạn khác của branch nguồn vẫn giữ nguyên. Cần yêu cầu riêng nếu muốn mở rộng.
- Cần kiểm tra thủ công teacher/student với tài khoản thật sau deploy; chưa deploy lên Railway/Vercel.
- Branch question-group và các cấu hình riêng, chỉnh sửa trước đó của người dùng vẫn giữ nguyên.
