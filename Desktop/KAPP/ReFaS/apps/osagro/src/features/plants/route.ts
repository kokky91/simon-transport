import React from "react";
import { PlantsPage } from "./pages/PlantsPage";

export const plantsRoute = {
  path: '/plants',
  element: React.createElement(PlantsPage), // Vite/ESBuild kan geen JSX in plain object aan
  children: []
};
