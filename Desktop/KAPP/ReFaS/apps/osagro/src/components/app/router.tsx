import { Navigate, createBrowserRouter, RouterProvider } from "react-router-dom";
import { AppLayout } from "../layout/AppLayout";
import { dashboardRoute } from "../../features/dashboard/route";
import { farmsRoute } from "../../features/farms/route/route";
import { fieldsRoute } from "../../features/fields/route/route";
import { plantsRoute } from "../../features/plants/route";
import { animalsRoute } from "../../features/animals/route";
import { adminRoute } from "../../features/admin/route";
import { tasksRoute } from "../../features/tasks/route";
import { cropsRoute } from "../../features/crops/route";
import { financeRoute } from "../../features/finance/route";
import { simulationsRoute } from "../../features/simulations/route/route";
import { authRoute } from "../../features/auth/route";
import { marketRoute } from "../../features/market/route";
import { settingsRoute } from "../../features/settings/route";

const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      dashboardRoute,
      farmsRoute,
      fieldsRoute,
      plantsRoute,
      animalsRoute,
      adminRoute,
      tasksRoute,
      cropsRoute,
      financeRoute,
      simulationsRoute,
      authRoute,
      marketRoute,
      settingsRoute
    ]
  }
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}