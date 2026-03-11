import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cancelTask, completeTask, getTaskEfficiency, getTasks, startTask } from "./api";
import type { CompleteTaskInput } from "./task.types";

export function useTasks() {
  return useQuery({
    queryKey: ["tasks"],
    queryFn: getTasks
  });
}

export function useTaskEfficiency(days = 30) {
  return useQuery({
    queryKey: ["tasks", "efficiency", days],
    queryFn: () => getTaskEfficiency(days),
    placeholderData: (previousData) => previousData
  });
}

export function useTaskActions() {
  const queryClient = useQueryClient();

  const invalidateTasks = async () => {
    await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    await queryClient.invalidateQueries({ queryKey: ["tasks", "efficiency"] });
  };

  const start = useMutation({
    mutationFn: startTask,
    onSuccess: invalidateTasks
  });

  const cancel = useMutation({
    mutationFn: cancelTask,
    onSuccess: invalidateTasks
  });

  const complete = useMutation({
    mutationFn: (input: CompleteTaskInput) => completeTask(input),
    onSuccess: invalidateTasks
  });

  return {
    start,
    cancel,
    complete
  };
}