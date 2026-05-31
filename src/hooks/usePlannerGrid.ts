/**
 * usePlannerGrid
 *
 * Shared hook that encapsulates all SVG-grid interaction logic used by
 * FarmPlannerPage, IslandFarmPlannerPage, and InteriorModal:
 *   - Pan / zoom (via usePanZoom)
 *   - Auto-fit on first meaningful render
 *   - Keyboard shortcuts (WASD/arrow pan, Ctrl+Z undo/redo, Escape)
 *   - clientToTile coordinate conversion
 *   - Unified rect-draw state machine (drawStart → drawRect → onCommit)
 *   - SVG pointer event routing
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePanZoom } from './usePanZoom';

export type DrawRect = { x: number; y: number; w: number; h: number };

export interface UsePlannerGridOptions {
  tileSize: number;
  gridWidth: number;
  gridHeight: number;

  /**
   * True when the current tool is "select" — left-click pans instead of drawing.
   */
  isPanTool: boolean;

  /**
   * When true (default), right-click (button 2) also pans.
   * Middle-click (button 1) always pans regardless.
   */
  allowRightClickPan?: boolean;

  /** Delays auto-fit until false. */
  loading?: boolean;

  /** If true, auto-fits the grid on first render after data is ready. */
  autoFit?: boolean;

  /**
   * Called on pointer-down in a non-pan context (tile coords supplied).
   * If the callback returns `true`, the drawRect state machine is suppressed —
   * useful for tools like "place-building" that act immediately.
   */
  onToolDown?: (tx: number, ty: number) => boolean | void;

  /**
   * Called on pointer-up when a drawRect was started.
   * The rect is the finalised bounding box in tile coordinates.
   */
  onCommit?: (rect: DrawRect) => void;

  onUndo?: () => void;
  onRedo?: () => void;
  onEscape?: () => void;

  /**
   * Called at the very start of every pointer-down event, before any other
   * logic (e.g. close a context menu).
   */
  onPointerDownBefore?: () => void;

  /** Skip the window keydown/keyup listeners (e.g. inside a modal). */
  noKeyboardShortcuts?: boolean;
}

export interface UsePlannerGridReturn {
  wrapRef: React.RefObject<HTMLDivElement>;
  pan: { x: number; y: number };
  zoom: number;
  isPanning: boolean;
  hoverTile: { tx: number; ty: number } | null;
  drawRect: DrawRect | null;
  isDrawingRect: boolean;
  fitToView: () => void;
  clientToTile: (clientX: number, clientY: number) => { tx: number; ty: number } | null;
  svgHandlers: {
    onWheel: (e: React.WheelEvent<SVGSVGElement>) => void;
    onPointerDown: (e: React.PointerEvent<SVGSVGElement>) => void;
    onPointerMove: (e: React.PointerEvent<SVGSVGElement>) => void;
    onPointerUp: (e: React.PointerEvent<SVGSVGElement>) => void;
    onContextMenu: (e: React.MouseEvent<SVGSVGElement>) => void;
  };
}

const PAN_SPEED = 8;
const PAN_KEYS = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'w', 'a', 's', 'd', 'W', 'A', 'S', 'D',
]);

export function usePlannerGrid({
  tileSize,
  gridWidth,
  gridHeight,
  isPanTool,
  allowRightClickPan = true,
  loading = false,
  autoFit = false,
  onToolDown,
  onCommit,
  onUndo,
  onRedo,
  onEscape,
  onPointerDownBefore,
  noKeyboardShortcuts = false,
}: UsePlannerGridOptions): UsePlannerGridReturn {
  const {
    pan, zoom, isPanning,
    handleWheel, zoomAt, startPan, movePan, endPan, nudgePan,
    fitToView: rawFitToView,
  } = usePanZoom();

  // Container div ref — attach to the wrapping <div> around the SVG
  const wrapRef = useRef<HTMLDivElement>(null);
  const hasFit  = useRef(false);

  // Rect-draw state
  const drawStart = useRef<{ tx: number; ty: number } | null>(null);
  const [drawRect, setDrawRect] = useState<DrawRect | null>(null);
  // Keep a stable ref of drawRect for use in pointer-up callback
  const drawRectRef = useRef<DrawRect | null>(null);
  drawRectRef.current = drawRect;

  // Pan mode flag (middle/right-click or select-tool left-click)
  const panMode = useRef(false);

  // Multi-touch tracking for pinch-to-zoom
  const activePointers = useRef(new Map<number, { x: number; y: number }>());
  const lastPinchDist  = useRef<number | null>(null);
  const isPinching     = useRef(false);

  // Hover tile
  const [hoverTile, setHoverTile] = useState<{ tx: number; ty: number } | null>(null);

  // ── Fit to view ──────────────────────────────────────────────────────────────
  const fitToView = useCallback(() => {
    if (!wrapRef.current) return;
    const { width, height } = wrapRef.current.getBoundingClientRect();
    rawFitToView(gridWidth, gridHeight, tileSize, width, height);
  }, [rawFitToView, gridWidth, gridHeight, tileSize]);

  // Auto-fit once, after data is ready
  useEffect(() => {
    if (!autoFit) return;
    if (hasFit.current || loading || !wrapRef.current || !gridWidth) return;
    const { width, height } = wrapRef.current.getBoundingClientRect();
    if (!width || !height) return;
    rawFitToView(gridWidth, gridHeight, tileSize, width, height);
    hasFit.current = true;
  });

  // ── Keyboard shortcuts ───────────────────────────────────────────────────────
  const heldKeys = useRef(new Set<string>());
  const rafRef   = useRef<number | null>(null);

  // Keep stable refs for the callbacks so the keydown listener doesn't need to
  // be torn-down and re-added every time they change.
  const onUndoRef  = useRef(onUndo);
  const onRedoRef  = useRef(onRedo);
  const onEscRef   = useRef(onEscape);
  onUndoRef.current  = onUndo;
  onRedoRef.current  = onRedo;
  onEscRef.current   = onEscape;
  const nudgePanRef  = useRef(nudgePan);
  nudgePanRef.current = nudgePan;

  useEffect(() => {
    if (noKeyboardShortcuts) return;

    const tick = () => {
      const keys = heldKeys.current;
      let dx = 0, dy = 0;
      if (keys.has('ArrowLeft')  || keys.has('a') || keys.has('A')) dx += PAN_SPEED;
      if (keys.has('ArrowRight') || keys.has('d') || keys.has('D')) dx -= PAN_SPEED;
      if (keys.has('ArrowUp')    || keys.has('w') || keys.has('W')) dy += PAN_SPEED;
      if (keys.has('ArrowDown')  || keys.has('s') || keys.has('S')) dy -= PAN_SPEED;
      if (dx !== 0 || dy !== 0) nudgePanRef.current(dx, dy);
      rafRef.current = requestAnimationFrame(tick);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === 'z') {
        e.preventDefault();
        e.shiftKey ? onRedoRef.current?.() : onUndoRef.current?.();
        return;
      }
      if (e.key === 'Escape') { onEscRef.current?.(); return; }
      if (PAN_KEYS.has(e.key)) {
        e.preventDefault();
        heldKeys.current.add(e.key);
        if (!rafRef.current) rafRef.current = requestAnimationFrame(tick);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      heldKeys.current.delete(e.key);
      if (heldKeys.current.size === 0 && rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    };
  }, [noKeyboardShortcuts]);

  // ── Coordinate helper ────────────────────────────────────────────────────────
  // Must read pan/zoom from refs to keep clientToTile stable (used in pointer move)
  const panRef  = useRef(pan);
  const zoomRef = useRef(zoom);
  panRef.current  = pan;
  zoomRef.current = zoom;

  const clientToTile = useCallback((clientX: number, clientY: number) => {
    if (!wrapRef.current) return null;
    const rect = wrapRef.current.getBoundingClientRect();
    return {
      tx: Math.floor((clientX - rect.left  - panRef.current.x) / (zoomRef.current * tileSize)),
      ty: Math.floor((clientY - rect.top   - panRef.current.y) / (zoomRef.current * tileSize)),
    };
  }, [tileSize]);

  // Stable ref for onCommit / onToolDown so pointer handlers don't need to be
  // recreated when these callbacks change.
  const onCommitRef   = useRef(onCommit);
  const onToolDownRef = useRef(onToolDown);
  onCommitRef.current   = onCommit;
  onToolDownRef.current = onToolDown;

  // ── SVG pointer handlers ─────────────────────────────────────────────────────
  const handlePointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);

    // Track every pointer (finger / stylus / mouse button)
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Two+ fingers → pinch mode; cancel any in-progress pan or draw
    if (activePointers.current.size >= 2) {
      isPinching.current = true;
      panMode.current = false;
      drawStart.current = null;
      setDrawRect(null);
      const pts = [...activePointers.current.values()];
      lastPinchDist.current = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      return;
    }

    // Single pointer — normal handling
    onPointerDownBefore?.();

    // Middle or right click → pan
    if (e.button === 1 || (allowRightClickPan && e.button === 2)) {
      panMode.current = true;
      startPan(e.clientX, e.clientY);
      return;
    }

    if (e.button !== 0) return;

    // Select tool (or forced pan) → pan on left click
    if (isPanTool) {
      panMode.current = true;
      startPan(e.clientX, e.clientY);
      return;
    }

    const tile = clientToTile(e.clientX, e.clientY);
    if (!tile) return;
    const { tx, ty } = tile;

    // Let caller handle the down — if they return true, skip rect draw
    const suppressed = onToolDownRef.current?.(tx, ty);
    if (suppressed) return;

    // Start rect draw
    drawStart.current = { tx, ty };
    setDrawRect({ x: tx, y: ty, w: 1, h: 1 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPanTool, allowRightClickPan, startPan, clientToTile, onPointerDownBefore]);

  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    // Always keep our pointer map current
    if (activePointers.current.has(e.pointerId)) {
      activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    // Pinch zoom — runs whenever 2 pointers are active
    if (isPinching.current && activePointers.current.size >= 2) {
      const pts = [...activePointers.current.values()];
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      if (lastPinchDist.current !== null && dist > 0 && wrapRef.current) {
        const factor = dist / lastPinchDist.current;
        const rect   = wrapRef.current.getBoundingClientRect();
        const midX   = (pts[0].x + pts[1].x) / 2 - rect.left;
        const midY   = (pts[0].y + pts[1].y) / 2 - rect.top;
        zoomAt(factor, midX, midY);
      }
      lastPinchDist.current = dist;
      return;
    }

    const tile = clientToTile(e.clientX, e.clientY);
    setHoverTile(tile);

    if (panMode.current) {
      movePan(e.clientX, e.clientY);
      return;
    }

    if ((e.buttons & 1) && drawStart.current && tile) {
      const { tx: sx, ty: sy } = drawStart.current;
      const { tx, ty } = tile;
      setDrawRect({
        x: Math.min(sx, tx),
        y: Math.min(sy, ty),
        w: Math.abs(tx - sx) + 1,
        h: Math.abs(ty - sy) + 1,
      });
    }
  }, [clientToTile, movePan, zoomAt]);

  const handlePointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    activePointers.current.delete(e.pointerId);

    // Exiting pinch (one finger lifts)
    if (isPinching.current) {
      if (activePointers.current.size < 2) {
        isPinching.current = false;
        lastPinchDist.current = null;
        endPan();
      }
      return;
    }

    if (panMode.current) {
      panMode.current = false;
      endPan();
      return;
    }

    if (drawStart.current && drawRectRef.current) {
      onCommitRef.current?.(drawRectRef.current);
    }

    drawStart.current = null;
    setDrawRect(null);
  }, [endPan]);

  const handleContextMenu = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    e.preventDefault();
  }, []);

  return {
    wrapRef,
    pan,
    zoom,
    isPanning,
    hoverTile,
    drawRect,
    isDrawingRect: drawRect !== null,
    fitToView,
    clientToTile,
    svgHandlers: {
      onWheel: handleWheel,
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onContextMenu: handleContextMenu,
    },
  };
}
