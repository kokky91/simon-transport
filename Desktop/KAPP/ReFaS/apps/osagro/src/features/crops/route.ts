import React from "react";
import { CropsPage } from "./pages/CropsPage";

export const cropsRoute = {
  path: '/crops',
  element: React.createElement(CropsPage),
  children: []
};
