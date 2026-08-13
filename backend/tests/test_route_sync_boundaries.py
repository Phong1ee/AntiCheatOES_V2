import asyncio
import inspect
import threading
import unittest
from unittest.mock import patch

from starlette.concurrency import run_in_threadpool

from src.controller.teacherController.examController import ExamController
from src.route import adminRoute, authRoute, profileRoute, resultsRoute
from src.route.studentRoute import examRoute


class RouteSyncBoundaryTests(unittest.TestCase):
    def test_blocking_database_routes_are_sync_path_operations(self):
        routes = (
            examRoute.get_student_exams_root,
            examRoute.get_student_exams,
            examRoute.verify_exam_code,
            examRoute.start_exam,
            examRoute.submit_exam,
            examRoute.record_anti_cheat_event,
            examRoute.save_answer,
            examRoute.terminate_attempt,
            examRoute.restore_attempt,
            examRoute.resume_attempt,
            examRoute.heartbeat_attempt,
            examRoute.get_exam,
            examRoute.get_student_exams_by_id,
            authRoute.login,
            authRoute.register,
            authRoute.get_me,
            profileRoute.get_profile_me,
            profileRoute.update_profile_me,
            profileRoute.change_password,
            resultsRoute.get_results,
            resultsRoute.get_result_detail,
        )

        self.assertTrue(all(not inspect.iscoroutinefunction(route) for route in routes))

    def test_upload_routes_remain_async_and_offload_blocking_work(self):
        routes = (
            adminRoute.preview_question_bank_import,
            adminRoute.preview_new_subject_question_bank_import,
            adminRoute.import_question_bank,
            adminRoute.import_new_subject_question_bank,
            adminRoute.preview_user_import,
            adminRoute.import_users,
        )

        self.assertTrue(all(inspect.iscoroutinefunction(route) for route in routes))
        self.assertIn("run_in_threadpool", inspect.getsource(adminRoute._parse_question_bank_upload))
        self.assertIn("run_in_threadpool", inspect.getsource(adminRoute.preview_user_import))
        self.assertIn("run_in_threadpool", inspect.getsource(adminRoute.import_users))

    def test_sync_student_route_allows_two_blocking_calls_in_worker_threads(self):
        barrier = threading.Barrier(2)

        def get_student_exams(*_args):
            barrier.wait(timeout=1)
            return {"success": True, "exams": []}

        async def invoke_twice():
            current_user = {"school_id": "S1", "role": "student"}
            with patch.object(ExamController, "getStudentExams", side_effect=get_student_exams):
                return await asyncio.wait_for(
                    asyncio.gather(
                        run_in_threadpool(examRoute.get_student_exams_root, current_user),
                        run_in_threadpool(examRoute.get_student_exams_root, current_user),
                    ),
                    timeout=2,
                )

        self.assertEqual(asyncio.run(invoke_twice()), [{"success": True, "exams": []}] * 2)
