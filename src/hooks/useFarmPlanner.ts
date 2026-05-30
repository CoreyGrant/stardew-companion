import { useCallback, useMemo, useState } from 'react';
import { useGameData } from '../contexts/GameDataContext';
import { useUserData } from '../contexts/UserDataContext';
import { useDataService } from '../contexts/DataServiceContext';
import type { ZoneType, Season, BuildingDef, Item, TreeDef } from '../types/game';
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

interface FarmPlannerState {
  layout: FarmLayout;
  gridWidth: number;
  gridHeight: number;
  zoneMap: Map<string, ZoneType>;
  buildableSet: Set<string>;
  treePlantSet: Set<string>;
  farmBaseType: ZoneType;
  season: Season;
  buildingDefMap: Map<string, BuildingDef>;
  itemMap: Map<string, Item>;
  treeDefs: TreeDef[];
  setSeason: (s: Season) => void;
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
  setZoneCrop: (zoneId: string, season: Season, cropId: string | null) => void;
  removeZone: (zoneId: string) => void;
  paintPath: (tx: number, ty: number, type: PathType | null) => void;
  /** Fill / erase an entire rectangle of paths in a single undo step. */
  paintPathRect: (rect: TileRect, type: PathType | null) => void;
  placeItem: (itemId: string, x: number, y: number) => void;
  /** Fill a rectangle with items, skipping occupied tiles, in a single undo step. */
  placeItemRect: (rect: TileRect, itemId: string) => void;
  removeItem: (id: string) => void;
  /** Erase all items + trees + paths inside a rectangle in a single undo step. */
  eraseRect: (rect: TileRect) => void;
  updateInterior: (buildingId: string, interior: InteriorLayout) => void;
  placeTree: (treeType: TreeType, x: number, y: number) => void;
  /** Fill a rectangle with trees, skipping occupied tiles, in a single undo step. */
  placeTreeRect: (rect: TileRect, treeType: TreeType, tapperType?: TapperType | null) => void;
  removeTree: (id: string) => void;
  setTreeTapper: (id: string, tapper: TapperType | null) => void;
}

export function useFarmPlanner(): FarmPlannerState {
  const { data, loading } = useGameData();
  const { activeSave } = useUserData();
  const service = useDataService();

  const farmTypeDef = useMemo(() => {
    if (!data || !activeSave) return null;
    const id = activeSave.farmType.replace(/_/g, '-');
    return data.farmTypes.find((f) => f.id === id) ?? null;
  }, [data, activeSave]);

  const gridWidth  = farmTypeDef?.gridWidth  ?? 80;
  const gridHeight = farmTypeDef?.gridHeight ?? 65;

  const zoneMap = useMemo<Map<string, ZoneType>>(() => {
    if (!farmTypeDef) return new Map();
    const map = new Map<string, ZoneType>();

    if (farmTypeDef.tileData) {
      const w = farmTypeDef.gridWidth;
      for (let i = 0; i < farmTypeDef.tileData.length; i++) {
        const zone = TILE_CHARS[farmTypeDef.tileData[i]];
        if (zone && zone !== 'farmable') {
          map.set(`${i % w},${Math.floor(i / w)}`, zone);
        }
      }
      return map;
    }

    for (const zone of farmTypeDef.zones ?? []) {
      for (let zy = zone.y; zy < zone.y + zone.height; zy++) {
        for (let zx = zone.x; zx < zone.x + zone.width; zx++) {
          map.set(`${zx},${zy}`, zone.type);
        }
      }
    }
    return map;
  }, [farmTypeDef]);

  const farmBaseType: ZoneType = farmTypeDef?.baseType ?? 'farmable';

  const buildableSet = useMemo<Set<string>>(() => {
    if (!farmTypeDef?.buildableData) return new Set();
    const w = farmTypeDef.gridWidth;
    const set = new Set<string>();
    for (let i = 0; i < farmTypeDef.buildableData.length; i++) {
      if (farmTypeDef.buildableData[i] === '1') set.add(`${i % w},${Math.floor(i / w)}`);
    }
    return set;
  }, [farmTypeDef]);

  const treePlantSet = useMemo<Set<string>>(() => {
    if (!farmTypeDef?.treePlantData) return new Set();
    const w = farmTypeDef.gridWidth;
    const set = new Set<string>();
    for (let i = 0; i < farmTypeDef.treePlantData.length; i++) {
      if (farmTypeDef.treePlantData[i] === '1') set.add(`${i % w},${Math.floor(i / w)}`);
    }
    return set;
  }, [farmTypeDef]);

  const buildingDefMap = useMemo<Map<string, BuildingDef>>(() => {
    if (!data) return new Map();
    return new Map(data.buildingDefs.map((d) => [d.id, d]));
  }, [data]);

  const itemMap = useMemo<Map<string, Item>>(() => {
    if (!data) return new Map();
    return new Map(data.items.map((i) => [i.cheatId, i]));
  }, [data]);

  const treeDefs: TreeDef[] = data?.treeDefs ?? [];

  const initialLayout = useMemo(
    () => migrateFarmLayout(activeSave?.farmLayout ?? DEFAULT_FARM_LAYOUT),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeSave?.id],
  );

  const [history, setHistory] = useState<FarmLayout[]>([initialLayout]);
  const [historyIdx, setHistoryIdx] = useState(0);

  const layout = history[historyIdx] ?? DEFAULT_FARM_LAYOUT;
  const season = layout.season;

  const pushState = useCallback(
    (next: FarmLayout) => {
      const trimmed = history.slice(0, historyIdx + 1);
      const limited = trimmed.length >= HISTORY_LIMIT ? trimmed.slice(1) : trimmed;
      const newHistory = [...limited, next];
      setHistory(newHistory);
      setHistoryIdx(newHistory.length - 1);
      if (activeSave) {
        service.updateFarmLayout(activeSave.id, next);
      }
    },
    [history, historyIdx, activeSave, service],
  );

  const setSeason = useCallback(
    (s: Season) => pushState({ ...layout, season: s }),
    [layout, pushState],
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
    if (!canPlaceBuilding(x, y, def.width, def.height, zoneMap, farmBaseType, gridWidth, gridHeight, occ, buildableSet.size > 0 ? buildableSet : undefined)) return;
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

  const removeZone = useCallback((zoneId: string) => {
    pushState({ ...layout, zones: layout.zones.filter((z) => z.id !== zoneId) });
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
    if (!canPlaceTree(x, y, zoneMap, farmBaseType, gridWidth, gridHeight, bOcc, iOcc, tOcc)) return;
    pushState({
      ...layout,
      trees: [...layout.trees, { id: crypto.randomUUID(), treeType, x, y }],
    });
  }, [layout, pushState, buildingDefMap, zoneMap, farmBaseType, gridWidth, gridHeight]);

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

  const placeTreeRect = useCallback((rect: TileRect, treeType: TreeType, tapperType?: TapperType | null) => {
    const bOcc   = getBuildingOccupancy(layout.buildings, buildingDefMap);
    const iOcc   = getItemOccupancy(layout.items);
    const tOcc   = getTreeOccupancy(layout.trees);
    const added  = new Set<string>();
    const newTrees: PlacedTree[] = [];
    for (let dy = 0; dy < rect.h; dy++) {
      for (let dx = 0; dx < rect.w; dx++) {
        const tx = rect.x + dx, ty = rect.y + dy;
        const key = `${tx},${ty}`;
        if (!added.has(key) &&
            canPlaceTree(tx, ty, zoneMap, farmBaseType, gridWidth, gridHeight, bOcc, iOcc, tOcc)) {
          added.add(key);
          newTrees.push({ id: crypto.randomUUID(), treeType, x: tx, y: ty, ...(tapperType ? { tapper: tapperType } : {}) });
        }
      }
    }
    if (newTrees.length > 0)
      pushState({ ...layout, trees: [...layout.trees, ...newTrees] });
  }, [layout, pushState, buildingDefMap, zoneMap, farmBaseType, gridWidth, gridHeight]);

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
    buildableSet,
    treePlantSet,
    farmBaseType,
    season,
    buildingDefMap,
    itemMap,
    treeDefs,
    setSeason,
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
    setZoneCrop,
    removeZone,
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
