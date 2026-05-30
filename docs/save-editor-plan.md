# Save Game Editor — Planning Document

> **Status: Future work. Do not implement unless explicitly requested.**
>
> This document captures the research, design thinking, and open questions for a potential full
> Stardew Valley save-game editor feature. It is intentionally detailed so that when the time
> comes, we can start implementation without a separate research phase.

---

## What This Is

A browser-based save file editor: upload your `.sav` file, edit it through a form-driven UI, and
download a modified `.sav` to drop back into your saves folder. Inherently "cheaty" but fun.

This is **distinct** from the companion app's existing save *profile* concept (our lightweight
`SaveFile` format). The editor deals with the **raw SDV XML** and must produce output the game
can load without corruption.

---

## Data Available in Save (Unused Today)

### Player scalars — easy reads, natural form fields

| Field | Type | Notes |
|---|---|---|
| `money` | int | Current gold on hand |
| `maxStamina` | int | Energy cap (increases with Stardrops) |
| `stamina` | float | Current energy |
| `maxHealth` | int | Health cap |
| `health` | int | Current health |
| `houseUpgradeLevel` | int 0–3 | Farmhouse tier |
| `caveChoice` | int 1/2 | 1=mushrooms, 2=fruit bats |
| `totalMoneyEarned` | int | All-time gold |
| `daysPlayed` | int | Total days in game |
| `questsCompleted` | int | Count |
| `qiGems` | int | Special currency |
| `clubCoins` | int | Casino currency |
| `trashCanLevel` | int 0–4 | Trash can upgrade |
| `daysMarried` | int | |
| `favoriteThing` | string | "who do you like" screen |
| `luckLevel` | int | Daily luck |

### Boolean key items / unlocks

`hasSkullKey`, `hasClubCard`, `hasDarkTalisman`, `hasMagicInk`, `hasMagnifyingGlass`,
`hasRustyKey`, `hasSpecialCharm`, `HasTownKey`, `hasUnlockedSkullDoor`, `canUnderstandDwarves`

### Professions

`professions` is a flat `<ArrayOfInt>` of profession IDs chosen at skill levels 5 and 10.
There are two choices per skill at each tier, giving 10 IDs for a fully levelled character.
Would need a reference table (ID 0–29 → name + skill) to present this as a readable UI.

### Crafting recipes

Same structure as `cookingRecipes` — we already parse cooking, this would extend that approach.

### Character appearance

`isMale` (bool), `skin` (int), `hair` (int), `hairstyleColor` (Color XML), `newEyeColor` (Color),
`shirt`/`shirtItem`, `pants`/`pantsColor`, `boots` (Object element), `hat` (Object element),
`leftRing`/`rightRing`, `accessory` (int). All editable via dropdowns + colour pickers.

### Inventory

`items` — 36 slots, each is an `<Item xsi:type="Object">` (or Tool, Weapon, etc.) with `itemId`,
`stack`, `quality`, `name`, `price`, tool `upgradeLevel`, `attachments`, `enchantments`.
Complex to edit safely — item IDs, stack counts, and quality are safe fields; everything else
risks data corruption if malformed.

### Stats / achievements (display-only candidates)

`fishCaught` (item ID → [count, max size]), `basicShipped`, `archaeologyFound`, `mineralsFound`,
`monstersKilled` / `specificMonstersKilled`, `itemsCooked`, `itemsCrafted`, `seedsSown`,
`stepsTaken`, `stoneGathered`, `stumpsChopped`, `dirtHoed`, `weedsEliminated`, `achievements`.
Mostly interesting as a read-only stats dashboard rather than editable fields.

### Mail / events / flags

`mailReceived` — list of string flags that gate story progression, shop unlocks, NPC availability,
building access (bus, boat, bridge, desert, etc.). High-risk to edit without a complete flag
reference. Worth displaying but dangerous to let users freely modify.

`eventsSeen`, `secretNotesSeen` — similar story flags.

### World root fields

`mine_lowestLevelReached` (skull cavern deepest floor), `lostBooksFound`, `farmPerfect`,
`worldStateIDs` (misc world flags), `raccoonBundles`, `skullCavesDifficulty`, `minesDifficulty`,
`shippingBin` (pending overnight items).

### Location data (complex)

- **Farm**: `animals` (FarmAnimal list: name, type, hearts, produce, age, mood), `hoeDirt` (actual
  crops planted with growth stage), `objects` (chests + contents, machines + in-progress items)
- **Greenhouse**: crops, state
- **IslandWest**: crops, buildings, resort state
- **CommunityCenter**: `areasComplete` (6 room booleans) — complementary to the bundle flags we
  already parse

---

## UI Sections (Proposed)

1. **Profile** — money, stamina/health, house level, cave choice, pet type/name, favourite thing,
   days played, Qi gems, club coins, trash can level
2. **Character** — appearance editor (skin tone, hair, eye colour, clothes, accessories), gender
3. **Professions** — per-skill profession choice at levels 5 and 10 (needs ID lookup table)
4. **Keys & unlocks** — boolean flag checkboxes (skull key, club card, rusty key, etc.)
5. **Farm planner** — reuse existing planner component; see integration concerns below
6. **Animals** — list of farm animals, editable name/hearts/produce
7. **Inventory** — 36-slot grid, safe fields: item ID picker, stack count, quality dropdown
8. **Crafting recipes** — checklist, same pattern as cooking recipes display
9. **Stats** — read-only display of fishing/shipping/monster/farming stats
10. **Download** — generate modified XML and trigger browser download

---

## Architectural Concerns

These are the hard problems. This is why the feature needs serious pre-implementation design.

### 1. Round-trip XML fidelity

The game's save serializer (C# `XmlSerializer` with custom handling) produces XML with specific
quirks that must be preserved exactly:

- `xsi:type` attributes on polymorphic elements (`<Item xsi:type="Object">`, etc.)
- Namespace declaration on root: `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"`
- Element ordering within objects matters to some deserializers
- Some elements use `nil="true"` for nulls: `<spouse xsi:nil="true" />`
- Arrays use wrapper elements with specific names (`<ArrayOfBoolean>`, etc.)
- Integer keys in dictionaries: `<item><key><int>0</int></key><value>...</value></item>`

Strategy: **parse only what we edit, write back by string-patching the original XML** rather than
full deserialise → reserialise. Safer, simpler, far less likely to corrupt data. Each editor
section targets specific element paths and does surgical string/DOM replacements.

### 2. No direct file write — download pattern

Browsers cannot write to the filesystem directly. The workflow must be:

1. User uploads save (already done — `SaveFileUpload` component)
2. User edits fields in the editor
3. User clicks "Download modified save"
4. Browser downloads the modified XML as `Treeham_439539725` (same filename)
5. User manually replaces their save in the saves folder

This must be **very clearly communicated** in the UI. Users need to understand where their saves
folder is and the consequences of replacing a file.

### 3. Save corruption risk

Any malformed XML output will crash the game on load (shows "corrupted save" error). Mitigations:

- **Always download, never overwrite** — user has the original file until they choose to replace it
- **Prominent backup warning** in the UI before download
- **Validate XML before offering download** — run through `DOMParser` and check for `parsererror`
- Prefer the string-patching strategy (concern #1) to minimise diff surface

### 4. Separation from the companion save profile

The app currently has two distinct "save" concepts:
- **Companion profile** (`SaveFile`) — our lightweight format in localStorage, used throughout the
  app for personalisation (quest progress, bundle tracking, farm planner state, etc.)
- **SDV save file** — the raw 4MB XML the game reads

The editor introduces a third state: **in-memory edited SDV save**, which is the full XML held
while the user is editing. These three must never be conflated:

- The companion profile and the SDV save are **separate concerns** — importing an SDV save
  populates the companion profile, but they diverge the moment the user edits either one
- The editor should live at a distinct route (e.g. `/editor`) clearly separate from `/saves`
- Consider whether the editor should even share the main nav, or be a separate "mode"

### 5. Memory & storage

The raw SDV XML is ~4MB. The current approach stores all user data in a single localStorage key.
`localStorage` has a ~5–10MB limit and is synchronous.

Options:
- **Don't persist the raw XML** — hold it only in React state during the session; user re-uploads
  each visit (acceptable given the workflow is upload → edit → download)
- **IndexedDB** — if we want persistence across sessions, IndexedDB handles large blobs and is
  async. Would require a new storage adapter in `DataService`

Recommended: don't persist the raw XML. The editing session is inherently temporary.

### 6. Routing & navigation

Options:
- **`/editor`** — top-level route, separate nav entry, clearly its own section
- **`/editor/:saveName`** — filename in URL so deep-linking to sections works
- **Nested under `/saves`** — confuses the existing concept
- **Separate app entirely** — cleanest separation but loses component reuse

Recommended: `/editor` as a top-level route with its own nav section, clearly marked as
"Save Editor (Advanced)". Reuse components (`FarmPlanner`, `SpriteIcon`, `Panel`) but maintain
no shared state with the companion profile routes.

### 7. Farm planner integration

The existing farm planner works on our `FarmLayout` type (buildings, paths, trees, zones).
An editor integration would need to:

- Parse the full farm state from the SDV save on upload (we already do most of this)
- Display it in the farm planner as the starting state
- On "save layout", serialise the planner state back into the SDV XML format:
  - `<buildings>` — one `<Building>` per user-placed building
  - `<terrainFeatures>` — Flooring tiles and trees
  - `<objects>` — fences

The serialisation direction (our types → SDV XML) is the hard new part. The farm planner also
currently omits crop data (`hoeDirt`) entirely — that would be a new layer if we want it.

### 8. Version coupling risk

The companion app is relatively resilient to SDV version changes — if a schedule changes, the app
just shows outdated data. An editor with write capability is far more tightly coupled: wrong
element names, missing required fields, or changed serialisation format in a new SDV version will
corrupt saves.

Mitigation: keep editable fields conservative and well-tested against real saves. The version gate
(1.6 only) in `parseSdvSave` should also be applied to the editor.

### 9. Testing strategy

Testing that an edited save loads correctly requires actually running SDV. This is impractical in
CI. Options:

- **Manual test protocol**: a checklist of "edit X, download, load in game, verify" steps run
  before any editor code ships
- **Schema validation**: validate the output XML structure against a known-good save before
  offering download (catch structural errors without needing the game)
- **Diff testing**: compare original vs edited XML — changes should be confined to the fields the
  user touched, nothing else

---

## Implementation Phases (When Authorised)

These are sequential — each phase is independently shippable.

| Phase | Scope |
|---|---|
| **0. Infrastructure** | New `/editor` route, `EditorContext` holding raw XML + parsed editable state, upload flow (reuse `SaveFileUpload`), download button with validation |
| **1. Profile tab** | money, stamina, health, house level, cave choice, pet, favourite thing — all simple scalar edits |
| **2. Keys & flags** | Boolean key items as checkboxes |
| **3. Character appearance** | Skin/hair/eye/clothing fields |
| **4. Professions** | Profession choice grid per skill — needs ID reference table |
| **5. Farm planner roundtrip** | Wire existing planner to editor state; add serialise-back-to-XML direction |
| **6. Animals** | Farm animal list editor |
| **7. Inventory** | 36-slot item editor (conservative: ID + quantity + quality only) |
| **8. Crafting recipes** | Recipe checklist |
| **9. Stats dashboard** | Read-only stats display |

---

## Open Questions

- Should the editor be clearly opt-in/hidden (e.g. `/editor` not in the main nav, only accessible
  via a link on the Saves page)? Or a first-class nav entry?
- Do we want a "simulate this save in the companion" button that populates the companion profile
  from the current editor state? Or keep them fully separate?
- Should the editor support Joja route saves differently (no community centre, different world
  state flags)?
- How do we handle multiplayer saves (farmhands present)? Parse farmhand data separately or
  ignore it?
- Mods can add new item IDs, building types, and even new save fields. How do we handle saves from
  modded games gracefully without corrupting the modded data on round-trip?

---

## Files This Feature Will Touch / Create

```
src/
  pages/
    EditorPage.tsx            ← main shell, tab navigation
  contexts/
    EditorContext.tsx          ← raw XML + parsed mutable state, download logic
  utils/
    sdvSaveWriter.ts           ← XML patching / serialisation (new, inverse of parser)
  components/
    editor/
      EditorProfileTab.tsx
      EditorFlagsTab.tsx
      EditorAppearanceTab.tsx
      EditorProfessionsTab.tsx
      EditorFarmTab.tsx        ← wraps FarmPlanner
      EditorAnimalsTab.tsx
      EditorInventoryTab.tsx
      EditorRecipesTab.tsx
      EditorStatsTab.tsx
  styles/
    _editor.scss
```

`sdvSaveParser.ts` will need an audit pass to ensure all parsed fields have a clear write-back
path in `sdvSaveWriter.ts`.

---

*Last updated: 2026-05-30*
