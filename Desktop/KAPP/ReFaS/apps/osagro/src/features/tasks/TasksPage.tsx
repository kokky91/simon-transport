import { PageTitle } from "../../components/ui/PageTitle";
import { TaskForm } from "./TaskForm";
import { TaskList } from "./TaskList";

export function TasksPage() {
  return (
    <section>
      <PageTitle title="Tasks" subtitle="Plan, assign, and track operational execution." />
      <TaskForm />
      <TaskList />
    </section>
  );
}