import React from "react";
import { SimulationsPage } from "./pages/SimulationsPage";

export const simulationsRoute = {
  path: '/simulations',
  element: React.createElement(SimulationsPage),
  children: []
};
