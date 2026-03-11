import { LiveSimulationView } from "./LiveSimulationView";
import { SimulationsPage } from "./SimulationsPage";

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
