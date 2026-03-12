import React from "react";
import { LoginPage } from "./pages/LoginPage";

export const authRoute = {
  path: '/auth',
  element: React.createElement(LoginPage),
  children: []
};
