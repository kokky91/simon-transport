export type FarmTask = {
  id: string;
  farm_id: string;
  task_type: string;
  status: "open" | "in_progress" | "done" | "cancelled";
  cost_amount: number;
  estimated_cost: number;
  actual_cost: number | null;
  completion_note: string | null;
  duration_minutes: number | null;
  created_at: string;
};

export type TasksResponse = {
  tasks: FarmTask[];
  count: number;
};

export type CreateTaskInput = {
  farmId: string;
  taskType: string;
  status: "open" | "in_progress" | "done" | "cancelled";
  costAmount: number;
  estimatedCost: number;
  actualCost: number | null;
};

export type CompleteTaskInput = {
  taskId: string;
  actualCost: number;
  notes?: string;
};

export type TaskEfficiency = {
  completed_task_count: number;
  avg_duration_minutes: number;
  avg_cost_variance_pct: number;
  total_cost_overrun_eur: number;
  window_days: number;
};

export type TaskEfficiencyResponse = {
  efficiency: TaskEfficiency;
};