import { FormEvent, useMemo, useState } from "react";
import type { FarmTask } from "./task.types";
import { useTaskActions, useTasks } from "./useTasks";

type CompleteModalState = {
  taskId: string;
  estimatedCost: number;
} | null;

export function TaskList() {
  const { data, isLoading } = useTasks();
  const { start, cancel, complete } = useTaskActions();
  const [completeModal, setCompleteModal] = useState<CompleteModalState>(null);
  const [actualCostInput, setActualCostInput] = useState("");
  const [notesInput, setNotesInput] = useState("");

  const tasks = data?.tasks ?? [];

  function openCompleteModal(task: FarmTask) {
    setCompleteModal({ taskId: task.id, estimatedCost: task.estimated_cost });
    setActualCostInput(String(task.estimated_cost));
    setNotesInput("");
  }

  function closeCompleteModal() {
    setCompleteModal(null);
    setActualCostInput("");
    setNotesInput("");
  }

  async function onSubmitComplete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!completeModal) {
      return;
    }

    await complete.mutateAsync({
      taskId: completeModal.taskId,
      actualCost: Number(actualCostInput),
      notes: notesInput.trim() || undefined
    });
    closeCompleteModal();
  }

  const costDifference = useMemo(() => {
    if (!completeModal) {
      return 0;
    }
    return Number(actualCostInput || 0) - completeModal.estimatedCost;
  }, [actualCostInput, completeModal]);

  if (isLoading) {
    return <p>Loading tasks...</p>;
  }

  return (
    <>
      <ul>
        {tasks.map((task) => (
          <li key={task.id}>
            {task.task_type} — {task.status} — farm {task.farm_id} — est. € {task.estimated_cost.toFixed(2)}
            {task.status === "open" ? (
              <>
                <button type="button" onClick={() => start.mutate(task.id)} disabled={start.isPending}>
                  Start
                </button>
                <button type="button" onClick={() => cancel.mutate(task.id)} disabled={cancel.isPending}>
                  Cancel
                </button>
              </>
            ) : null}
            {task.status === "in_progress" ? (
              <>
                <button type="button" onClick={() => openCompleteModal(task)} disabled={complete.isPending}>
                  Complete
                </button>
                <button type="button" onClick={() => cancel.mutate(task.id)} disabled={cancel.isPending}>
                  Cancel
                </button>
              </>
            ) : null}
            {task.status === "done" ? <span> Completed</span> : null}
            {task.status === "cancelled" ? <span> Cancelled</span> : null}
          </li>
        ))}
      </ul>

      {completeModal ? (
        <dialog open>
          <form onSubmit={onSubmitComplete}>
            <h3>Complete Task</h3>
            <p>Estimated cost: € {completeModal.estimatedCost.toFixed(2)}</p>
            <label htmlFor="complete-actual-cost">Actual cost</label>
            <input
              id="complete-actual-cost"
              name="actualCost"
              type="number"
              min={0}
              step="0.01"
              value={actualCostInput}
              onChange={(event) => setActualCostInput(event.target.value)}
              required
            />
            <p>Difference: € {costDifference.toFixed(2)}</p>
            <label htmlFor="complete-notes">Notes (optional)</label>
            <textarea
              id="complete-notes"
              name="notes"
              rows={3}
              value={notesInput}
              onChange={(event) => setNotesInput(event.target.value)}
              placeholder="Completion context for audit trail"
            />
            <button type="submit" disabled={complete.isPending}>
              {complete.isPending ? "Completing..." : "Confirm Complete"}
            </button>
            <button type="button" onClick={closeCompleteModal}>
              Close
            </button>
            {complete.isError ? <p>Unable to complete task. Try again.</p> : null}
          </form>
        </dialog>
      ) : null}
    </>
  );
}