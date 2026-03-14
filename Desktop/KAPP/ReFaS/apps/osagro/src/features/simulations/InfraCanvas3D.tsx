import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { Grid, OrbitControls, Text } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import type { Building, FarmWorld, FieldPlot } from "./infraApi";
import type { Bed } from "../fields/api/bedsApi";

// ── Types ─────────────────────────────────────────────────────────────────────

type MoveInput = { id: string; x_m: number; y_m: number };

export type SelectableEntity =
  | { kind: "field"; data: FieldPlot }
  | { kind: "building"; data: Building };

type DragState = {
  id: string;
  kind: "field" | "building";
  width_m: number;
  height_m: number;
  x_m: number;
  y_m: number;
};

type Props = {
  farm: FarmWorld;
  plots: FieldPlot[];
  buildings: Building[];
  beds?: Bed[];
  onMoveField?: (payload: MoveInput) => Promise<void>;
  onMoveBuilding?: (payload: MoveInput) => Promise<void>;
  onCreateBuilding?: (payload: { type: string; width_m: number; height_m: number }) => Promise<void>;
  onEditRequest?: (entity: SelectableEntity) => void;
  onDeleteRequest?: (entity: SelectableEntity) => void;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const CROP_COLORS: [string[], number][] = [
  [["tomato", "tomaat"], 0xc0392b],
  [["lettuce", "sla"], 0x27ae60],
  [["wheat", "tarwe"], 0xd4ac0d],
  [["corn", "maïs"], 0xe67e22],
  [["potato", "aardappel"], 0x8b6914],
  [["carrot", "wortel"], 0xe97e1b],
  [["pepper", "paprika"], 0xc0392b],
  [["onion", "ui"], 0x9b59b6],
];

function cropColor(type: string): number {
  const lower = type?.toLowerCase() ?? "";
  for (const [keywords, color] of CROP_COLORS) {
    if (keywords.some((k) => lower.includes(k))) return color;
  }
  return 0x2e7d32;
}

function brighten(hex: number, f = 1.3): number {
  const r = Math.min(255, (((hex >> 16) & 0xff) * f) | 0);
  const g = Math.min(255, (((hex >> 8) & 0xff) * f) | 0);
  const b = Math.min(255, ((hex & 0xff) * f) | 0);
  return (r << 16) | (g << 8) | b;
}

function rectsOverlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
): boolean {
  const eps = 0.001; // 1 mm — touching allowed, actual overlap blocked
  return ax + eps < bx + bw && bx + eps < ax + aw && ay + eps < by + bh && by + eps < ay + ah;
}

const GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

// ── Scene sub-components ──────────────────────────────────────────────────────

function FarmGround({ farm }: { farm: FarmWorld }) {
  const w = farm.width_m;
  const h = farm.height_m;
  const pts = useMemo(
    () =>
      new Float32Array([
        0, 0, 0,
        w, 0, 0,
        w, 0, 0,
        w, 0, h,
        w, 0, h,
        0, 0, h,
        0, 0, h,
        0, 0, 0,
      ]),
    [w, h]
  );

  return (
    <group>
      <mesh
        position={[w / 2, -0.005, h / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[w, h]} />
        <meshLambertMaterial color={0x0d2010} />
      </mesh>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[pts, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={0x22c55e} />
      </lineSegments>
    </group>
  );
}
function FieldMesh({
  plot,
  selected,
  overlapping,
  dragId,
  dragPos,
  dragMode,
  onSelect,
  onPointerDown,
}: {
  plot: FieldPlot;
  selected: boolean;
  overlapping: boolean;
  dragId: string | null;
  dragPos: { x_m: number; y_m: number } | null;
  dragMode: boolean;
  onSelect: () => void;
  onPointerDown: (e: ThreeEvent<PointerEvent>) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const isActive = dragId === plot.id;
  const px = isActive && dragPos ? dragPos.x_m : plot.x_m;
  const pz = isActive && dragPos ? dragPos.y_m : plot.y_m;
  const cx = px + plot.width_m / 2;
  const cz = pz + plot.height_m / 2;
  const fieldH = 1.0; // 3D height in meters
  const base = cropColor(plot.crop_type);
  const color = overlapping ? 0xdc2626 : selected ? 0x22d3ee : hovered ? brighten(base) : base;
  const labelSize = Math.min(plot.width_m, plot.height_m) * 0.18;

  return (
    <group position={[cx, 0, cz]}>
      <mesh
        position={[0, fieldH / 2, 0]}
        castShadow
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = dragMode ? "grab" : "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "";
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          if (dragMode) {
            document.body.style.cursor = "grabbing";
            onPointerDown(e);
          } else {
            onSelect();
          }
        }}
      >
        <boxGeometry args={[plot.width_m - 0.08, fieldH, plot.height_m - 0.08]} />
        <meshLambertMaterial color={color} emissive={color} emissiveIntensity={overlapping ? 0.55 : 0.22} transparent opacity={isActive ? 0.65 : 0.92} />
      </mesh>

      {/* Wireframe selection outline */}
      {selected && (
        <mesh position={[0, fieldH / 2, 0]}>
          <boxGeometry args={[plot.width_m + 0.12, fieldH + 0.12, plot.height_m + 0.12]} />
          <meshBasicMaterial color={0x22d3ee} wireframe />
        </mesh>
      )}

      {labelSize > 0.3 && (
        <Text
          position={[0, fieldH + 0.13, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={labelSize}
          color="white"
          anchorX="center"
          anchorY="middle"
          outlineWidth={labelSize * 0.08}
          outlineColor="black"
        >
          {plot.label}
        </Text>
      )}
      {labelSize > 0.25 && plot.crop_type && (
        <Text
          position={[0, fieldH + 0.12, labelSize * 0.8]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={labelSize * 0.55}
          color="rgba(255,255,255,0.65)"
          anchorX="center"
          anchorY="middle"
        >
          {plot.crop_type}
        </Text>
      )}
    </group>
  );
}

function BuildingMesh({
  building,
  selected,
  overlapping,
  dragId,
  dragPos,
  dragMode,
  onSelect,
  onPointerDown,
}: {
  building: Building;
  selected: boolean;
  overlapping: boolean;
  dragId: string | null;
  dragPos: { x_m: number; y_m: number } | null;
  dragMode: boolean;
  onSelect: () => void;
  onPointerDown: (e: ThreeEvent<PointerEvent>) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const isActive = dragId === building.id;
  const px = isActive && dragPos ? dragPos.x_m : building.x_m;
  const pz = isActive && dragPos ? dragPos.y_m : building.y_m;
  const cx = px + building.width_m / 2;
  const cz = pz + building.height_m / 2;
  const wallH = Math.max(1.5, Math.min(building.width_m, building.height_m) * 0.28);
  const roofH = wallH * 0.35;
  const color = overlapping ? 0xdc2626 : selected ? 0x22d3ee : hovered ? 0xf0a500 : 0xd97706;
  const labelSize = Math.min(building.width_m, building.height_m) * 0.16;

  return (
    <group position={[cx, 0, cz]}>
      <mesh
        position={[0, wallH / 2, 0]}
        castShadow
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = dragMode ? "grab" : "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "";
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          if (dragMode) {
            document.body.style.cursor = "grabbing";
            onPointerDown(e);
          } else {
            onSelect();
          }
        }}
      >
        <boxGeometry args={[building.width_m - 0.08, wallH, building.height_m - 0.08]} />
        <meshLambertMaterial color={color} emissive={color} emissiveIntensity={overlapping ? 0.55 : 0.18} transparent opacity={isActive ? 0.65 : 0.92} />
      </mesh>

      {/* Roof */}
      <mesh position={[0, wallH + roofH / 2, 0]} castShadow>
        <boxGeometry args={[building.width_m * 1.05, roofH, building.height_m * 1.05]} />
        <meshLambertMaterial color={0xa85c00} emissive={0xa85c00} emissiveIntensity={0.15} />
      </mesh>

      {selected && (
        <mesh position={[0, wallH / 2, 0]}>
          <boxGeometry args={[building.width_m + 0.12, wallH + 0.08, building.height_m + 0.12]} />
          <meshBasicMaterial color={0x22d3ee} wireframe />
        </mesh>
      )}

      {labelSize > 0.25 && (
        <Text
          position={[0, wallH + roofH + 0.3, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={labelSize}
          color="#fef3c7"
          anchorX="center"
          anchorY="middle"
          outlineWidth={labelSize * 0.08}
          outlineColor="black"
        >
          {building.type}
        </Text>
      )}
    </group>
  );
}

function BioBorderMesh({
  plot,
  dragId,
  dragPos,
}: {
  plot: FieldPlot;
  dragId: string | null;
  dragPos: { x_m: number; y_m: number } | null;
}) {
  const bw = plot.bio_border_width_m ?? 0.5;
  const isActive = dragId === plot.id;
  const px = isActive && dragPos ? dragPos.x_m : plot.x_m;
  const pz = isActive && dragPos ? dragPos.y_m : plot.y_m;
  const w = plot.width_m;
  const h = plot.height_m;
  const cx = px + w / 2;
  const cz = pz + h / 2;
  const midH = Math.max(0, h - 2 * bw);
  const Y = 0.025;
  const THICK = 0.05;

  return (
    <group position={[cx, 0, cz]}>
      {/* North strip */}
      <mesh position={[0, Y, -(h / 2 - bw / 2)]}>
        <boxGeometry args={[w, THICK, bw]} />
        <meshLambertMaterial color={0x9333ea} transparent opacity={0.78} />
      </mesh>
      {/* South strip */}
      <mesh position={[0, Y, h / 2 - bw / 2]}>
        <boxGeometry args={[w, THICK, bw]} />
        <meshLambertMaterial color={0x9333ea} transparent opacity={0.78} />
      </mesh>
      {/* West strip */}
      {midH > 0 && (
        <mesh position={[-(w / 2 - bw / 2), Y, 0]}>
          <boxGeometry args={[bw, THICK, midH]} />
          <meshLambertMaterial color={0x9333ea} transparent opacity={0.78} />
        </mesh>
      )}
      {/* East strip */}
      {midH > 0 && (
        <mesh position={[w / 2 - bw / 2, Y, 0]}>
          <boxGeometry args={[bw, THICK, midH]} />
          <meshLambertMaterial color={0x9333ea} transparent opacity={0.78} />
        </mesh>
      )}
    </group>
  );
}

function BedMesh({ bed }: { bed: Bed }) {
  const padM = bed.path_cm / 100;
  const totalW = bed.width_m + 2 * padM;
  const totalL = bed.length_m + 2 * padM;
  const cx = bed.x_m + totalW / 2;
  const cz = bed.y_m + totalL / 2;
  const labelSize = Math.min(bed.width_m, bed.length_m) * 0.18;
  const bedH = 1.0; // 3D height in meters - same as fields

  return (
    <group position={[cx, 0, cz]}>
      {/* Walking path */}
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[totalW - 0.04, 0.03, totalL - 0.04]} />
        <meshLambertMaterial color={0x5d3a1a} transparent opacity={0.45} />
      </mesh>
      {/* Growing bed */}
      <mesh position={[0, bedH / 2, 0]}>
        <boxGeometry args={[bed.width_m - 0.04, bedH, bed.length_m - 0.04]} />
        <meshLambertMaterial color={0x2d7a1e} transparent opacity={0.87} />
      </mesh>
      {labelSize > 0.2 && (
        <Text
          position={[0, bedH + 0.13, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={Math.min(labelSize, 0.4)}
          color="#a8f07e"
          anchorX="center"
          anchorY="middle"
        >
          {bed.label}
        </Text>
      )}
    </group>
  );
}

// ── Keyboard pan (WASD / arrows) ─────────────────────────────────────────────

const _UP = new THREE.Vector3(0, 1, 0);
const _FWD = new THREE.Vector3();
const _RIGHT = new THREE.Vector3();
const _DELTA = new THREE.Vector3();

const PAN_KEYS = new Set(["w", "a", "s", "d", "arrowup", "arrowleft", "arrowdown", "arrowright"]);

function KeyboardPan({
  orbitRef,
  canvasHovered,
}: {
  orbitRef: React.RefObject<OrbitControlsImpl | null>;
  canvasHovered: React.RefObject<boolean>;
}) {
  const keys = useRef<Set<string>>(new Set());

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (!canvasHovered.current) return;
      const k = e.key.toLowerCase();
      if (PAN_KEYS.has(k)) {
        e.preventDefault();
        keys.current.add(k);
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [canvasHovered]);

  useFrame(() => {
    const o = orbitRef.current;
    if (!o || keys.current.size === 0) return;
    const cam = o.object;
    const tgt = o.target;
    const speed = cam.position.distanceTo(tgt) * 0.022;

    _FWD.subVectors(tgt, cam.position).setY(0).normalize();
    _RIGHT.crossVectors(_FWD, _UP).normalize();
    _DELTA.set(0, 0, 0);

    const k = keys.current;
    if (k.has("w") || k.has("arrowup"))    _DELTA.addScaledVector(_FWD, speed);
    if (k.has("s") || k.has("arrowdown"))  _DELTA.addScaledVector(_FWD, -speed);
    if (k.has("a") || k.has("arrowleft"))  _DELTA.addScaledVector(_RIGHT, -speed);
    if (k.has("d") || k.has("arrowright")) _DELTA.addScaledVector(_RIGHT, speed);

    if (_DELTA.length() > 0) {
      cam.position.add(_DELTA);
      tgt.add(_DELTA);
      o.update();
    }
  });

  return null;
}

// ── Inner scene (needs useThree) ──────────────────────────────────────────────

function FarmScene({
  farm,
  plots,
  buildings,
  beds,
  bioBorderPlots,
  dragMode,
  dragState,
  isDragOverlapping,
  selectedId,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
  orbitRef,
  canvasHovered,
}: {
  farm: FarmWorld;
  plots: FieldPlot[];
  buildings: Building[];
  beds: Bed[];
  bioBorderPlots: FieldPlot[];
  dragMode: boolean;
  dragState: DragState | null;
  isDragOverlapping: boolean;
  selectedId: string | null;
  onSelect: (e: SelectableEntity | null) => void;
  onDragStart: (e: ThreeEvent<PointerEvent>, d: DragState) => void;
  onDragMove: (x: number, z: number) => void;
  onDragEnd: () => void;
  orbitRef: React.RefObject<OrbitControlsImpl | null>;
  canvasHovered: React.RefObject<boolean>;
}) {
  const { camera } = useThree();

  useEffect(() => {
    const o = orbitRef.current;
    if (!o) return;

    // Avoid singularity at top-view and recenter only when farm dimensions change.
    o.target.set(farm.width_m / 2, 0, farm.height_m / 2);
    o.update();
  }, [farm.width_m, farm.height_m, orbitRef]);

  useEffect(() => {
    camera.up.set(0, 1, 0);
  }, [camera]);

  return (
    <>
      <KeyboardPan orbitRef={orbitRef} canvasHovered={canvasHovered} />
      <fog attach="fog" args={["#0a1a0e", farm.width_m * 3, farm.width_m * 12]} />
      <ambientLight intensity={0.7} />
      <directionalLight
        position={[farm.width_m * 0.5, 30, -10]}
        intensity={0.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <directionalLight position={[-8, 20, farm.height_m + 10]} intensity={0.35} color="#aaffcc" />

      <OrbitControls
        ref={orbitRef}
        enabled={!dragState}
        enableRotate
        minPolarAngle={0.12}
        maxPolarAngle={Math.PI / 2 - 0.03}
        enablePan
        enableZoom
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.55}
        panSpeed={0.9}
        zoomSpeed={0.9}
        minDistance={2}
        maxDistance={Math.max(farm.width_m, farm.height_m) * 2.4}
        makeDefault
      />

      <FarmGround farm={farm} />

      <Grid
        position={[farm.width_m / 2, 0.003, farm.height_m / 2]}
        args={[farm.width_m, farm.height_m]}
        cellSize={5}
        cellThickness={0.4}
        cellColor="#1a3d1f"
        sectionSize={10}
        sectionThickness={0.8}
        sectionColor="#1f4d26"
        fadeDistance={farm.width_m * 4}
        infiniteGrid={false}
      />

      {/* Invisible drag-tracking plane — only active during a drag */}
      {dragState && (
        <mesh
          position={[farm.width_m / 2, 0.001, farm.height_m / 2]}
          rotation={[-Math.PI / 2, 0, 0]}
          onPointerMove={(e) => {
            e.stopPropagation();
            onDragMove(e.point.x, e.point.z);
          }}
          onPointerUp={(e) => {
            e.stopPropagation();
            onDragEnd();
          }}
        >
          <planeGeometry args={[farm.width_m * 10, farm.height_m * 10]} />
          <meshBasicMaterial visible={false} side={THREE.DoubleSide} />
        </mesh>
      )}

      {beds.map((bed) => (
        <BedMesh key={bed.id} bed={bed} />
      ))}

      {bioBorderPlots.map((plot) => (
        <BioBorderMesh
          key={`bio-${plot.id}`}
          plot={plot}
          dragId={dragState?.id ?? null}
          dragPos={
            dragState?.id === plot.id
              ? { x_m: dragState.x_m, y_m: dragState.y_m }
              : null
          }
        />
      ))}

      {plots.map((plot) => (
        <FieldMesh
          key={plot.id}
          plot={plot}
          selected={selectedId === plot.id}
          overlapping={isDragOverlapping && dragState?.id === plot.id}
          dragId={dragState?.id ?? null}
          dragPos={
            dragState?.id === plot.id
              ? { x_m: dragState.x_m, y_m: dragState.y_m }
              : null
          }
          dragMode={dragMode}
          onSelect={() => onSelect({ kind: "field", data: plot })}
          onPointerDown={(e) =>
            onDragStart(e, {
              id: plot.id,
              kind: "field",
              width_m: plot.width_m,
              height_m: plot.height_m,
              x_m: plot.x_m,
              y_m: plot.y_m,
            })
          }
        />
      ))}

      {buildings.map((building) => (
        <BuildingMesh
          key={building.id}
          building={building}
          selected={selectedId === building.id}
          overlapping={isDragOverlapping && dragState?.id === building.id}
          dragId={dragState?.id ?? null}
          dragPos={
            dragState?.id === building.id
              ? { x_m: dragState.x_m, y_m: dragState.y_m }
              : null
          }
          dragMode={dragMode}
          onSelect={() => onSelect({ kind: "building", data: building })}
          onPointerDown={(e) =>
            onDragStart(e, {
              id: building.id,
              kind: "building",
              width_m: building.width_m,
              height_m: building.height_m,
              x_m: building.x_m,
              y_m: building.y_m,
            })
          }
        />
      ))}
    </>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function InfraCanvas3D({
  farm,
  plots,
  buildings,
  beds = [],
  onMoveField,
  onMoveBuilding,
  onCreateBuilding,
  onEditRequest,
  onDeleteRequest,
}: Props) {
  const [selectedEntity, setSelectedEntity] = useState<SelectableEntity | null>(null);
  const [dragMode, setDragMode] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [layers, setLayers] = useState({ fields: true, buildings: true, beds: true, bioBorders: true });
  const [showBuildingForm, setShowBuildingForm] = useState(false);
  const [newBuildType, setNewBuildType] = useState("Schuur");
  const [newBuildW, setNewBuildW] = useState(6);
  const [newBuildH, setNewBuildH] = useState(8);
  const [buildingSubmitting, setBuildingSubmitting] = useState(false);

  const orbitRef = useRef<OrbitControlsImpl | null>(null);
  const canvasHovered = useRef(false);
  const didInitialFitRef = useRef(false);

  // Offset from entity origin to click point — keeps entity anchored under cursor
  const dragOffsetRef = useRef({ x: 0, z: 0 });
  const dragOriginRef = useRef({ x: 0, y: 0 });
  const [overlapError, setOverlapError] = useState<string | null>(null);
  const overlapErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (overlapErrorTimerRef.current) clearTimeout(overlapErrorTimerRef.current);
    };
  }, []);

  const zoomIn = useCallback(() => {
    const o = orbitRef.current;
    if (!o) return;
    const dir = o.object.position.clone().sub(o.target).multiplyScalar(0.72);
    o.object.position.copy(o.target).add(dir);
    o.update();
  }, []);

  const zoomOut = useCallback(() => {
    const o = orbitRef.current;
    if (!o) return;
    const dir = o.object.position.clone().sub(o.target).multiplyScalar(1.38);
    o.object.position.copy(o.target).add(dir);
    o.update();
  }, []);

  const fitAll = useCallback(() => {
    const o = orbitRef.current;
    if (!o) return;
    const all = [...plots, ...buildings];
    if (all.length === 0) {
      o.target.set(farm.width_m / 2, 0, farm.height_m / 2);
      o.object.position.set(farm.width_m / 2, Math.max(farm.width_m, farm.height_m) * 0.65, farm.height_m * 0.9);
      o.update();
      return;
    }
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const e of all) {
      minX = Math.min(minX, e.x_m); maxX = Math.max(maxX, e.x_m + e.width_m);
      minZ = Math.min(minZ, e.y_m); maxZ = Math.max(maxZ, e.y_m + e.height_m);
    }
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    const span = Math.max(maxX - minX, maxZ - minZ, 20) * 1.4;
    o.target.set(cx, 0, cz);
    o.object.position.set(cx, span * 0.55, cz + span * 0.75);
    o.update();
  }, [plots, buildings, farm]);

  useEffect(() => {
    const hasEntities = plots.length + buildings.length > 0;
    if (!hasEntities || didInitialFitRef.current) return;
    fitAll();
    didInitialFitRef.current = true;
  }, [plots.length, buildings.length, fitAll]);

  useEffect(() => {
    // Reset initial-fit flag when switching to another farm size/world.
    didInitialFitRef.current = false;
  }, [farm.id, farm.width_m, farm.height_m]);

  const handleDragStart = useCallback(
    (e: ThreeEvent<PointerEvent>, entity: DragState) => {
      dragOffsetRef.current = { x: e.point.x - entity.x_m, z: e.point.z - entity.y_m };
      dragOriginRef.current = { x: entity.x_m, y: entity.y_m };
      setDragState(entity);
    },
    []
  );

  const handleDragMove = useCallback((x: number, z: number) => {
    setDragState((prev) => {
      if (!prev) return null;
      const rawX = x - dragOffsetRef.current.x;
      const rawZ = z - dragOffsetRef.current.z;
      return {
        ...prev,
        x_m: Math.max(0, Math.min(farm.width_m - prev.width_m, rawX)),
        y_m: Math.max(0, Math.min(farm.height_m - prev.height_m, rawZ)),
      };
    });
  }, [farm.width_m, farm.height_m]);

  const handleDragEnd = useCallback(async () => {
    if (!dragState) return;
    const finalX = Math.max(0, Math.min(farm.width_m - dragState.width_m, dragState.x_m));
    const finalZ = Math.max(0, Math.min(farm.height_m - dragState.height_m, dragState.y_m));
    document.body.style.cursor = "";

    // Check overlap at final position; snap back if overlapping
    // Buildings may sit on fields — only fields check beds + other fields
    const bedOverlap =
      dragState.kind === "field" &&
      beds.some((bed) => {
        const padM = bed.path_cm / 100;
        return rectsOverlap(finalX, finalZ, dragState.width_m, dragState.height_m, bed.x_m, bed.y_m, bed.width_m + 2 * padM, bed.length_m + 2 * padM);
      });
    const entityOverlap =
      dragState.kind === "field"
        ? plots.some(
            (p) =>
              p.id !== dragState.id &&
              rectsOverlap(finalX, finalZ, dragState.width_m, dragState.height_m, p.x_m, p.y_m, p.width_m, p.height_m)
          )
        : buildings.some(
            (b) =>
              b.id !== dragState.id &&
              rectsOverlap(finalX, finalZ, dragState.width_m, dragState.height_m, b.x_m, b.y_m, b.width_m, b.height_m)
          );
    const hasOverlap = bedOverlap || entityOverlap;

    if (hasOverlap) {
      setDragState(null); // snaps back to original props position (no API call)
      if (overlapErrorTimerRef.current) clearTimeout(overlapErrorTimerRef.current);
      setOverlapError("Overlapt met een ander element — positie niet opgeslagen.");
      overlapErrorTimerRef.current = setTimeout(() => setOverlapError(null), 2500);
      return;
    }

    setDragState(null);
    if (dragState.kind === "field") {
      await onMoveField?.({ id: dragState.id, x_m: finalX, y_m: finalZ });
    } else {
      await onMoveBuilding?.({ id: dragState.id, x_m: finalX, y_m: finalZ });
    }
  }, [dragState, farm.width_m, farm.height_m, plots, buildings, beds, onMoveField, onMoveBuilding]);

  const snapAllInBounds = useCallback(async () => {
    const moves: Promise<void>[] = [];
    for (const plot of plots) {
      const x = Math.max(0, Math.min(farm.width_m - plot.width_m, plot.x_m));
      const z = Math.max(0, Math.min(farm.height_m - plot.height_m, plot.y_m));
      if (x !== plot.x_m || z !== plot.y_m) {
        moves.push(onMoveField?.({ id: plot.id, x_m: x, y_m: z }) ?? Promise.resolve());
      }
    }
    for (const building of buildings) {
      const x = Math.max(0, Math.min(farm.width_m - building.width_m, building.x_m));
      const z = Math.max(0, Math.min(farm.height_m - building.height_m, building.y_m));
      if (x !== building.x_m || z !== building.y_m) {
        moves.push(onMoveBuilding?.({ id: building.id, x_m: x, y_m: z }) ?? Promise.resolve());
      }
    }
    await Promise.all(moves);
  }, [plots, buildings, farm.width_m, farm.height_m, onMoveField, onMoveBuilding]);

  const camPos = useMemo<[number, number, number]>(
    () => [
      farm.width_m * 0.5,
      Math.max(farm.width_m, farm.height_m) * 0.65,
      farm.height_m * 0.9,
    ],
    [farm.width_m, farm.height_m]
  );

  const { fillPct, occupiedM2, freeM2 } = useMemo(() => {
    const farmArea = farm.width_m * farm.height_m;
    if (farmArea === 0) return { fillPct: 0, occupiedM2: 0, freeM2: 0 };
    const occ =
      plots.reduce((s, p) => s + p.width_m * p.height_m, 0) +
      buildings.reduce((s, b) => s + b.width_m * b.height_m, 0);
    return {
      fillPct: Math.min(100, (occ / farmArea) * 100),
      occupiedM2: occ,
      freeM2: Math.max(0, farmArea - occ),
    };
  }, [plots, buildings, farm.width_m, farm.height_m]);

  const isDragOverlapping = useMemo((): boolean => {
    if (!dragState) return false;
    const { id, kind, x_m, y_m, width_m, height_m } = dragState;
    if (kind === "field") {
      // Fields may not overlap other fields or beds
      const hitsBed = beds.some((bed) => {
        const padM = bed.path_cm / 100;
        return rectsOverlap(x_m, y_m, width_m, height_m, bed.x_m, bed.y_m, bed.width_m + 2 * padM, bed.length_m + 2 * padM);
      });
      if (hitsBed) return true;
      return plots.some(
        (p) => p.id !== id && rectsOverlap(x_m, y_m, width_m, height_m, p.x_m, p.y_m, p.width_m, p.height_m)
      );
    }
    // Buildings may not overlap other buildings — but CAN sit on/in a field
    return buildings.some(
      (b) => b.id !== id && rectsOverlap(x_m, y_m, width_m, height_m, b.x_m, b.y_m, b.width_m, b.height_m)
    );
  }, [dragState, plots, buildings, beds]);

  const visiblePlots = layers.fields ? plots : [];
  const visibleBuildings = layers.buildings ? buildings : [];
  const visibleBeds = layers.beds ? beds : [];
  const bioBorderPlots = layers.bioBorders ? plots.filter((p) => p.bio_border) : [];

  // Auto-deselect if entity was removed
  const selId = selectedEntity?.data.id;
  if (selId) {
    const gone =
      !plots.some((p) => p.id === selId) && !buildings.some((b) => b.id === selId);
    if (gone) setSelectedEntity(null);
  }

  return (
    <div
      className="infra-canvas-wrap"
      onMouseEnter={() => { canvasHovered.current = true; }}
      onMouseLeave={() => { canvasHovered.current = false; }}
    >
      <Canvas
        camera={{ position: camPos, fov: 45, near: 0.1, far: 2000 }}
        shadows
        onPointerMissed={() => !dragMode && setSelectedEntity(null)}
      >
        <FarmScene
          farm={farm}
          plots={visiblePlots}
          buildings={visibleBuildings}
          beds={visibleBeds}
          bioBorderPlots={bioBorderPlots}
          dragMode={dragMode}
          dragState={dragState}
          isDragOverlapping={isDragOverlapping}
          selectedId={selectedEntity?.data.id ?? null}
          onSelect={setSelectedEntity}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
          orbitRef={orbitRef}
          canvasHovered={canvasHovered}
        />
      </Canvas>

      {/* Toolbar */}
      <div className="infra-toolbar" onMouseDown={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={`infra-toolbar-button ${dragMode ? "active" : ""}`}
          title={dragMode ? "Drag mode aan — klik om uit te zetten" : "Drag mode uit — klik om in te zetten"}
          onClick={() => {
            setDragMode((d) => !d);
            setDragState(null);
          }}
        >
          ✥
        </button>
        <div className="infra-toolbar-sep" />
        {onCreateBuilding && (
          <button
            type="button"
            className={`infra-toolbar-button ${showBuildingForm ? "active" : ""}`}
            title="Gebouw toevoegen"
            onClick={() => setShowBuildingForm((v) => !v)}
          >
            🏗
          </button>
        )}
        <div className="infra-toolbar-sep" />
        <span className="infra-toolbar-button infra-toolbar-hint">
          {dragMode ? "Sleep modus" : "Orbit / Pan"}
        </span>
      </div>

      {/* Add Building form */}
      {showBuildingForm && onCreateBuilding && (
        <form
          className="infra-add-building-form"
          onMouseDown={(e) => e.stopPropagation()}
          onSubmit={async (e) => {
            e.preventDefault();
            if (!newBuildType.trim() || newBuildW <= 0 || newBuildH <= 0) return;
            setBuildingSubmitting(true);
            try {
              await onCreateBuilding({ type: newBuildType.trim(), width_m: newBuildW, height_m: newBuildH });
              setShowBuildingForm(false);
            } finally {
              setBuildingSubmitting(false);
            }
          }}
        >
          <span className="infra-add-building-title">Gebouw toevoegen</span>
          <label className="infra-add-building-field">
            Type
            <input
              list="building-type-list"
              value={newBuildType}
              onChange={(e) => setNewBuildType(e.target.value)}
              placeholder="bijv. Schuur"
              required
            />
            <datalist id="building-type-list">
              <option value="Schuur" />
              <option value="Stal" />
              <option value="Watertank" />
              <option value="Opslagloods" />
              <option value="Serre" />
              <option value="Machineopslag" />
            </datalist>
          </label>
          <div className="infra-add-building-dims">
            <label className="infra-add-building-field">
              B (m)
              <input type="number" min={1} max={200} step={0.5} value={newBuildW}
                onChange={(e) => setNewBuildW(Number(e.target.value))} required />
            </label>
            <label className="infra-add-building-field">
              H (m)
              <input type="number" min={1} max={200} step={0.5} value={newBuildH}
                onChange={(e) => setNewBuildH(Number(e.target.value))} required />
            </label>
          </div>
          <button type="submit" className="infra-add-building-submit" disabled={buildingSubmitting}>
            {buildingSubmitting ? "…" : "+ Plaatsen"}
          </button>
        </form>
      )}

      {/* Zoom controls */}
      <div className="infra-zoom-controls" onMouseDown={(e) => e.stopPropagation()}>
        <button type="button" className="infra-zoom-btn" title="Zoom in" onClick={zoomIn}>+</button>
        <button type="button" className="infra-zoom-btn" title="Zoom uit" onClick={zoomOut}>−</button>
        <div className="infra-zoom-sep" />
        <button type="button" className="infra-zoom-btn" title="Alle entiteiten tonen" onClick={fitAll}>⊡</button>
        <div className="infra-zoom-sep" />
        <button type="button" className="infra-zoom-btn" title="Alles terugplaatsen binnen het grid" onClick={snapAllInBounds}>⤓</button>
      </div>

      {/* Layer toggles */}
      <div className="infra-layer-panel" onMouseDown={(e) => e.stopPropagation()}>
        <div className="infra-layer-panel-title">Lagen</div>
        {(["fields", "buildings", "beds", "bioBorders"] as const).map((l) => (
          <label key={l} className={`infra-layer-toggle ${layers[l] ? "active" : ""}`}>
            <input
              type="checkbox"
              checked={layers[l]}
              onChange={() => setLayers((p) => ({ ...p, [l]: !p[l] }))}
            />
            {l === "fields" ? "🌿 Velden" : l === "buildings" ? "🏗 Gebouwen" : l === "beds" ? "🪴 Bedden" : "🟣 Bio-randen"}
          </label>
        ))}
      </div>

      {/* Selected entity info */}
      {selectedEntity && (
        <div className="infra-info-panel" onMouseDown={(e) => e.stopPropagation()}>
          <p className="infra-info-panel-name">
            {selectedEntity.kind === "field"
              ? selectedEntity.data.label
              : selectedEntity.data.type}
          </p>
          <p className="infra-info-panel-type">
            {selectedEntity.kind === "field"
              ? selectedEntity.data.crop_type || "Geen gewas"
              : "Gebouw"}
          </p>
          <p className="infra-info-panel-dims">
            {selectedEntity.data.width_m}m × {selectedEntity.data.height_m}m &nbsp;·&nbsp;
            x={selectedEntity.data.x_m.toFixed(1)} y={selectedEntity.data.y_m.toFixed(1)}
          </p>
          {selectedEntity.kind === "field" && selectedEntity.data.bio_border && (
            <p className="infra-info-panel-bio">
              🟣 Bio-rand {selectedEntity.data.bio_border_width_m ?? "?"}m breed
            </p>
          )}
          <div className="infra-info-panel-actions">
            {onEditRequest && (
              <button
                type="button"
                className="infra-info-btn-edit"
                onClick={() => onEditRequest(selectedEntity)}
              >
                ✎ Bewerken
              </button>
            )}
            {onDeleteRequest && (
              <button
                type="button"
                className="infra-info-btn-delete"
                onClick={() => onDeleteRequest(selectedEntity)}
              >
                ✕ Verwijder
              </button>
            )}
          </div>
        </div>
      )}

      {/* Status bar */}
      <div
        className={`infra-status-bar${fillPct >= 90 ? " infra-status-critical" : fillPct >= 70 ? " infra-status-warning" : ""}`}
      >
        <progress className="infra-status-progress" value={fillPct} max={100} />
        <span className="infra-status-text">
          {overlapError !== null ? (
            <span className="infra-status-error">{overlapError}</span>
          ) : (
            <>
              <span className="infra-status-pct">{fillPct.toFixed(1)}%</span>
              {" vol — "}
              {Math.round(occupiedM2)}{"\u00a0"}m² bezet
              {" · "}
              {Math.round(freeM2)}{"\u00a0"}m² vrij
            </>
          )}
        </span>
      </div>
    </div>
  );
}
