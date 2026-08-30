import { apiClient } from "./api-client";
import type { MonitorAttempt, MonitorAttemptPage, MonitorDetail, MonitorExam, MonitorStudent, MonitorSubject } from "../types/teacher-anti-cheat";
export const teacherAntiCheatService={
 subjects:async()=> (await apiClient.get<MonitorSubject[]>("/api/teacher/anti-cheat/subjects")).data,
 exams:async(id:string)=> (await apiClient.get<MonitorExam[]>(`/api/teacher/anti-cheat/subjects/${id}/exams`)).data,
 attempts:async(id:string,search="",status="")=> (await apiClient.get<MonitorAttempt[]>(`/api/teacher/anti-cheat/exams/${id}/attempts`,{params:{search,status,limit:100}})).data,
 students:async(examId:string)=> (await apiClient.get<MonitorStudent[]>(`/api/teacher/anti-cheat/exams/${examId}/students`)).data,
 studentAttempts:async(examId:string,studentId:string,page:number)=> (await apiClient.get<MonitorAttemptPage>(`/api/teacher/anti-cheat/exams/${examId}/students/${encodeURIComponent(studentId)}/attempts`,{params:{page,page_size:10}})).data,
 detail:async(id:number)=> (await apiClient.get<MonitorDetail>(`/api/teacher/anti-cheat/attempts/${id}`)).data,
 deleteAttempt:async(id:number)=> { await apiClient.delete(`/api/teacher/anti-cheat/attempts/${id}`); },
};
