import { apiClient } from "./api-client";
import type { MonitorAttempt, MonitorDetail, MonitorExam, MonitorSubject } from "../types/teacher-anti-cheat";
export const teacherAntiCheatService={
 subjects:async()=> (await apiClient.get<MonitorSubject[]>("/api/teacher/anti-cheat/subjects")).data,
 exams:async(id:string)=> (await apiClient.get<MonitorExam[]>(`/api/teacher/anti-cheat/subjects/${id}/exams`)).data,
 attempts:async(id:string,search="",status="")=> (await apiClient.get<MonitorAttempt[]>(`/api/teacher/anti-cheat/exams/${id}/attempts`,{params:{search,status}})).data,
 detail:async(id:number)=> (await apiClient.get<MonitorDetail>(`/api/teacher/anti-cheat/attempts/${id}`)).data,
};
