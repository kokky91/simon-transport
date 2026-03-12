import React, { useEffect, useRef, useState } from "react";
import type { Building, FarmWorld, FieldPlot } from "./infraApi";

type MoveInput = {
  id: string;
  x_m: number;
  y_m: number;
};

type DragDescriptor = {
  kind: "field" | "building";
  id: string;
  x_m: number;
  y_m: number;
  width_m: number;
  height_m: number;
};

type DragEntity = DragDescriptor & {
  start_client_x: number;
  start_client_y: number;
  origin_x_m: number;
  origin_y_m: number;
};

type Props = {
  farm: FarmWorld;
  plots: FieldPlot[];
  buildings: Building[];
  highlightId?: string;
  onMoveField?: (payload: MoveInput) => Promise<void>;
  onMoveBuilding?: (payload: MoveInput) => Promise<void>;
};

export default function InfraViewport({
  farm,
  plots,
  buildings,
  highlightId,
  onMoveField,
  onMoveBuilding,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(2.6);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  const [baseScale, setBaseScale] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [dragMode, setDragMode] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [snapStepMeters, setSnapStepMeters] = useState(10);
  const [dragEntity, setDragEntity] = useState<DragEntity | null>(null);
  const [dragError, setDragError] = useState<string | null>(null);

  const dragDebugText = dragEntity
    ? `${dragEntity.kind} ${dragEntity.id.slice(0, 8)} • x=${dragEntity.x_m.toFixed(1)}m y=${dragEntity.y_m.toFixed(1)}m`
    : null;

  useEffect(() => {
    const resize = () => {
      if (!containerRef.current) return;

      const { clientWidth, clientHeight } = containerRef.current;

      const scaleX = clientWidth / farm.width_m;
      const scaleY = clientHeight / farm.height_m;

      const fittedScale = Math.min(scaleX, scaleY);

      setBaseScale(fittedScale);

      // Auto-center the world
      const worldWidthPx = farm.width_m * fittedScale;
      const worldHeightPx = farm.height_m * fittedScale;

      setPan({
        x: (clientWidth - worldWidthPx) / 2,
        y: (clientHeight - worldHeightPx) / 2,
      });
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [farm.width_m, farm.height_m]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta = -event.deltaY * 0.001;
      setZoom((current) => clamp(current + delta, 0.3, 8));
    };

    element.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      element.removeEventListener("wheel", handleWheel);
    };
  }, []);

  const handleMouseDown = (event: React.MouseEvent) => {
    if (dragMode) {
      return;
    }
    setIsPanning(true);
    setLastMouse({ x: event.clientX, y: event.clientY });
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (dragEntity) {
      requestAnimationFrame(() => {
        setDragEntity((current) => {
          if (!current) {
            return current;
          }
          const { nextX, nextY } = calculateDraggedMeters(
            current,
            event.clientX,
            event.clientY,
            baseScale,
            zoom,
            farm.width_m,
            farm.height_m,
            snapToGrid,
            snapStepMeters
          );
          return {
            ...current,
            x_m: nextX,
            y_m: nextY,
          };
        });
      });
      return;
    }

    if (!isPanning) {
      return;
    }

    requestAnimationFrame(() => {
      const dx = event.clientX - lastMouse.x;
      const dy = event.clientY - lastMouse.y;
      setPan((current) => ({ x: current.x + dx, y: current.y + dy }));
      setLastMouse({ x: event.clientX, y: event.clientY });
    });
  };

  const handleEntityMouseDown = (event: React.MouseEvent, descriptor: DragDescriptor) => {
    if (!dragMode) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    setDragError(null);
    setDragEntity({
      ...descriptor,
      start_client_x: event.clientX,
      start_client_y: event.clientY,
      origin_x_m: descriptor.x_m,
      origin_y_m: descriptor.y_m,
    });
  };

  const handleMouseUp = (event: React.MouseEvent) => {
    setIsPanning(false);
    if (!dragEntity) {
      return;
    }

    const { nextX, nextY } = calculateDraggedMeters(
      dragEntity,
      event.clientX,
      event.clientY,
      baseScale,
      zoom,
      farm.width_m,
      farm.height_m,
      snapToGrid,
      snapStepMeters
    );

    const dropped = {
      ...dragEntity,
      x_m: nextX,
      y_m: nextY,
    };
    setDragEntity(null);

    const saveMove = async () => {
      try {
        if (dropped.kind === "field") {
          if (onMoveField) {
            await onMoveField({ id: dropped.id, x_m: dropped.x_m, y_m: dropped.y_m });
          }
          return;
        }

        if (onMoveBuilding) {
          await onMoveBuilding({ id: dropped.id, x_m: dropped.x_m, y_m: dropped.y_m });
        }
      } catch (error) {
        setDragError(error instanceof Error ? error.message : "Failed to save new position.");
      }
    };

    void saveMove();
  };

  return (
    <div
      ref={containerRef}
      className={`infra-viewport ${isPanning ? "is-dragging" : ""} ${dragMode ? "drag-mode" : ""}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div className="infra-toolbar" onMouseDown={(event) => event.stopPropagation()}>
        <button
          type="button"
          className={`infra-toolbar-button ${dragMode ? "active" : ""}`}
          onClick={() => {
            setDragEntity(null);
            setDragMode((current) => !current);
          }}
        >
          Drag {dragMode ? "on" : "off"}
        </button>
        <button
          type="button"
          className="infra-toolbar-button"
          onClick={() => setShowGrid((current) => !current)}
        >
          Grid {showGrid ? "on" : "off"}
        </button>
        <button
          type="button"
          className={`infra-toolbar-button ${snapToGrid ? "active" : ""}`}
          onClick={() => setSnapToGrid((current) => !current)}
        >
          Snap {snapToGrid ? "on" : "off"}
        </button>
        <label className="infra-toolbar-snapstep">
          Step
          <select
            id="infra-snap-step"
            name="snapStepMeters"
            value={String(snapStepMeters)}
            onChange={(event) => setSnapStepMeters(Number(event.target.value))}
          >
            <option value="1">1m</option>
            <option value="5">5m</option>
            <option value="10">10m</option>
          </select>
        </label>
      </div>
      <div
        className={`infra-world ${showGrid ? "with-grid" : ""}`}
        style={{
          width: farm.width_m * baseScale,
          height: farm.height_m * baseScale,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "top left",
          backgroundSize: showGrid ? `${snapStepMeters * baseScale * zoom}px ${snapStepMeters * baseScale * zoom}px` : undefined,
        }}
      >
        <FieldPlotsLayer
          plots={plots}
          scale={baseScale}
          highlightId={highlightId}
          dragMode={dragMode}
          dragEntity={dragEntity}
          onEntityMouseDown={handleEntityMouseDown}
        />
      </div>
      {dragDebugText ? <p className="infra-drag-debug">{dragDebugText}</p> : null}
      {dragError ? <p className="infra-drag-error">{dragError}</p> : null}
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function calculateDraggedMeters(
  entity: DragEntity,
  clientX: number,
  clientY: number,
  baseScale: number,
  zoom: number,
  farmWidth: number,
  farmHeight: number,
  snapToGrid: boolean,
  snapStepMeters: number,
) {
  const dxPx = clientX - entity.start_client_x;
  const dyPx = clientY - entity.start_client_y;
  const metersPerPixel = 1 / (baseScale * zoom);
  const unsnappedX = entity.origin_x_m + dxPx * metersPerPixel;
  const unsnappedY = entity.origin_y_m + dyPx * metersPerPixel;

  const nextX = snapToGrid ? snapMeters(unsnappedX, snapStepMeters) : unsnappedX;
  const nextY = snapToGrid ? snapMeters(unsnappedY, snapStepMeters) : unsnappedY;

  return {
    nextX: clamp(nextX, 0, farmWidth - entity.width_m),
    nextY: clamp(nextY, 0, farmHeight - entity.height_m),
  };
}

function snapMeters(value: number, step: number) {
  return Math.round(value / step) * step;
}

const FieldPlotsLayer = React.memo(
  ({
    plots,
    scale,
    highlightId,
    dragMode,
    dragEntity,
    onEntityMouseDown,
  }: {
    plots: FieldPlot[];
    scale: number;
    highlightId?: string;
    dragMode: boolean;
    dragEntity: DragEntity | null;
    onEntityMouseDown: (event: React.MouseEvent, descriptor: DragDescriptor) => void;
  }) => (
    <>
      {plots.map((plot, index) => {
        const isDragging = dragEntity?.kind === "field" && dragEntity.id === plot.id;
        const currentX = isDragging ? dragEntity.x_m : plot.x_m;
        const currentY = isDragging ? dragEntity.y_m : plot.y_m;
        return (
          <div
            key={plot.id}
            className={`infra-plot ${highlightId === plot.id ? "highlight" : ""} ${
              dragMode ? "draggable" : ""
            } ${isDragging ? "dragging" : ""}`}
            style={{
              left: currentX * scale,
              top: currentY * scale,
              width: plot.width_m * scale,
              height: plot.height_m * scale,
            }}
            onMouseDown={(event) =>
              onEntityMouseDown(event, {
                kind: "field",
                id: plot.id,
                x_m: plot.x_m,
                y_m: plot.y_m,
                width_m: plot.width_m,
                height_m: plot.height_m,
              })
            }
          >
            {index + 1}
          </div>
        );
      })}
    </>
  )
);
