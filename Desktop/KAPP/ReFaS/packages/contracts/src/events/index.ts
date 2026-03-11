export * from "./market";
export * from "./game";
export * from "./real";
export * from "./simulation";
export * from "./guard";

export type AppEvent =
	| import("./market").MarketPriceUpdated
	| import("./game").CompostProduced
	| import("./real").RealTaskRecorded
	| import("./real").PlantExtractionQueued
	| import("./real").PlantExtractionStarted
	| import("./real").PlantExtractionSucceeded
	| import("./real").PlantExtractionFailed
	| import("./simulation").SimulationRunRequested
	| import("./simulation").SimulationRunCompleted;
