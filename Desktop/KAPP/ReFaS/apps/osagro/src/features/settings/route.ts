import React from "react";
import { SettingsPage } from "./SettingsPage";

export const settingsRoute = {
  path: '/settings',
  element: React.createElement(SettingsPage),
  children: []
};
