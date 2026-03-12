import { LiveSimulationView } from "../LiveSimulationView";
import { SimulationsPage } from "../pages/SimulationsPage";

export const simulationsRoute = {
  path: "simulations",
  children: [
    {
      index: true,
      element: <SimulationsPage />
    },
    {
      path: "live",
      element: <LiveSimulationView />
    }
  ]
};
