import React from "react";
import { TasksPage } from "./pages/TasksPage";

export const tasksRoute = {
  path: '/tasks',
  element: React.createElement(TasksPage),
  children: []
};
