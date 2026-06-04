export type Season = 'spring' | 'summer' | 'fall' | 'winter';
export type Weather = 'sunny' | 'rainy' | 'stormy' | 'snowy' | 'windy';
export type GiftTaste = 'loved' | 'liked' | 'neutral' | 'disliked' | 'hated';
export type QuestType = 'story' | 'community_center' | 'special_order' | 'joja' | 'misc';
export type CommunityRoom =
  | 'crafts_room'
  | 'pantry'
  | 'fish_tank'
  | 'boiler_room'
  | 'bulletin_board'
  | 'vault';
export type ItemCategory =
  | 'crop'
  | 'seed'
  | 'forage'
  | 'fish'
  | 'mineral'
  | 'gem'
  | 'artifact'
  | 'artisan'
  | 'food'
  | 'equipment'
  | 'resource'
  | 'animal_product'
  | 'flower'
  | 'machine'
  | 'decoration'
  | 'book'
  | 'other';

export interface ItemRef {
  id: string;
  name: string;
}

export interface ScheduleCondition {
  season?: Season | Season[];
  weather?: Weather | Weather[];
  minYear?: number;
  married?: boolean;
  heartLevel?: number;
  event?: string;
  /** Specific day of the season (1–28). */
  day?: number;
  /** Day-of-week abbreviation matching Stardew schedule keys: Mon/Tue/Wed/Thu/Fri/Sat/Sun. */
  dayOfWeek?: string;
}

export interface ScheduleEntry {
  /** 24h-style integer: 600 = 6:00am, 1000 = 10:00am, 1400 = 2:00pm, 2200 = 10:00pm */
  time: number;
  location: string;
  description?: string;
}

export interface ScheduleVariant {
  id: string;
  label: string;
  /** 'normal' for regular schedule variants; 'marriage' for post-marriage variants. */
  type?: 'normal' | 'marriage';
  /** Explicit conditions. When absent, conditions are derived from the `id` at runtime. */
  conditions?: ScheduleCondition;
  entries: ScheduleEntry[];
}

export interface GiftPreferences {
  loved: ItemRef[];
  liked: ItemRef[];
  neutral: ItemRef[];
  disliked: ItemRef[];
  hated: ItemRef[];
}

export interface NPC {
  id: string;
  name: string;
  birthday: { season: Season; day: number };
  marriageable: boolean;
  homeLocation: string;
  address: string;
  description: string;
  gifts: GiftPreferences;
  schedules: ScheduleVariant[];
  portrait?: string;
}

export interface CropQualityDistribution {
  normal: number;
  silver: number;
  gold: number;
  iridium: number;
}

export interface Crop {
  id: string;
  /** Human-readable crop name (e.g. "Parsnip", from the harvest item). */
  name: string;
  /** cheatId of the seed item (e.g. "472" for Parsnip Seeds). */
  seedItemId: string;
  /** cheatId of the harvest item (e.g. "78" for Parsnip). */
  harvestItemId: string;
  seasons: Season[];
  growDays: number;
  regrowDays: number | null;
  harvestCountMin: number;
  harvestCountMax: number;
  qualityByLevel: Record<number, CropQualityDistribution>;
  canBeGiantCrop: boolean;
  trellisCrop: boolean;
  /** Whether the crop needs to be planted in water/paddy (e.g. Rice, Taro). */
  isPaddyCrop?: boolean;
  /** Sprite row index in crops.png (from Crops.json SpriteIndex). Each row = one crop. */
  spriteIndex?: number;
}

export interface ShopEntry {
  shop: string;
  /** Gold cost (absent for barter/trade shops). */
  price?: number;
  /**
   * Non-gold trade currency name, e.g. 'Omni Geode', 'Qi Gems', 'Taro Root'.
   * Present for barter shops (Desert Trader, Island Trader, Qi's Walnut Room).
   */
  currency?: string;
  /** Quantity of the trade currency required. */
  currencyAmount?: number;
  /** Seasonal availability, e.g. 'spring' or 'spring,summer' */
  season?: string;
  /** Day-of-week availability, e.g. 'Monday', 'Friday' */
  day?: string;
  /** Minimum year to be available, e.g. 2 means "Year 2 onward" */
  yearMin?: number;
  /** Minimum mine floor reached before item appears (Adventure Guild). */
  minMineLevel?: number;
}

// ── Wearables ─────────────────────────────────────────────────────────────────

export type WeaponType = 'sword' | 'dagger' | 'club' | 'slingshot' | 'other';

export interface WeaponDef {
  /** 'W0', 'W4', … */
  id: string;
  name: string;
  description?: string;
  weaponType: WeaponType;
  minDamage: number;
  maxDamage: number;
  /** Positive = faster than average, negative = slower. */
  speed: number;
  defense: number;
  knockback: number;
  /** 0–1, e.g. 0.02 = 2% */
  critChance: number;
  critMultiplier: number;
  /** Index into weapons.png (16×16 tiles, 8 cols). */
  spriteIndex: number;
  soldBy?: ShopEntry[];
}

export interface BootsDef {
  /** 'B504', 'B853', … */
  id: string;
  name: string;
  description?: string;
  defense: number;
  immunity: number;
  sellValue: number;
  /** Index into springobjects.png (same grid as items). */
  spriteIndex: number;
  soldBy?: ShopEntry[];
}

export interface HatDef {
  /** 'H0', 'H1', … */
  id: string;
  name: string;
  description?: string;
  /** Index into hats.png (20×20 tiles, 12 cols). */
  spriteIndex: number;
  soldBy?: ShopEntry[];
}

export interface ClothingDef {
  /** 'S1000' for shirts, 'P0' for pants. */
  id: string;
  name: string;
  type: 'shirt' | 'pants';
  price: number;
  canBeDyed: boolean;
  /** Index into the clothing sprite sheet. */
  spriteIndex: number;
  soldBy?: ShopEntry[];
}

export interface FoodBuff {
  /** Duration in in-game minutes (7 min = real-time ~ 1s) */
  duration: number;
  isDebuff?: boolean;
  farming?: number;
  fishing?: number;
  mining?: number;
  combat?: number;
  luck?: number;
  foraging?: number;
  speed?: number;
  defense?: number;
  attack?: number;
  maxStamina?: number;
  magneticRadius?: number;
}

export interface Item {
  id: string;
  name: string;
  category: ItemCategory;
  description: string;
  sellValue: number;
  cheatId: string;
  energy?: number;
  health?: number;
  /** Food buffs granted when consumed */
  buffs?: FoodBuff[];
  likedBy: string[];
  lovedBy: string[];
  obtainFrom?: string[];
  /** Shops that sell this item */
  soldBy?: ShopEntry[];
  sprite?: string;
  /** 'springobjects' | 'Objects_2' | 'Craftables' */
  spriteSheet?: string;
  spriteIndex?: number;
  isBigCraftable?: boolean;
  /** Geode(s) that can produce this item when cracked, e.g. ['Geode', 'Omni Geode'] */
  geodeSource?: string[];
  /** Seasons this item is available in (used for forage items), e.g. ['spring','summer'] or ['all'] */
  seasons?: Season[];
  /** Where forage items are found: 'outdoor' | 'beach' | 'cave' | 'desert' | 'island' */
  forageLocation?: string;
}

export interface QuestStep {
  id: string;
  text: string;
  tip?: string;
  linkedItems: string[];
  linkedNPCs: string[];
}

export interface Quest {
  id: string;
  name: string;
  type: QuestType;
  giverId?: string;
  reward: string;
  description: string;
  steps: QuestStep[];
}

export interface BundleItem {
  itemId: string;
  itemName: string;
  quantity: number;
  quality?: number;
  /** Unique slot identifier — required when the same itemId appears more than once in a bundle */
  slotId?: string;
}

export interface Bundle {
  id: string;
  room: CommunityRoom;
  name: string;
  reward: string;
  items: BundleItem[];
  /** When present, bundle completes once this many items are checked — otherwise all items required */
  requiredCount?: number;
}

export interface BuildingDoorPos {
  x: number;
  y: number;
  w?: number;
  h?: number;
}

export interface BuildingDef {
  id: string;
  name: string;
  builder: string;
  width: number;
  height: number;
  humanDoor?: BuildingDoorPos;
  animalDoor?: BuildingDoorPos;
  spriteName?: string;
  spriteWidth?: number;
  spriteHeight?: number;
  /** Source rectangle in the sprite sheet for the main building view (first stage). */
  sourceRect?: { x: number; y: number; w: number; h: number };
  /** Source rect for greenhouse in ruin state (before repair). */
  sourceRectRuin?: { x: number; y: number; w: number; h: number };
  hasInterior: boolean;
  interiorWidth?: number;
  interiorHeight?: number;
  /** Family groups upgradeable buildings: 'coop' | 'barn' | 'shed' */
  familyId?: string;
  familyLevel?: number;
  upgradeTo?: string;
  upgradeFrom?: string;
}

export type ZoneType = 'water' | 'impassable' | 'farmable' | 'building' | 'bridge' | 'path' | 'sand' | 'grass';

export interface StaticBuilding {
  buildingId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  upgradeable?: boolean;
  hasInterior?: boolean;
}

export interface FarmZone {
  type: ZoneType;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
}

export interface FarmTypeDefinition {
  id: string;
  name: string;
  description: string;
  startingBonus?: string;
  gridWidth: number;
  gridHeight: number;
  /**
   * Per-tile zone string extracted from the game's TMX map.
   * One char per tile, row-major order (length = gridWidth × gridHeight).
   * Chars: f=farmable  w=water  i=impassable  b=building  r=bridge  p=path  s=sand  g=grass
   * When present, takes priority over `zones` and `baseType`.
   */
  tileData?: string;
  /**
   * Per-tile buildable flag ('1'/'0'), same indexing as tileData.
   * A '1' means this Back-layer tile has buildable:t/true — Robin can construct here.
   */
  buildableData?: string;
  /**
   * Per-tile tree-plant flag ('1'/'0'), same indexing as tileData.
   * A '1' means this tile has canplanttrees:t — fruit/wild trees can be planted here.
   */
  treePlantData?: string;
  /** Fallback rectangular zones used when tileData is absent. */
  baseType?: 'farmable' | 'water';
  zones?: FarmZone[];
  staticBuildings?: StaticBuilding[];
}

export interface IslandFarmDefinition {
  gridWidth: number;
  gridHeight: number;
  /**
   * Per-tile zone string: f=farmable w=water i=impassable b=building r=bridge p=path s=sand g=grass
   * Same format as FarmTypeDefinition.tileData, row-major order (length = gridWidth × gridHeight).
   */
  tileData: string;
  /** Per-tile buildable flag ('1'/'0') — Robin-buildable tiles (rarely set on island). */
  buildableData?: string;
  /** Per-tile tree-plant flag ('1'/'0'). */
  treePlantData?: string;
  /** Fixed structures (farm hut, shipping bin) — always present, cannot be removed. */
  staticBuildings?: StaticBuilding[];
}

export interface TreeDef {
  type: string;
  name: string;
  spriteFile: string;
  cols: number;
  rows: number;
  iconX: number;
  iconY: number;
  isFruitTree?: boolean;
}

export interface UniversalGifts {
  loved: ItemRef[];
  liked: ItemRef[];
  disliked: ItemRef[];
  hated: ItemRef[];
}

export type FishWeather = 'any' | 'sunny' | 'rainy';

export interface FishTimeSlot {
  start: number; // 600 = 6:00am
  end: number;   // 2600 = 2:00am next day
}

export interface FishData {
  id: string;          // kebab-case name, e.g. "pufferfish"
  itemId: string;      // matches items[*].id
  cheatId: string;     // numeric cheat code
  name: string;
  difficulty: number;  // 0–100
  seasons: (Season | 'all')[];
  weather: FishWeather;
  times: FishTimeSlot[];
  locations: string[]; // e.g. ["Beach", "Ginger Island"]
  minFishingLevel: number;
  /** True for Crab Pot fish (not rod-caught). */
  trapFish?: boolean;
  /** True for legendary fish (once-per-save catch). */
  legendary?: boolean;
}

// ── Machine definitions ───────────────────────────────────────────────────────

export type FlavoredOutputType = 'Wine' | 'Juice' | 'Jelly' | 'Pickle' | 'AgedRoe' | 'Caviar';

export interface MachineOutputItem {
  itemId: string;
  itemName: string;
  /** Minimum stack size produced */
  minStack: number;
}

export interface MachineInputRule {
  ruleId: string;
  /** 'specific' = exact item, 'category' = tag-based */
  inputType: 'specific' | 'category';
  /** cheatId of specific input */
  inputItemId?: string;
  inputItemName?: string;
  /** Human-readable category (e.g. 'Any Fruit', 'Any Vegetable', 'Any Egg') */
  inputCategoryLabel?: string;
  inputCount: number;
  /** 'specific' = known output item, 'flavored' = depends on input */
  outputType: 'specific' | 'flavored';
  outputItemId?: string;
  outputItemName?: string;
  flavoredOutput?: FlavoredOutputType;
  /** Output price = floor(inputPrice × priceMultiplier) + priceBase */
  priceMultiplier?: number;
  priceBase?: number;
  minutesUntilReady: number;
  /** When true, output is randomly selected from outputItems */
  isRandomOutput?: boolean;
  /** Possible random outputs (e.g. Bone Mill fertilizers) */
  outputItems?: MachineOutputItem[];
  /** Special machine behavior — 'seed_maker' looks up matching seed; 'cask' upgrades quality */
  specialBehavior?: 'seed_maker' | 'cask';
  /** Human-readable note describing the special output */
  outputNote?: string;
}

export interface MachineDef {
  /** BigCraftable cheatId string */
  id: string;
  /** Matches items[*].id for linking */
  itemId?: string;
  name: string;
  rules: MachineInputRule[];
}

// ── Fish Pond definitions ─────────────────────────────────────────────────────

export interface PondProduceItem {
  itemId: string;
  itemName: string;
  minStack: number;
  maxStack: number;
  /** Produce chance 0–1 */
  chance: number;
  /** Minimum pond population required */
  minPop: number;
}

export interface PondPopGateItem {
  itemId: string;
  itemName: string;
  quantity: number;
}

export interface PondPopGate {
  /** Population level that triggers this quest */
  population: number;
  items: PondPopGateItem[];
}

export interface FishPondEntry {
  id: string;
  /** game ContextTags that match fish for this entry */
  requiredTags: string[];
  /** Resolved fish cheat IDs for specific-fish entries */
  fishItemIds: string[];
  /** Resolved fish display names */
  fishNames: string[];
  maxPopulation: number;
  /** Days between produce checks; -1 = game default (2) */
  spawnTime: number;
  minProduceChance: number;
  maxProduceChance: number;
  produce: PondProduceItem[];
  populationGates: PondPopGate[];
}

export type RecipeSourceType = 'default' | 'tv' | 'friendship' | 'skill' | 'island' | 'unknown';

export interface RecipeIngredient {
  /** cheatId of the specific item (absent for category ingredients) */
  itemId?: string;
  /** items[*].id for linking (absent for category ingredients) */
  itemRefId?: string;
  itemName: string;
  quantity: number;
  isCategory?: boolean;
}

export interface Recipe {
  id: string;
  name: string;
  /** cheatId of the result item */
  resultItemId: string;
  resultItemName: string;
  /** items[*].id of the result (for linking) */
  resultItemRefId?: string;
  ingredients: RecipeIngredient[];
  source: string;
  sourceType: RecipeSourceType;
  queenOfSauce?: boolean;
  friendshipNPC?: string;
  friendshipLevel?: number;
  skillName?: string;
  skillLevel?: number;
}

export interface GameData {
  version: string;
  universalGifts: UniversalGifts;
  npcs: NPC[];
  items: Item[];
  crops: Crop[];
  fish: FishData[];
  recipes: Recipe[];
  machineDefs: MachineDef[];
  fishPondData: FishPondEntry[];
  quests: Quest[];
  bundles: Bundle[];
  farmTypes: FarmTypeDefinition[];
  buildingDefs: BuildingDef[];
  treeDefs: TreeDef[];
  /** Ginger Island farm (IslandWest). Separate from farmTypes — no seasons, no Robin buildings. */
  islandFarm?: IslandFarmDefinition;
  weapons: WeaponDef[];
  boots: BootsDef[];
  hats: HatDef[];
  clothing: ClothingDef[];
}
