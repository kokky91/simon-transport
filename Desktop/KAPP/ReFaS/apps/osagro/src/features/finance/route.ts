import React from "react";
import { FinancePage } from "./pages/FinancePage";

export const financeRoute = {
  path: '/finance',
  element: React.createElement(FinancePage),
  children: []
};
