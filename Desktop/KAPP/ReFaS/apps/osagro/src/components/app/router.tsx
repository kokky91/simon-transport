import { Navigate, createBrowserRouter, RouterProvider } from "react-router-dom";
import { AppLayout } from "../layout/AppLayout";
import { AuthGate } from "../../features/auth/AuthGate";
import { LoginPage } from "../../features/auth/LoginPage";
import { RegisterPage } from "../../features/auth/RegisterPage";
import { dashboardRoute } from "../../features/dashboard/route";
import { farmsRoute } from "../../features/farms/route";
import { fieldsRoute } from "../../features/fields/route";
import { plantsRoute } from "../../features/plants/route";
import { animalsRoute } from "../../features/animals/route";
import { tasksRoute } from "../../features/tasks/route";
import { financeRoute } from "../../features/finance/route";
import { simulationsRoute } from "../../features/simulations/route";
import { adminRoute } from "../../features/admin/route";

const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />
  },
  {
    path: "/register",
    element: <RegisterPage />
  },
  {
    path: "/",
    element: (
      <AuthGate>
        <AppLayout />
      </AuthGate>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      dashboardRoute,
      farmsRoute,
      fieldsRoute,
      plantsRoute,
      animalsRoute,
      tasksRoute,
      financeRoute,
      simulationsRoute,
      adminRoute
    ]
  }
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}