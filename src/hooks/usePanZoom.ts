import { useState, useCallback, useRef } from 'react';

export interface UsePanZoomReturn {
  pan: { x: number; y: number };
  zoom: number;
  isPanning: boolean;
  handleWheel: (e: React.WheelEvent<SVGSVGElement>) => void;
  startPan: (clientX: number, clientY: number) => void;
  movePan: (clientX: number, clientY: number) => void;
  endPan: () => void;
  nudgePan: (dx: number, dy: number) => void;
  fitToView: (gridW: number, gridH: number, tileSize: number, containerW: number, containerH: number) => void;
}

const MIN_ZOOM = 0.12;
const MAX_ZOOM = 8;

export function usePanZoom(): UsePanZoomReturn {
  const [pz, setPz] = useState({ pan: { x: 0, y: 0 }, zoom: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    setPz((prev) => {
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev.zoom * factor));
      const ratio = newZoom / prev.zoom;
      return {
        zoom: newZoom,
        pan: {
          x: cursorX - (cursorX - prev.pan.x) * ratio,
          y: cursorY - (cursorY - prev.pan.y) * ratio,
        },
      };
    });
  }, []);

  const startPan = useCallback((clientX: number, clientY: number) => {
    lastPos.current = { x: clientX, y: clientY };
    setIsPanning(true);
  }, []);

  const movePan = useCallback((clientX: number, clientY: number) => {
    const dx = clientX - lastPos.current.x;
    const dy = clientY - lastPos.current.y;
    lastPos.current = { x: clientX, y: clientY };
    setPz((prev) => ({
      ...prev,
      pan: { x: prev.pan.x + dx, y: prev.pan.y + dy },
    }));
  }, []);

  const endPan = useCallback(() => {
    setIsPanning(false);
  }, []);

  const nudgePan = useCallback((dx: number, dy: number) => {
    setPz((prev) => ({ ...prev, pan: { x: prev.pan.x + dx, y: prev.pan.y + dy } }));
  }, []);

  const fitToView = useCallback((
    gridW: number, gridH: number, tileSize: number, containerW: number, containerH: number,
  ) => {
    if (!containerW || !containerH) return;
    const farmW = gridW * tileSize;
    const farmH = gridH * tileSize;
    const newZoom = Math.min(containerW / farmW, containerH / farmH) * 0.92;
    const panX = (containerW - farmW * newZoom) / 2;
    const panY = (containerH - farmH * newZoom) / 2;
    setPz({ zoom: newZoom, pan: { x: panX, y: panY } });
  }, []);

  return {
    ...pz,
    isPanning,
    handleWheel,
    startPan,
    movePan,
    endPan,
    nudgePan,
    fitToView,
  };
}
