import React from "react";
import { FieldsPage } from "./pages/FieldsPage";

export const fieldsRoute = {
  path: '/fields',
  element: React.createElement(FieldsPage),
  children: []
};
