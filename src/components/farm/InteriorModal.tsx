import { useCallback, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { usePlannerGrid } from '../../hooks/usePlannerGrid';
import type { DrawRect } from '../../hooks/usePlannerGrid';
import type { BuildingDef, Item } from '../../types/game';
import type { PlacedBuilding, InteriorLayout } from '../../types/save';
import { FIXED_FEATURES, getInteriorContext, isItemAllowedInInterior } from '../../data/interiorItems';
import { SpriteIcon } from './SpriteIcon';

const TILE = 16;
const CRAFTABLES_COLS = 8;
const CRAFTABLES_ROWS = 46;

const SHED_DIMS: Record<string, { w: number; h: number; corridor: number; count: number }> = {
  'Shed':     { w: 11, h: 9,  corridor: 5, count: 67  },
  'Big Shed': { w: 17, h: 12, corridor: 8, count: 137 },
};

function generateOptimalLayout(buildingId: string, machineId: string) {
  const d = SHED_DIMS[buildingId];
  if (!d) return [];
  const result: { x: number; y: number; itemId: string }[] = [];
  for (let y = 0; y < d.h; y++) {
    const isAccess = y % 3 === 1;
    for (let x = 0; x < d.w; x++) {
      if (isAccess) {
        if (x === 0 || x === d.w - 1) result.push({ x, y, itemId: machineId });
      } else {
        if (x === d.corridor && y !== 0) continue;
        result.push({ x, y, itemId: machineId });
      }
    }
  }
  return result;
}

interface Props {
  building: PlacedBuilding;
  buildingDef: BuildingDef;
  interior: InteriorLayout;
  allItems: Item[];
  onSave: (layout: InteriorLayout) => void;
  onClose: () => void;
}

export function InteriorModal({ building, buildingDef, interior, allItems, onSave, onClose }: Props) {
  const shedDims = SHED_DIMS[building.buildingId] ?? null;
  const iw = shedDims?.w ?? buildingDef.interiorWidth  ?? 13;
  const ih = shedDims?.h ?? buildingDef.interiorHeight ?? 14;
  const context = getInteriorContext(building.buildingId);

  const [localLayout, setLocalLayout] = useState<InteriorLayout>(() => ({
    items: interior.items ?? [],
    paths: interior.paths ?? [],
  }));

  const validItems = useMemo(
    () => allItems.filter((i) => isItemAllowedInInterior(i.cheatId, context, i.isBigCraftable)),
    [allItems, context],
  );

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [optimalMachineId, setOptimalMachineId] = useState<string>('');

  // ── Commit callback for usePlannerGrid ────────────────────────────────────────
  const handleCommit = useCallback((rect: DrawRect) => {
    if (selectedItemId) {
      setLocalLayout((prev) => {
        const occupancy = new Set(prev.items.map((i) => `${i.x},${i.y}`));
        const newItems: Array<{ id: string; itemId: string; x: number; y: number }> = [];
        for (let dy = 0; dy < rect.h; dy++) {
          for (let dx = 0; dx < rect.w; dx++) {
            const tx = rect.x + dx, ty = rect.y + dy;
            if (tx >= 0 && ty >= 0 && tx < iw && ty < ih && !occupancy.has(`${tx},${ty}`))
              newItems.push({ id: crypto.randomUUID(), itemId: selectedItemId, x: tx, y: ty });
          }
        }
        if (newItems.length === 0) return prev;
        return { ...prev, items: [...prev.items, ...newItems] };
      });
    } else {
      const { x: rx, y: ry, w: rw, h: rh } = rect;
      setLocalLayout((prev) => ({
        ...prev,
        items: prev.items.filter(
          (i) => !(i.x >= rx && i.x < rx + rw && i.y >= ry && i.y < ry + rh),
        ),
      }));
    }
  }, [selectedItemId, iw, ih]);

  // ── Shared grid hook ──────────────────────────────────────────────────────────
  const {
    wrapRef, pan, zoom, isPanning,
    drawRect, isDrawingRect,
    fitToView, svgHandlers,
  } = usePlannerGrid({
    tileSize:            TILE,
    gridWidth:           iw,
    gridHeight:          ih,
    isPanTool:           false,
    allowRightClickPan:  false,  // interior: only middle-click pans
    autoFit:             true,   // fit on open
    noKeyboardShortcuts: true,   // don't steal shortcuts while modal is open
    onCommit: handleCommit,
  });

  // Preview tiles: valid empty tiles within the current drawRect (place mode)
  const previewTiles = useMemo(() => {
    if (!drawRect || !selectedItemId) return [];
    const occupancy = new Set(localLayout.items.map((i) => `${i.x},${i.y}`));
    const result: Array<{ tx: number; ty: number }> = [];
    for (let dy = 0; dy < drawRect.h; dy++) {
      for (let dx = 0; dx < drawRect.w; dx++) {
        const tx = drawRect.x + dx, ty = drawRect.y + dy;
        if (tx >= 0 && ty >= 0 && tx < iw && ty < ih && !occupancy.has(`${tx},${ty}`))
          result.push({ tx, ty });
      }
    }
    return result;
  }, [drawRect, selectedItemId, localLayout.items, iw, ih]);

  const applyOptimalLayout = useCallback(() => {
    if (!optimalMachineId) return;
    const tiles = generateOptimalLayout(building.buildingId, optimalMachineId);
    setLocalLayout((prev) => ({
      ...prev,
      items: tiles.map((t) => ({ id: crypto.randomUUID(), itemId: t.itemId, x: t.x, y: t.y })),
    }));
  }, [optimalMachineId, building.buildingId]);

  const fixedFeatures = FIXED_FEATURES[building.buildingId] ?? [];
  const base          = import.meta.env.BASE_URL;
  const craftablesUrl = `${base}sprites/Craftables.png`;

  const farmW = iw * TILE;
  const farmH = ih * TILE;

  const previewDef = selectedItemId ? validItems.find((i) => i.cheatId === selectedItemId) : null;
  const previewSpriteIdx = previewDef?.spriteSheet === 'Craftables' && previewDef.spriteIndex !== undefined
    ? previewDef.spriteIndex : -1;

  return createPortal(
    <div className="interior-modal-backdrop" onClick={onClose}>
      <div className="interior-modal" onClick={(e) => e.stopPropagation()}>
        <div className="interior-modal__header">
          <h2 className="interior-modal__title">
            {building.label || buildingDef.name} — Interior
          </h2>
          <div className="interior-modal__header-actions">
            <button className="btn btn--sm" onClick={fitToView}>Fit</button>
            <button className="btn btn--sm btn--primary" onClick={() => { onSave(localLayout); onClose(); }}>
              Save &amp; Close
            </button>
            <button className="btn btn--sm" onClick={onClose}>Cancel</button>
          </div>
        </div>

        <div className="interior-modal__body">
          {/* Sidebar */}
          <aside className="interior-modal__sidebar">
            <p className="interior-modal__sidebar-hint">
              Click or drag to place. Deselect to erase.
            </p>
            <button
              className={`interior-modal__item-btn${selectedItemId === null ? ' interior-modal__item-btn--active' : ''}`}
              onClick={() => setSelectedItemId(null)}
            >
              ✕ Deselect (erase mode)
            </button>
            <div className="interior-modal__item-list">
              {validItems.map((item) => (
                <button
                  key={item.cheatId}
                  className={`interior-modal__item-btn${selectedItemId === item.cheatId ? ' interior-modal__item-btn--active' : ''}`}
                  onClick={() => setSelectedItemId(item.cheatId)}
                  title={item.description}
                >
                  {item.spriteSheet && item.spriteIndex !== undefined ? (
                    <SpriteIcon
                      spriteSheet={item.spriteSheet}
                      spriteIndex={item.spriteIndex}
                      isBigCraftable={item.isBigCraftable}
                      size={20}
                    />
                  ) : null}
                  <span>{item.name}</span>
                </button>
              ))}
            </div>

            {/* Optimal layout — sheds only */}
            {shedDims && (
              <div className="interior-modal__optimal">
                <p className="interior-modal__optimal-label">Optimal layout</p>
                <select
                  className="interior-modal__optimal-select"
                  value={optimalMachineId}
                  onChange={(e) => setOptimalMachineId(e.target.value)}
                >
                  <option value="">— pick a machine —</option>
                  {validItems.map((item) => (
                    <option key={item.cheatId} value={item.cheatId}>{item.name}</option>
                  ))}
                </select>
                <button
                  className="btn btn--sm btn--primary interior-modal__optimal-btn"
                  disabled={!optimalMachineId}
                  onClick={applyOptimalLayout}
                >
                  Fill optimally ({shedDims.count})
                </button>
              </div>
            )}
          </aside>

          {/* Canvas */}
          <div ref={wrapRef} className="interior-modal__canvas">
            <svg
              style={{
                width: '100%', height: '100%', display: 'block',
                touchAction: 'none', userSelect: 'none',
                cursor: isPanning ? 'grabbing' : selectedItemId ? 'cell' : 'crosshair',
              }}
              {...svgHandlers}
            >
              <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
                {/* Floor */}
                <rect x={0} y={0} width={farmW} height={farmH} fill="#5a4a3a" />

                {/* Grid */}
                {zoom > 0.35 && (
                  <g stroke="rgba(0,0,0,0.15)" strokeWidth={0.5} shapeRendering="crispEdges">
                    {Array.from({ length: ih + 1 }, (_, i) => (
                      <line key={`h${i}`} x1={0} y1={i * TILE} x2={farmW} y2={i * TILE} />
                    ))}
                    {Array.from({ length: iw + 1 }, (_, i) => (
                      <line key={`v${i}`} x1={i * TILE} y1={0} x2={i * TILE} y2={farmH} />
                    ))}
                  </g>
                )}

                {/* Fixed features */}
                {fixedFeatures.map((ff, fi) => (
                  <g key={fi}>
                    <rect
                      x={ff.x * TILE} y={ff.y * TILE}
                      width={ff.w * TILE} height={ff.h * TILE}
                      fill={ff.color} opacity={0.9}
                    />
                    <text
                      x={(ff.x + ff.w / 2) * TILE} y={(ff.y + ff.h / 2) * TILE}
                      textAnchor="middle" dominantBaseline="middle"
                      fill="white" fontSize={5}
                      style={{ pointerEvents: 'none', fontFamily: 'monospace' }}
                    >
                      {ff.label}
                    </text>
                  </g>
                ))}

                {/* Placed items */}
                {localLayout.items.map((item) => {
                  const def       = validItems.find((i) => i.cheatId === item.itemId);
                  const spriteIdx = def?.spriteSheet === 'Craftables' && def.spriteIndex !== undefined
                    ? def.spriteIndex : -1;

                  return (
                    <g key={item.id} style={{ pointerEvents: 'none' }}>
                      {spriteIdx >= 0 ? (
                        <svg
                          x={item.x * TILE} y={item.y * TILE}
                          width={TILE} height={TILE}
                          overflow="hidden"
                        >
                          <svg
                            x={TILE / 4} y={0}
                            width={TILE / 2} height={TILE}
                            viewBox={`${(spriteIdx % CRAFTABLES_COLS) * 16} ${Math.floor(spriteIdx / CRAFTABLES_COLS) * 32} 16 32`}
                            preserveAspectRatio="none"
                          >
                            <image
                              href={craftablesUrl}
                              x={0} y={0}
                              width={CRAFTABLES_COLS * 16}
                              height={CRAFTABLES_ROWS * 32}
                              imageRendering="pixelated"
                              style={{ pointerEvents: 'none' }}
                            />
                          </svg>
                        </svg>
                      ) : (
                        <>
                          <rect
                            x={item.x * TILE} y={item.y * TILE}
                            width={TILE} height={TILE}
                            fill="rgba(60,40,100,0.8)"
                            stroke="rgba(255,255,255,0.5)"
                            strokeWidth={0.5}
                            rx={1}
                          />
                          <text
                            x={(item.x + 0.5) * TILE} y={(item.y + 0.5) * TILE}
                            textAnchor="middle" dominantBaseline="middle"
                            fill="white" fontSize={4}
                            style={{ pointerEvents: 'none', fontFamily: 'monospace' }}
                          >
                            {(def?.name ?? item.itemId).slice(0, 4)}
                          </text>
                        </>
                      )}
                    </g>
                  );
                })}

                {/* Place-mode: semi-transparent sprites at valid empty tiles */}
                {previewTiles.length > 0 && (
                  <g opacity={0.55} style={{ pointerEvents: 'none' }}>
                    {previewTiles.map(({ tx, ty }) => (
                      previewSpriteIdx >= 0 ? (
                        <svg
                          key={`${tx},${ty}`}
                          x={tx * TILE} y={ty * TILE}
                          width={TILE} height={TILE}
                          overflow="hidden"
                        >
                          <svg
                            x={TILE / 4} y={0}
                            width={TILE / 2} height={TILE}
                            viewBox={`${(previewSpriteIdx % CRAFTABLES_COLS) * 16} ${Math.floor(previewSpriteIdx / CRAFTABLES_COLS) * 32} 16 32`}
                            preserveAspectRatio="none"
                          >
                            <image
                              href={craftablesUrl}
                              x={0} y={0}
                              width={CRAFTABLES_COLS * 16}
                              height={CRAFTABLES_ROWS * 32}
                              imageRendering="pixelated"
                              style={{ pointerEvents: 'none' }}
                            />
                          </svg>
                        </svg>
                      ) : (
                        <rect
                          key={`${tx},${ty}`}
                          x={tx * TILE} y={ty * TILE}
                          width={TILE} height={TILE}
                          fill="rgba(60,40,100,0.8)"
                          stroke="rgba(255,255,255,0.5)"
                          strokeWidth={0.5}
                          rx={1}
                        />
                      )
                    ))}
                  </g>
                )}

                {/* Erase-mode: red overlay over the draw rect */}
                {isDrawingRect && drawRect && !selectedItemId && (
                  <rect
                    x={drawRect.x * TILE} y={drawRect.y * TILE}
                    width={drawRect.w * TILE} height={drawRect.h * TILE}
                    fill="rgba(220,60,60,0.18)"
                    stroke="rgba(220,60,60,0.75)"
                    strokeWidth={0.75}
                    strokeDasharray="4 2"
                    style={{ pointerEvents: 'none' }}
                  />
                )}

                {/* Boundary */}
                <rect
                  x={0} y={0} width={farmW} height={farmH}
                  fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={1 / zoom}
                />
              </g>
            </svg>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
