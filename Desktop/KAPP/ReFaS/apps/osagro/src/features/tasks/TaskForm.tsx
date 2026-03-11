import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import { postTask } from "./api";

export function TaskForm() {
  const queryClient = useQueryClient();
  const [farmId, setFarmId] = useState("");
  const [taskType, setTaskType] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("0");
  const [formError, setFormError] = useState<string | null>(null);

  const createTask = useMutation({
    mutationFn: postTask,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setTaskType("");
      setEstimatedCost("0");
    }
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(farmId);
    if (!isUuid) {
      setFormError("Farm ID must be a valid UUID (voorbeeld: 11111111-1111-1111-1111-111111111111)");
      return;
    }

    createTask.mutate({
      farmId,
      taskType,
      status: "open",
      costAmount: 0,
      estimatedCost: Number(estimatedCost),
      actualCost: null
    });
  }

  return (
    <form onSubmit={onSubmit}>
      <label htmlFor="task-farm-id">Farm ID</label>
      <input
        id="task-farm-id"
        name="farmId"
        type="text"
        value={farmId}
        onChange={(event) => setFarmId(event.target.value)}
        placeholder="UUID of existing farm"
        required
      />
      <label htmlFor="task-type">Task Type</label>
      <input
        id="task-type"
        name="taskType"
        type="text"
        value={taskType}
        onChange={(event) => setTaskType(event.target.value)}
        placeholder="Irrigation, fertilization, harvest prep"
        required
      />
      <label htmlFor="task-estimated-cost">Estimated Cost</label>
      <input
        id="task-estimated-cost"
        name="estimatedCost"
        type="number"
        min={0}
        step="0.01"
        value={estimatedCost}
        onChange={(event) => setEstimatedCost(event.target.value)}
        required
      />
      <button type="submit" disabled={createTask.isPending}>
        {createTask.isPending ? "Saving..." : "Create Task"}
      </button>
      {formError ? <p>{formError}</p> : null}
      {createTask.isError ? <p>{createTask.error instanceof Error ? createTask.error.message : "Task creation failed."}</p> : null}
    </form>
  );
}