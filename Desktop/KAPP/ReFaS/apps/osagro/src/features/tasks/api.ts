import { apiRequest } from "../../lib/api/client";
import type {
  CompleteTaskInput,
  CreateTaskInput,
  FarmTask,
  TaskEfficiencyResponse,
  TasksResponse
} from "./task.types";

export async function getTasks() {
  return apiRequest<TasksResponse>("/tasks");
}

export async function postTask(input: CreateTaskInput) {
  return apiRequest<{ task: FarmTask }>("/tasks", {
    method: "POST",
    body: {
      farmId: input.farmId,
      taskType: input.taskType,
      status: input.status,
      costAmount: input.costAmount,
      estimatedCost: input.estimatedCost,
      actualCost: input.actualCost
    }
  });
}

export async function startTask(taskId: string) {
  return apiRequest<{ task: FarmTask }>(`/tasks/${taskId}/start`, {
    method: "POST"
  });
}

export async function cancelTask(taskId: string) {
  return apiRequest<{ task: FarmTask }>(`/tasks/${taskId}/cancel`, {
    method: "POST"
  });
}

export async function completeTask(input: CompleteTaskInput) {
  return apiRequest<{ task: FarmTask }>(`/tasks/${input.taskId}/complete`, {
    method: "POST",
    body: {
      actualCost: input.actualCost,
      notes: input.notes
    }
  });
}

export async function getTaskEfficiency(days = 30) {
  return apiRequest<TaskEfficiencyResponse>(`/tasks/efficiency?days=${days}`);
}