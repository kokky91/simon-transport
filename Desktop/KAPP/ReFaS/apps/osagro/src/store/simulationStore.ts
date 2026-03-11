import { create } from "zustand"

interface SimulationState {
  results: any
  setResults: (data:any) => void
}

export const useSimulationStore = create<SimulationState>((set) => ({
  results: null,
  setResults: (data) => set({ results: data })
}))
