import React, { useEffect, useState } from "react";
import ReactFlow, { MiniMap, Controls, Background } from "reactflow";
import "reactflow/dist/style.css";
import { useSimulationStore } from "../../store/simulationStore";
import styles from "./FarmFlowMap.module.css";
export default function FarmFlowMap() {
  const results = useSimulationStore((s: any)=>s.results)
  const [edges, setEdges] = useState([
    { id: "e1", source: "field", target: "harvest", label: "8000 kg" },
    { id: "e2", source: "harvest", target: "biomass", label: "2000 kg" },
    { id: "e3", source: "biomass", target: "bsf", label: "1500 kg" },
    { id: "e4", source: "bsf", target: "larvae", label: "400 kg larven" },
    { id: "e5", source: "larvae", target: "animals", label: "400 kg" },
    { id: "e6", source: "animals", target: "manure", label: "600 kg mest" },
    { id: "e7", source: "manure", target: "compost", label: "600 kg" },
    { id: "e8", source: "compost", target: "soil", label: "500 kg" },
    { id: "e9", source: "harvest", target: "sale", label: "6000 kg" },
    { id: "e10", source: "biomass", target: "energy", label: "biogas" },
    { id: "e11", source: "energy", target: "water", label: "waterpomp" },
    { id: "e12", source: "water", target: "field", label: "irrigatie" },
  ])

  useEffect(() => {
    if(!results) return
    const best = results.best?.scenario
    setEdges((edges) =>
      edges.map(e => {
        if(e.source === "biomass" && e.target === "bsf" && best?.biomass_to_bsf) {
          return {
            ...e,
            label: `${best.biomass_to_bsf * 100}% biomassa`
          }
        }
        return e
      })
    )
  }, [results])

  const nodes = [
    { id: "field", position: { x: 0, y: 0 }, data: { label: "Veld" }, type: "default" },
    { id: "harvest", position: { x: 200, y: 0 }, data: { label: "Oogst" } },
    { id: "biomass", position: { x: 400, y: 0 }, data: { label: "Biomassa" } },
    { id: "bsf", position: { x: 600, y: 0 }, data: { label: "BSF" } },
    { id: "larvae", position: { x: 800, y: 0 }, data: { label: "Larven" } },
    { id: "animals", position: { x: 1000, y: 0 }, data: { label: "Dieren" } },
    { id: "manure", position: { x: 1200, y: 0 }, data: { label: "Mest" } },
    { id: "compost", position: { x: 1400, y: 0 }, data: { label: "Compost" } },
    { id: "soil", position: { x: 1600, y: 0 }, data: { label: "Bodem" } },
    { id: "sale", position: { x: 1800, y: 0 }, data: { label: "Verkoop" } },
    { id: "energy", position: { x: 600, y: 200 }, data: { label: "Energie" } },
    { id: "water", position: { x: 800, y: 200 }, data: { label: "Water" } },
  ]

  return (
    <div className={styles.container}>
      <ReactFlow nodes={nodes} edges={edges} fitView>
        <MiniMap />
        <Controls />
        <Background />
      </ReactFlow>
    </div>
  )
}
