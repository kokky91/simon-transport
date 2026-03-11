import { useState } from "react";
import { PlaceholderChart } from "../../components/charts/PlaceholderChart";
import { PageTitle } from "../../components/ui/PageTitle";
import { useTaskEfficiency, useTasks } from "../tasks/useTasks";

export function DashboardPage() {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const { data } = useTasks();
  const { data: efficiencyData, isFetching: isEfficiencyFetching } = useTaskEfficiency(days);
  const tasks = data?.tasks ?? [];
  const openTasks = tasks.filter((task) => task.status === "open" || task.status === "in_progress");
  const openEstimatedCost = openTasks.reduce((sum, task) => sum + task.estimated_cost, 0);
  const planned = tasks.filter((task) => task.status === "open").length;
  const inProgress = tasks.filter((task) => task.status === "in_progress").length;
  const done = tasks.filter((task) => task.status === "done").length;
  const cancelled = tasks.filter((task) => task.status === "cancelled").length;
  const efficiency = efficiencyData?.efficiency;

  const variancePct = efficiency?.avg_cost_variance_pct ?? 0;
  const overrunEur = efficiency?.total_cost_overrun_eur ?? 0;

  const varianceClass =
    variancePct > 5
      ? "os-kpi-negative"
      : variancePct < -5
        ? "os-kpi-positive"
        : "os-kpi-neutral";

  const overrunClass =
    overrunEur > 0 ? "os-kpi-negative" : overrunEur < 0 ? "os-kpi-positive" : "os-kpi-neutral";

  return (
    <section>
      <PageTitle
        title="Farm Operations Dashboard"
        subtitle="Operational overview for farms, tasks, finance, and simulation readiness."
      />
      <p>
        Tasks — total: {tasks.length}, open: {planned}, in progress: {inProgress}, done: {done}, cancelled: {cancelled}
      </p>
      <p>
        Open tasks: {openTasks.length} | Open estimated cost: € {openEstimatedCost.toFixed(2)}
      </p>
      <section className="os-efficiency-card">
        <h2>Task Efficiency</h2>
        <div className="os-segmented-control" role="group" aria-label="Efficiency window">
          {[7, 30, 90].map((window) => (
            <button
              key={window}
              type="button"
              className={days === window ? "os-segment active" : "os-segment"}
              onClick={() => setDays(window as 7 | 30 | 90)}
            >
              {window}d
            </button>
          ))}
        </div>
        <p>Based on {efficiency?.completed_task_count ?? 0} completed tasks.</p>
        {isEfficiencyFetching ? <p>Updating efficiency metrics...</p> : null}
        <p className="os-kpi-neutral">⏱ Avg completion time: {Math.round(efficiency?.avg_duration_minutes ?? 0)} min</p>
        <p className={varianceClass}>💸 Avg cost variance: {variancePct.toFixed(2)}%</p>
        <p className={overrunClass}>📉 Total overrun: € {overrunEur.toFixed(2)}</p>
      </section>
      <PlaceholderChart label="Farm Throughput" />
    </section>
  );
}