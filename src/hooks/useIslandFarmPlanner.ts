import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGameData } from '../contexts/GameDataContext';
import { useUserData } from '../contexts/UserDataContext';
import { useDataService } from '../contexts/DataServiceContext';
import type { ZoneType, BuildingDef, Item, TreeDef, Season } from '../types/game';
import type { FarmLayout, PlacedBuilding, PlacedPath, PlacedItem, PlacedTree, InteriorLayout, TileRect, PathType, TreeType, TapperType } from '../types/save';
import { DEFAULT_FARM_LAYOUT, migrateFarmLayout } from '../types/save';
import {
  getBuildingOccupancy, getItemOccupancy, getTreeOccupancy,
  canPlaceBuilding, canPlaceItem, canPlacePath, canPlaceTree,
} from '../utils/farmPlacement';

const TILE_CHARS: Record<string, ZoneType> = {
  f: 'farmable', w: 'water', i: 'impassable', b: 'building', r: 'bridge', p: 'path', s: 'sand', g: 'grass',
};

const SPRINKLER_IDS = new Set(['599', '621', '645']);

const HISTORY_LIMIT = 20;

// The island is always summer (tropical override in SeasonOverride = summer)
const ISLAND_SEASON = 'summer' as const;

/** Default empty island farm layout — season fixed at summer. */
const DEFAULT_ISLAND_LAYOUT: FarmLayout = {
  ...DEFAULT_FARM_LAYOUT,
  season: ISLAND_SEASON,
};

interface IslandFarmPlannerState {
  layout: FarmLayout;
  gridWidth: number;
  gridHeight: number;
  zoneMap: Map<string, ZoneType>;
  buildingDefMap: Map<string, BuildingDef>;
  itemMap: Map<string, Item>;
  treeDefs: TreeDef[];
  pushState: (next: FarmLayout) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  loading: boolean;
  // Mutations
  placeBuilding: (buildingId: string, x: number, y: number) => void;
  removeBuilding: (id: string) => void;
  updateBuilding: (id: string, patch: Partial<PlacedBuilding>) => void;
  createZone: (name: string) => string;
  addZoneRect: (zoneId: string, rect: TileRect) => void;
  removeZone: (zoneId: string) => void;
  setZoneCrop: (zoneId: string, season: Season, cropId: string | null) => void;
  paintPath: (tx: number, ty: number, type: PathType | null) => void;
  paintPathRect: (rect: TileRect, type: PathType | null) => void;
  placeItem: (itemId: string, x: number, y: number) => void;
  placeItemRect: (rect: TileRect, itemId: string) => void;
  removeItem: (id: string) => void;
  eraseRect: (rect: TileRect) => void;
  updateInterior: (buildingId: string, interior: InteriorLayout) => void;
  placeTree: (treeType: TreeType, x: number, y: number) => void;
  placeTreeRect: (rect: TileRect, treeType: TreeType) => void;
  removeTree: (id: string) => void;
  setTreeTapper: (id: string, tapper: TapperType | null) => void;
}

export function useIslandFarmPlanner(): IslandFarmPlannerState {
  const { data, loading } = useGameData();
  const { activeSave, syncVersion } = useUserData();
  const service = useDataService();

  const islandFarmDef = data?.islandFarm ?? null;

  const gridWidth  = islandFarmDef?.gridWidth  ?? 110;
  const gridHeight = islandFarmDef?.gridHeight ?? 110;

  const zoneMap = useMemo<Map<string, ZoneType>>(() => {
    if (!islandFarmDef?.tileData) return new Map();
    const map = new Map<string, ZoneType>();
    const w = islandFarmDef.gridWidth;
    for (let i = 0; i < islandFarmDef.tileData.length; i++) {
      const zone = TILE_CHARS[islandFarmDef.tileData[i]];
      // Store all non-farmable zones explicitly; farmable is the default (farmBaseType)
      if (zone && zone !== 'farmable') {
        map.set(`${i % w},${Math.floor(i / w)}`, zone);
      }
    }
    return map;
  }, [islandFarmDef]);

  // Island has no buildable/treePlant data (uses permissive default placement)
  const buildableSet = useMemo<Set<string>>(() => {
    if (!islandFarmDef?.buildableData) return new Set();
    const w = islandFarmDef.gridWidth;
    const set = new Set<string>();
    for (let i = 0; i < islandFarmDef.buildableData.length; i++) {
      if (islandFarmDef.buildableData[i] === '1') set.add(`${i % w},${Math.floor(i / w)}`);
    }
    return set;
  }, [islandFarmDef]);

  const treePlantSet = useMemo<Set<string>>(() => {
    if (!islandFarmDef?.treePlantData) return new Set();
    const w = islandFarmDef.gridWidth;
    const set = new Set<string>();
    for (let i = 0; i < islandFarmDef.treePlantData.length; i++) {
      if (islandFarmDef.treePlantData[i] === '1') set.add(`${i % w},${Math.floor(i / w)}`);
    }
    return set;
  }, [islandFarmDef]);

  const farmBaseType: ZoneType = 'farmable';

  const buildingDefMap = useMemo<Map<string, BuildingDef>>(() => {
    if (!data) return new Map();
    return new Map(data.buildingDefs.map((d) => [d.id, d]));
  }, [data]);

  const itemMap = useMemo<Map<string, Item>>(() => {
    if (!data) return new Map();
    return new Map(data.items.map((i) => [i.cheatId, i]));
  }, [data]);

  const treeDefs: TreeDef[] = data?.treeDefs ?? [];

  const [history, setHistory] = useState<FarmLayout[]>(() => [
    migrateFarmLayout(activeSave?.islandFarmLayout ?? DEFAULT_ISLAND_LAYOUT),
  ]);
  const [historyIdx, setHistoryIdx] = useState(0);

  // Reset history whenever the active save changes identity OR an external update
  // (e.g. the Sync button) overwrites it — syncVersion bumps on every updateSave call.
  const isMountRef = useRef(true);
  useEffect(() => {
    if (isMountRef.current) { isMountRef.current = false; return; }
    const fresh = migrateFarmLayout(activeSave?.islandFarmLayout ?? DEFAULT_ISLAND_LAYOUT);
    setHistory([fresh]);
    setHistoryIdx(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSave?.id, syncVersion]);

  const layout = history[historyIdx] ?? DEFAULT_ISLAND_LAYOUT;

  const pushState = useCallback(
    (next: FarmLayout) => {
      const trimmed = history.slice(0, historyIdx + 1);
      const limited = trimmed.length >= HISTORY_LIMIT ? trimmed.slice(1) : trimmed;
      const newHistory = [...limited, next];
      setHistory(newHistory);
      setHistoryIdx(newHistory.length - 1);
      if (activeSave) {
        service.updateIslandFarmLayout(activeSave.id, next);
      }
    },
    [history, historyIdx, activeSave, service],
  );

  const undo = useCallback(() => {
    if (historyIdx > 0) setHistoryIdx((i) => i - 1);
  }, [historyIdx]);

  const redo = useCallback(() => {
    if (historyIdx < history.length - 1) setHistoryIdx((i) => i + 1);
  }, [historyIdx, history.length]);

  // ── Building mutations ────────────────────────────────────────────────────────

  const placeBuilding = useCallback((buildingId: string, x: number, y: number) => {
    const def = buildingDefMap.get(buildingId);
    if (!def) return;
    const occ = getBuildingOccupancy(layout.buildings, buildingDefMap);
    // Island has no buildable data → pass undefined so canPlaceBuilding uses zone-type heuristic
    if (!canPlaceBuilding(x, y, def.width, def.height, zoneMap, farmBaseType, gridWidth, gridHeight, occ,
      buildableSet.size > 0 ? buildableSet : undefined)) return;
    pushState({
      ...layout,
      buildings: [...layout.buildings, { id: crypto.randomUUID(), buildingId, x, y }],
    });
  }, [layout, pushState, buildingDefMap, zoneMap, farmBaseType, gridWidth, gridHeight, buildableSet]);

  const removeBuilding = useCallback((id: string) => {
    const interiors = { ...layout.interiors };
    delete interiors[id];
    pushState({ ...layout, buildings: layout.buildings.filter((b) => b.id !== id), interiors });
  }, [layout, pushState]);

  const updateBuilding = useCallback((id: string, patch: Partial<PlacedBuilding>) => {
    pushState({
      ...layout,
      buildings: layout.buildings.map((b) => b.id === id ? { ...b, ...patch } : b),
    });
  }, [layout, pushState]);

  // ── Zone mutations ────────────────────────────────────────────────────────────

  const createZone = useCallback((name: string): string => {
    const id = crypto.randomUUID();
    pushState({ ...layout, zones: [...layout.zones, { id, name, rects: [], crops: {} }] });
    return id;
  }, [layout, pushState]);

  const addZoneRect = useCallback((zoneId: string, rect: TileRect) => {
    pushState({
      ...layout,
      zones: layout.zones.map((z) =>
        z.id === zoneId ? { ...z, rects: [...z.rects, rect] } : z,
      ),
    });
  }, [layout, pushState]);

  const removeZone = useCallback((zoneId: string) => {
    pushState({ ...layout, zones: layout.zones.filter((z) => z.id !== zoneId) });
  }, [layout, pushState]);

  const setZoneCrop = useCallback((zoneId: string, s: Season, cropId: string | null) => {
    pushState({
      ...layout,
      zones: layout.zones.map((z) => {
        if (z.id !== zoneId) return z;
        const crops = { ...z.crops };
        if (cropId) crops[s] = cropId; else delete crops[s];
        return { ...z, crops };
      }),
    });
  }, [layout, pushState]);

  // ── Path mutations ────────────────────────────────────────────────────────────

  const paintPath = useCallback((tx: number, ty: number, type: PathType | null) => {
    if (type === null) {
      pushState({ ...layout, paths: layout.paths.filter((p) => !(p.x === tx && p.y === ty)) });
    } else {
      const bOcc = getBuildingOccupancy(layout.buildings, buildingDefMap);
      if (!canPlacePath(tx, ty, zoneMap, farmBaseType, gridWidth, gridHeight, bOcc)) return;
      const existing = layout.paths.find((p) => p.x === tx && p.y === ty);
      if (existing?.pathType === type) return;
      const filtered = layout.paths.filter((p) => !(p.x === tx && p.y === ty));
      pushState({ ...layout, paths: [...filtered, { x: tx, y: ty, pathType: type }] });
    }
  }, [layout, pushState, buildingDefMap, zoneMap, farmBaseType, gridWidth, gridHeight]);

  // ── Item mutations ────────────────────────────────────────────────────────────

  const placeItem = useCallback((itemId: string, x: number, y: number) => {
    const bOcc = getBuildingOccupancy(layout.buildings, buildingDefMap);
    const iOcc = getItemOccupancy(layout.items);
    if (!canPlaceItem(x, y, zoneMap, farmBaseType, gridWidth, gridHeight, bOcc, iOcc, SPRINKLER_IDS.has(itemId))) return;
    pushState({
      ...layout,
      items: [...layout.items, { id: crypto.randomUUID(), itemId, x, y }],
    });
  }, [layout, pushState, buildingDefMap, zoneMap, farmBaseType, gridWidth, gridHeight]);

  const removeItem = useCallback((id: string) => {
    pushState({ ...layout, items: layout.items.filter((i) => i.id !== id) });
  }, [layout, pushState]);

  // ── Tree mutations ────────────────────────────────────────────────────────────

  const placeTree = useCallback((treeType: TreeType, x: number, y: number) => {
    const bOcc = getBuildingOccupancy(layout.buildings, buildingDefMap);
    const iOcc = getItemOccupancy(layout.items);
    const tOcc = getTreeOccupancy(layout.trees);
    // Island has no treePlant data → pass undefined so canPlaceTree uses zone-type heuristic
    if (!canPlaceTree(x, y, zoneMap, farmBaseType, gridWidth, gridHeight, bOcc, iOcc, tOcc,
      treePlantSet.size > 0 ? treePlantSet : undefined)) return;
    pushState({
      ...layout,
      trees: [...layout.trees, { id: crypto.randomUUID(), treeType, x, y }],
    });
  }, [layout, pushState, buildingDefMap, zoneMap, farmBaseType, gridWidth, gridHeight, treePlantSet]);

  const removeTree = useCallback((id: string) => {
    pushState({ ...layout, trees: layout.trees.filter((t) => t.id !== id) });
  }, [layout, pushState]);

  const setTreeTapper = useCallback((id: string, tapper: TapperType | null) => {
    pushState({
      ...layout,
      trees: layout.trees.map((t) =>
        t.id === id ? { ...t, tapper: tapper ?? undefined } : t,
      ),
    });
  }, [layout, pushState]);

  const updateInterior = useCallback((buildingId: string, interior: InteriorLayout) => {
    pushState({ ...layout, interiors: { ...layout.interiors, [buildingId]: interior } });
  }, [layout, pushState]);

  // ── Rect-fill mutations (single undo step each) ───────────────────────────

  const paintPathRect = useCallback((rect: TileRect, type: PathType | null) => {
    const inRect = (x: number, y: number) =>
      x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;
    if (type === null) {
      const newPaths = layout.paths.filter((p) => !inRect(p.x, p.y));
      if (newPaths.length !== layout.paths.length) pushState({ ...layout, paths: newPaths });
      return;
    }
    const bOcc = getBuildingOccupancy(layout.buildings, buildingDefMap);
    const filtered = layout.paths.filter((p) => !inRect(p.x, p.y));
    const newPaths: PlacedPath[] = [...filtered];
    for (let dy = 0; dy < rect.h; dy++) {
      for (let dx = 0; dx < rect.w; dx++) {
        const tx = rect.x + dx, ty = rect.y + dy;
        if (canPlacePath(tx, ty, zoneMap, farmBaseType, gridWidth, gridHeight, bOcc))
          newPaths.push({ x: tx, y: ty, pathType: type });
      }
    }
    pushState({ ...layout, paths: newPaths });
  }, [layout, pushState, buildingDefMap, zoneMap, farmBaseType, gridWidth, gridHeight]);

  const placeItemRect = useCallback((rect: TileRect, itemId: string) => {
    const bOcc  = getBuildingOccupancy(layout.buildings, buildingDefMap);
    const iOcc  = getItemOccupancy(layout.items);
    const isSprinkler = SPRINKLER_IDS.has(itemId);
    const added = new Set<string>();
    const newItems: PlacedItem[] = [];
    for (let dy = 0; dy < rect.h; dy++) {
      for (let dx = 0; dx < rect.w; dx++) {
        const tx = rect.x + dx, ty = rect.y + dy;
        const key = `${tx},${ty}`;
        if (!added.has(key) &&
            canPlaceItem(tx, ty, zoneMap, farmBaseType, gridWidth, gridHeight, bOcc, iOcc, isSprinkler)) {
          added.add(key);
          newItems.push({ id: crypto.randomUUID(), itemId, x: tx, y: ty });
        }
      }
    }
    if (newItems.length > 0)
      pushState({ ...layout, items: [...layout.items, ...newItems] });
  }, [layout, pushState, buildingDefMap, zoneMap, farmBaseType, gridWidth, gridHeight]);

  const placeTreeRect = useCallback((rect: TileRect, treeType: TreeType) => {
    const bOcc   = getBuildingOccupancy(layout.buildings, buildingDefMap);
    const iOcc   = getItemOccupancy(layout.items);
    const tOcc   = getTreeOccupancy(layout.trees);
    const tpSet  = treePlantSet.size > 0 ? treePlantSet : undefined;
    const added  = new Set<string>();
    const newTrees: PlacedTree[] = [];
    for (let dy = 0; dy < rect.h; dy++) {
      for (let dx = 0; dx < rect.w; dx++) {
        const tx = rect.x + dx, ty = rect.y + dy;
        const key = `${tx},${ty}`;
        if (!added.has(key) &&
            canPlaceTree(tx, ty, zoneMap, farmBaseType, gridWidth, gridHeight, bOcc, iOcc, tOcc, tpSet)) {
          added.add(key);
          newTrees.push({ id: crypto.randomUUID(), treeType, x: tx, y: ty });
        }
      }
    }
    if (newTrees.length > 0)
      pushState({ ...layout, trees: [...layout.trees, ...newTrees] });
  }, [layout, pushState, buildingDefMap, zoneMap, farmBaseType, gridWidth, gridHeight, treePlantSet]);

  const eraseRect = useCallback((rect: TileRect) => {
    const inRect = (x: number, y: number) =>
      x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;
    pushState({
      ...layout,
      items: layout.items.filter((i) => !inRect(i.x, i.y)),
      trees: layout.trees.filter((t) => !inRect(t.x, t.y)),
      paths: layout.paths.filter((p) => !inRect(p.x, p.y)),
    });
  }, [layout, pushState]);

  return {
    layout,
    gridWidth,
    gridHeight,
    zoneMap,
    buildingDefMap,
    itemMap,
    treeDefs,
    pushState,
    undo,
    redo,
    canUndo: historyIdx > 0,
    canRedo: historyIdx < history.length - 1,
    loading,
    placeBuilding,
    removeBuilding,
    updateBuilding,
    createZone,
    addZoneRect,
    removeZone,
    setZoneCrop,
    paintPath,
    paintPathRect,
    placeItem,
    placeItemRect,
    removeItem,
    eraseRect,
    updateInterior,
    placeTree,
    placeTreeRect,
    removeTree,
    setTreeTapper,
  };
}
