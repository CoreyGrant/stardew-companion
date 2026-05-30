"""
render-layers.py

Parses Farm.tmx and renders two PNG images:
  out/farm_back_layer.png     — Back layer tile classification (raw, no post-processing)
  out/farm_buildings_layer.png — Buildings layer (non-zero tiles only)

Tile size: 16x16 px per grid square.
"""

import xml.etree.ElementTree as ET
import os, re
from PIL import Image, ImageDraw

import sys
FARM_FILE = sys.argv[1] if len(sys.argv) > 1 else "Farm.tmx"
TMX_PATH  = f"C:/Program Files (x86)/Steam/steamapps/common/Stardew Valley/Content (unpacked)/Maps/{FARM_FILE}"
FARM_SLUG = FARM_FILE.replace(".tmx", "").replace("Farm_", "").lower()
if FARM_SLUG == "farm":
    FARM_SLUG = "standard"
OUT_DIR   = os.path.join(os.path.dirname(__file__), "..", "public", "layer-debug")
TILE_PX   = 16

os.makedirs(OUT_DIR, exist_ok=True)

# ── Colours ───────────────────────────────────────────────────────────────────

COLORS = {
    'w':    (42,  114, 184),   # water           — blue
    'i':    (46,   32,  22),   # impassable/rock  — dark brown
    'f':    (61,  107,  66),   # farmable         — green
    'g':    (90,  128,  64),   # grass            — lighter green
    'p':    (200, 169, 107),   # path             — tan
    's':    (196, 160,  94),   # sand             — sand
    'void': (20,   20,  20),   # GID=0 / empty    — near-black
    'unk':  (120, 120, 120),   # unclassified     — grey
    'b':    (107,  79,  20),   # buildings layer  — brown
    'off':  (10,   10,  10),   # buildings=0      — off-black
}

LEGEND_BACK = [
    ('w',    'Water (w)'),
    ('i',    'Impassable / rock (i)'),
    ('f',    'Farmable / diggable (f)'),
    ('g',    'Grass (g)'),
    ('p',    'Path tiles (p)'),
    ('s',    'Sand (s)'),
    ('void', 'Empty tile (GID = 0)'),
    ('unk',  'Unclassified (no tile property)'),
]

LEGEND_BUILDINGS = [
    ('b',   'Buildings layer — non-zero tile'),
    ('off', 'Buildings layer — empty (GID = 0)'),
]

# ── Parse TMX ─────────────────────────────────────────────────────────────────

tree = ET.parse(TMX_PATH)
root = tree.getroot()

W = int(root.attrib['width'])
H = int(root.attrib['height'])
print(f"Map size: {W}×{H}")

# Build GID → zone map from tileset properties
gid_zone = {}

for ts in root.findall('tileset'):
    firstgid  = int(ts.attrib['firstgid'])
    tilecount = int(ts.attrib.get('tilecount', '64'))
    ts_name   = ts.attrib.get('name', '').lower()

    # Entire 'paths' tileset → 'p'
    if ts_name == 'paths':
        for i in range(tilecount):
            gid_zone[firstgid + i] = 'p'

    for tile in ts.findall('tile'):
        gid = firstgid + int(tile.attrib['id'])
        props = {}
        for prop in tile.findall('.//property'):
            props[prop.attrib['name'].lower()] = prop.attrib.get('value', '').lower()

        water     = props.get('water')    in ('t', 'true')
        passable_f= props.get('passable') in ('f', 'false')
        is_stone  = props.get('type')     == 'stone'
        is_grass  = props.get('type')     == 'grass'
        is_dirt   = props.get('type')     == 'dirt'
        diggable  = props.get('diggable') in ('t', 'true')

        if water:                  gid_zone[gid] = 'w'
        elif passable_f or is_stone: gid_zone[gid] = 'i'
        elif is_grass:             gid_zone[gid] = 'g'
        elif diggable or is_dirt:  gid_zone[gid] = 'f'
        # else: no property hit → 'unk' below

# Helper: parse a layer's CSV data
def parse_layer(layer_el):
    data_el = layer_el.find('data')
    raw = (data_el.text or '').strip()
    return [int(x) for x in re.split(r'[\s,]+', raw) if x]

# Extract layers
layers = {l.attrib['name']: l for l in root.findall('layer')}
back_gids      = parse_layer(layers['Back'])
buildings_gids = parse_layer(layers.get('Buildings', layers['Back']))  # fallback safe

assert len(back_gids) == W * H, f"Back layer size mismatch: {len(back_gids)} vs {W*H}"

# ── Classify Back layer ───────────────────────────────────────────────────────
# Raw classification — NO water expansion, NO buildings override

back_zones = []
for gid in back_gids:
    if gid == 0:
        back_zones.append('void')
    else:
        back_zones.append(gid_zone.get(gid, 'unk'))

# ── Render helper ─────────────────────────────────────────────────────────────

LEGEND_H    = 200
LEGEND_PAD  = 12
SWATCH_SIZE = 20
LINE_H      = 28

def render(zones, legend_entries, filename):
    farm_w = W * TILE_PX
    farm_h = H * TILE_PX
    img_w  = farm_w
    img_h  = farm_h + LEGEND_H

    img  = Image.new('RGB', (img_w, img_h), (30, 20, 15))
    draw = ImageDraw.Draw(img)

    # Draw tiles
    for idx, zone in enumerate(zones):
        tx = idx % W
        ty = idx // W
        px = tx * TILE_PX
        py = ty * TILE_PX
        draw.rectangle([px, py, px + TILE_PX - 1, py + TILE_PX - 1], fill=COLORS[zone])

    # Legend
    ly = farm_h + LEGEND_PAD
    lx = LEGEND_PAD
    col_w = img_w // 2

    for i, (key, label) in enumerate(legend_entries):
        cx = lx + (i % 2) * col_w
        cy = ly + (i // 2) * LINE_H
        draw.rectangle([cx, cy, cx + SWATCH_SIZE - 1, cy + SWATCH_SIZE - 1], fill=COLORS[key])
        draw.rectangle([cx, cy, cx + SWATCH_SIZE - 1, cy + SWATCH_SIZE - 1], outline=(200, 200, 200))
        draw.text((cx + SWATCH_SIZE + 6, cy + 2), label, fill=(220, 210, 190))

    out_path = os.path.join(OUT_DIR, filename)
    img.save(out_path)
    print(f"  Saved: {out_path}  ({img_w}×{img_h})")
    return out_path

# ── Render Back layer ─────────────────────────────────────────────────────────

print("Rendering Back layer …")
render(back_zones, LEGEND_BACK, f"{FARM_SLUG}_back_layer.png")

# ── Render Buildings layer ────────────────────────────────────────────────────

print("Rendering Buildings layer …")
buildings_zones = ['b' if gid != 0 else 'off' for gid in buildings_gids]
render(buildings_zones, LEGEND_BUILDINGS, f"{FARM_SLUG}_buildings_layer.png")

print("Done.")

# ── Render final merged tileData from gamedata.json ───────────────────────────

import json

print("Rendering final merged tileData …")
gd_path = os.path.join(os.path.dirname(__file__), "..", "public", "gamedata.json")
with open(gd_path, encoding="utf-8") as f:
    gd = json.load(f)

FARM_ID_MAP = {"standard": "standard", "fishing": "riverland", "foraging": "forest",
               "mining": "hilltop", "combat": "wilderness", "island": "beach",
               "fourcorners": "four-corners", "ranching": "meadowlands"}
farm_id = FARM_ID_MAP.get(FARM_SLUG, FARM_SLUG)
standard = next((ft for ft in gd["farmTypes"] if ft["id"] == farm_id),
                next(ft for ft in gd["farmTypes"] if ft["id"] == "standard"))
td = standard["tileData"]
FW = standard["gridWidth"]
FH = standard["gridHeight"]

TILE_CHARS = {
    'f': 'f', 'w': 'w', 'i': 'i', 'b': 'b', 'p': 'p', 's': 's', 'g': 'g',
}
LEGEND_MERGED = [
    ('w',    'Water (w)'),
    ('b',    'Building zone / border (b)'),
    ('i',    'Impassable (i)'),
    ('f',    'Farmable (f)'),
    ('g',    'Grass (g)'),
    ('p',    'Path (p)'),
    ('s',    'Sand (s)'),
]

merged_zones = [TILE_CHARS.get(c, 'unk') for c in td]

farm_w2 = FW * TILE_PX
farm_h2 = FH * TILE_PX
img2 = Image.new('RGB', (farm_w2, farm_h2 + LEGEND_H), (30, 20, 15))
draw2 = ImageDraw.Draw(img2)

for idx, zone in enumerate(merged_zones):
    tx = idx % FW
    ty = idx // FW
    px = tx * TILE_PX
    py = ty * TILE_PX
    draw2.rectangle([px, py, px + TILE_PX - 1, py + TILE_PX - 1], fill=COLORS[zone])

ly = farm_h2 + LEGEND_PAD
lx = LEGEND_PAD
col_w2 = farm_w2 // 2
for i, (key, label) in enumerate(LEGEND_MERGED):
    cx = lx + (i % 2) * col_w2
    cy = ly + (i // 2) * LINE_H
    draw2.rectangle([cx, cy, cx + SWATCH_SIZE - 1, cy + SWATCH_SIZE - 1], fill=COLORS[key])
    draw2.rectangle([cx, cy, cx + SWATCH_SIZE - 1, cy + SWATCH_SIZE - 1], outline=(200, 200, 200))
    draw2.text((cx + SWATCH_SIZE + 6, cy + 2), label, fill=(220, 210, 190))

out2 = os.path.join(OUT_DIR, f"{FARM_SLUG}_merged_tiledata.png")
img2.save(out2)
print(f"  Saved: {out2}  ({farm_w2}×{farm_h2 + LEGEND_H})")
