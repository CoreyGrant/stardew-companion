#!/usr/bin/env node
/**
 * patch-gamedata.js
 * Adds all missing items and quests to public/gamedata.json.
 * Idempotent: skips any item/quest whose id already exists.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = resolve(__dirname, '../public/gamedata.json');

const data = JSON.parse(readFileSync(DATA_PATH, 'utf8'));

// ── helpers ────────────────────────────────────────────────────────────────

const existingItemIds = new Set(data.items.map(i => i.id));
const existingQuestIds = new Set(data.quests.map(q => q.id));

function item(id, name, category, description, sellValue, cheatId, energy, health, likedBy, lovedBy, obtainFrom) {
  return { id, name, category, description, sellValue, cheatId, energy, health, likedBy, lovedBy, obtainFrom };
}

function quest(id, name, type, giverId, reward, description, steps) {
  return { id, name, type, giverId, reward, description, steps };
}

function step(id, text, tip, linkedNPCs, linkedItems) {
  const s = { id, text, linkedNPCs: linkedNPCs ?? [], linkedItems: linkedItems ?? [] };
  if (tip) s.tip = tip;
  return s;
}

// ── NEW ITEMS ──────────────────────────────────────────────────────────────

const newItems = [

  // ── Crops ──────────────────────────────────────────────────────────────

  item('leek', 'Leek', 'forage',
    'A spring foraging item found in Cindersap Forest and other areas.',
    60, '20', 25, 11, [], [], ['Foraging (Spring)']),

  item('green-bean', 'Green Bean', 'crop',
    'A climbing plant that produces beans. Grows in 10 days and continues producing every 3 days.',
    40, '188', 15, 6, [], [], ['Pierre\'s General Store (Spring)']),

  item('kale', 'Kale', 'crop',
    'A leafy green that matures in 6 days. Highly profitable for early spring.',
    110, '208', 50, 22, [], ['emily'], ['Pierre\'s General Store (Spring)']),

  item('garlic', 'Garlic', 'crop',
    'A pungent bulb that matures in 4 days. Available from Pierre\'s in Year 2.',
    60, '248', 20, 8, [], [], ['Pierre\'s General Store (Spring, Year 2)']),

  item('coffee-bean', 'Coffee Bean', 'crop',
    'Plant in Spring or Summer. Grows in 10 days, then produces a new bean every 2 days. 5 beans can be brewed into Coffee.',
    15, '433', null, null, [], [], ['Traveling Merchant', 'Krobus (Spring 12 letter)']),

  item('rhubarb', 'Rhubarb', 'crop',
    'A tart spring crop that matures in 13 days. Seeds are sold at the Oasis.',
    220, '252', 45, 20, [], [], ['Oasis Shop (Spring)']),

  item('tulip', 'Tulip', 'flower',
    'A cheerful spring flower that matures in 6 days. Honeybees produce Tulip Honey nearby.',
    30, '591', null, null, [], [], ['Pierre\'s General Store (Spring)']),

  item('blue-jazz', 'Blue Jazz', 'flower',
    'A vibrant spring flower that matures in 7 days. Honeybees nearby produce Blue Jazz Honey.',
    50, '597', null, null, [], [], ['Pierre\'s General Store (Spring)']),

  item('hops', 'Hops', 'crop',
    'A summer crop that matures in 11 days and produces every day after. Used to brew Pale Ale.',
    25, '262', 15, 6, [], [], ['Pierre\'s General Store (Summer)']),

  item('radish', 'Radish', 'crop',
    'A peppery summer root vegetable that matures in 6 days.',
    90, '264', 20, 8, [], [], ['Pierre\'s General Store (Summer)']),

  item('red-cabbage', 'Red Cabbage', 'crop',
    'A colorful summer crop that matures in 9 days. Only available from Year 2 onward.',
    260, '266', 78, 35, [], [], ['Pierre\'s General Store (Summer, Year 2)']),

  item('tomato', 'Tomato', 'crop',
    'A summer crop that matures in 11 days and produces every 4 days.',
    60, '256', 20, 8, [], [], ['Pierre\'s General Store (Summer)']),

  item('wheat', 'Wheat', 'crop',
    'A quick-growing grain that matures in 4 days. Grows in Summer or Fall. Used for Flour and Beer.',
    25, '270', null, null, [], [], ['Pierre\'s General Store (Summer/Fall)']),

  item('summer-spangle', 'Summer Spangle', 'flower',
    'A vivid summer flower that matures in 8 days. Honeybees produce Summer Spangle Honey nearby.',
    90, '593', null, null, [], [], ['Pierre\'s General Store (Summer)']),

  item('amaranth', 'Amaranth', 'crop',
    'A tall fall crop that matures in 7 days. Loved by several villagers.',
    150, '300', 45, 20, [], ['jas', 'penny'], ['Pierre\'s General Store (Fall)']),

  item('artichoke', 'Artichoke', 'crop',
    'A spiny fall crop that matures in 8 days. Only available from Year 2 onward.',
    160, '274', 38, 17, [], [], ['Pierre\'s General Store (Fall, Year 2)']),

  item('beet', 'Beet', 'crop',
    'A sweet fall root vegetable that matures in 6 days. Seeds sold at the Oasis.',
    100, '284', 18, 8, [], [], ['Oasis Shop (Fall)']),

  item('bok-choy', 'Bok Choy', 'crop',
    'A leafy Asian vegetable that matures in 4 days during Fall.',
    80, '278', 20, 8, [], [], ['Pierre\'s General Store (Fall)']),

  item('eggplant', 'Eggplant', 'crop',
    'A fall crop that matures in 5 days and produces every 5 days after.',
    60, '272', 20, 8, [], [], ['Pierre\'s General Store (Fall)']),

  item('grape', 'Grape', 'crop',
    'A fall crop that matures in 10 days and produces every 3 days. Can be put in a Keg to make Wine.',
    80, '398', 50, 22, [], [], ['Pierre\'s General Store (Fall)', 'Foraging (Fall)']),

  item('fairy-rose', 'Fairy Rose', 'flower',
    'A rare fall flower that matures in 12 days. Honeybees produce Fairy Rose Honey, the most valuable honey.',
    290, '595', null, null, [], [], ['Pierre\'s General Store (Fall)']),

  item('sweet-gem-berry', 'Sweet Gem Berry', 'crop',
    'The seeds of this plant are exceptionally rare. Takes 24 days to mature. Loved by the Old Master Cannoli statue.',
    3000, '417', null, null, [], [], ['Traveling Merchant (Rare Seeds)', 'Traveling Merchant (Spring/Summer)']),

  item('ancient-fruit', 'Ancient Fruit', 'crop',
    'A rare crop grown from Ancient Seeds. Matures in 28 days and produces every 7 days. Extremely valuable.',
    550, '454', 100, 45, [], [], ['Ancient Seeds (from Seed Maker or Gunther donation)', 'Traveling Merchant (rare)']),

  item('pineapple', 'Pineapple', 'crop',
    'A tropical fruit grown on Ginger Island. Matures in 14 days and produces every 7 days.',
    300, '832', 100, 45, [], [], ['Island Trader', 'Ginger Island Farm']),

  item('taro-root', 'Taro Root', 'crop',
    'A starchy tropical tuber grown on Ginger Island. Matures in 10 days.',
    100, '830', 30, 14, [], [], ['Island Trader', 'Ginger Island Farm']),

  item('ginger', 'Ginger', 'forage',
    'A pungent root found while foraging on Ginger Island. Used in cooking and Island trading.',
    60, '829', 30, 14, [], [], ['Foraging (Ginger Island)']),

  // ── Seeds ──────────────────────────────────────────────────────────────

  item('green-bean-seeds', 'Bean Starter', 'seed',
    'Plant in Spring. Takes 10 days to mature, then produces every 3 days.',
    30, '473', null, null, [], [], ['Pierre\'s General Store (Spring)']),

  item('kale-seeds', 'Kale Seeds', 'seed',
    'Plant in Spring. Takes 6 days to mature.',
    35, '477', null, null, [], [], ['Pierre\'s General Store (Spring)']),

  item('garlic-seeds', 'Garlic Seeds', 'seed',
    'Plant in Spring. Takes 4 days to mature. Available Year 2+.',
    40, '476', null, null, [], [], ['Pierre\'s General Store (Spring, Year 2)']),

  item('coffee-seeds', 'Coffee Bean (seeds)', 'seed',
    'Plant in Spring or Summer. Grows in 10 days then produces every 2 days.',
    15, '433', null, null, [], [], ['Traveling Merchant']),

  item('rhubarb-seeds', 'Rhubarb Seeds', 'seed',
    'Plant in Spring. Takes 13 days to mature. Sold at the Oasis.',
    50, '478', null, null, [], [], ['Oasis Shop (Spring)']),

  item('tulip-bulb', 'Tulip Bulb', 'seed',
    'Plant in Spring. Takes 6 days to bloom.',
    10, '427', null, null, [], [], ['Pierre\'s General Store (Spring)']),

  item('jazz-seeds', 'Jazz Seeds', 'seed',
    'Plant in Spring. Takes 7 days to bloom into Blue Jazz.',
    15, '429', null, null, [], [], ['Pierre\'s General Store (Spring)']),

  item('hops-starter', 'Hops Starter', 'seed',
    'Plant in Summer. Takes 11 days to mature, then produces daily.',
    30, '302', null, null, [], [], ['Pierre\'s General Store (Summer)']),

  item('radish-seeds', 'Radish Seeds', 'seed',
    'Plant in Summer. Takes 6 days to mature.',
    20, '304', null, null, [], [], ['Pierre\'s General Store (Summer)']),

  item('red-cabbage-seeds', 'Red Cabbage Seeds', 'seed',
    'Plant in Summer. Takes 9 days to mature. Year 2+.',
    50, '485', null, null, [], [], ['Pierre\'s General Store (Summer, Year 2)']),

  item('tomato-seeds', 'Tomato Seeds', 'seed',
    'Plant in Summer. Takes 11 days, then produces every 4 days.',
    25, '480', null, null, [], [], ['Pierre\'s General Store (Summer)']),

  item('wheat-seeds', 'Wheat Seeds', 'seed',
    'Plant in Summer or Fall. Takes 4 days to mature.',
    5, '483', null, null, [], [], ['Pierre\'s General Store (Summer/Fall)']),

  item('spangle-seeds', 'Spangle Seeds', 'seed',
    'Plant in Summer. Takes 8 days to bloom into Summer Spangle.',
    25, '431', null, null, [], [], ['Pierre\'s General Store (Summer)']),

  item('amaranth-seeds', 'Amaranth Seeds', 'seed',
    'Plant in Fall. Takes 7 days to mature.',
    35, '299', null, null, [], [], ['Pierre\'s General Store (Fall)']),

  item('artichoke-seeds', 'Artichoke Seeds', 'seed',
    'Plant in Fall. Takes 8 days to mature. Year 2+.',
    30, '489', null, null, [], [], ['Pierre\'s General Store (Fall, Year 2)']),

  item('beet-seeds', 'Beet Seeds', 'seed',
    'Plant in Fall. Takes 6 days to mature. Sold at the Oasis.',
    10, '494', null, null, [], [], ['Oasis Shop (Fall)']),

  item('bok-choy-seeds', 'Bok Choy Seeds', 'seed',
    'Plant in Fall. Takes 4 days to mature.',
    25, '306', null, null, [], [], ['Pierre\'s General Store (Fall)']),

  item('eggplant-seeds', 'Eggplant Seeds', 'seed',
    'Plant in Fall. Takes 5 days, then produces every 5 days.',
    10, '488', null, null, [], [], ['Pierre\'s General Store (Fall)']),

  item('grape-starter', 'Grape Starter', 'seed',
    'Plant in Fall. Takes 10 days, then produces every 3 days.',
    30, '301', null, null, [], [], ['Pierre\'s General Store (Fall)']),

  item('fairy-seeds', 'Fairy Seeds', 'seed',
    'Plant in Fall. Takes 12 days to bloom into Fairy Rose.',
    100, '425', null, null, [], [], ['Pierre\'s General Store (Fall)']),

  item('rare-seed', 'Rare Seed', 'seed',
    'Grows into a Sweet Gem Berry. Takes 24 days. Plant in Summer or Fall.',
    200, '347', null, null, [], [], ['Traveling Merchant (Spring/Summer)']),

  item('ancient-seeds', 'Ancient Seeds', 'seed',
    'Grows into Ancient Fruit. Takes 28 days. Once mature, produces every 7 days across seasons in a greenhouse.',
    30, '499', null, null, [], [], ['Gunther (Artifact donation)', 'Seed Maker (Ancient Fruit)']),

  item('pineapple-seeds', 'Pineapple Seeds', 'seed',
    'Plant on Ginger Island. Takes 14 days, then produces every 7 days.',
    100, '833', null, null, [], [], ['Island Trader']),

  item('taro-tuber', 'Taro Tuber', 'seed',
    'Plant on Ginger Island. Takes 10 days to mature.',
    20, '831', null, null, [], [], ['Island Trader', 'Foraging (Ginger Island)']),

  // ── Resources ──────────────────────────────────────────────────────────

  item('wood', 'Wood', 'resource',
    'Basic building material. Chopped from trees with an Axe.',
    2, '388', null, null, [], [], ['Chopping Trees', 'Traveling Merchant']),

  item('stone', 'Stone', 'resource',
    'Basic building material. Mined from rocks with a Pickaxe.',
    2, '390', null, null, [], [], ['Mining Rocks', 'Quarry']),

  item('coal', 'Coal', 'resource',
    'Used as fuel in the Furnace. Found in the Mines or by breaking rocks.',
    15, '382', null, null, [], [], ['The Mines (floors 41+)', 'Breaking Rocks', 'Charcoal Kiln', 'Dust Sprites']),

  item('fiber', 'Fiber', 'resource',
    'Gathered from grass with a Scythe. Used in many crafting recipes.',
    1, '771', null, null, [], [], ['Cutting Grass']),

  item('sap', 'Sap', 'resource',
    'Collected from trees when chopped. Used in crafting.',
    2, '92', null, null, [], [], ['Chopping Trees']),

  item('mixed-seeds', 'Mixed Seeds', 'resource',
    'Plant these in any season for an unpredictable crop. Found by cutting weeds.',
    0, '770', null, null, [], [], ['Cutting Weeds/Grass']),

  item('copper-ore', 'Copper Ore', 'resource',
    'Found in the Mines on floors 1-39. Smelt 5 into a Copper Bar.',
    5, '378', null, null, [], [], ['The Mines (floors 1-39)', 'Quarry', 'Fishing (treasure)']),

  item('iron-ore', 'Iron Ore', 'resource',
    'Found in the Mines on floors 40-79. Smelt 5 into an Iron Bar.',
    10, '380', null, null, [], [], ['The Mines (floors 40-79)', 'Quarry']),

  item('gold-ore', 'Gold Ore', 'resource',
    'Found in the Mines on floors 80+. Smelt 5 into a Gold Bar.',
    25, '384', null, null, [], [], ['The Mines (floors 80+)', 'Quarry']),

  item('iridium-ore', 'Iridium Ore', 'resource',
    'Found in the Skull Cavern. Smelt 5 into an Iridium Bar.',
    100, '386', null, null, [], [], ['Skull Cavern', 'Krobus (Iridium)', 'Magma Geode']),

  item('omni-geode', 'Omni Geode', 'resource',
    'A geode that can contain minerals from any depth of the Mines. Take to Clint to open.',
    0, '749', null, null, [], [], ['The Mines', 'Fishing (treasure)', 'Artifact Spots']),

  item('geode', 'Geode', 'resource',
    'Contains minerals typically found in the upper Mines (floors 1-39). Take to Clint to crack open.',
    0, '535', null, null, [], [], ['The Mines (floors 1-39)']),

  item('frozen-geode', 'Frozen Geode', 'resource',
    'Contains minerals typically from the mid-level Mines (floors 40-79).',
    0, '536', null, null, [], [], ['The Mines (floors 40-79)']),

  item('magma-geode', 'Magma Geode', 'resource',
    'Contains minerals from the deep Mines (floors 80+). Can hold fire quartz and other rare gems.',
    0, '537', null, null, [], [], ['The Mines (floors 80+)']),

  item('fire-quartz', 'Fire Quartz', 'mineral',
    'A deep red crystal that glows with intense heat. Found in the deep Mines.',
    100, '82', null, null, [], [], ['The Mines (floors 80+)', 'Magma Geode', 'Omni Geode']),

  item('bone-fragment', 'Bone Fragment', 'resource',
    'A piece of old bone found while fishing or in the Quarry Mine. Used in the Bone Mill.',
    12, '881', null, null, [], [], ['Fishing (treasure)', 'Quarry Mine', 'Skeletal enemies']),

  item('bug-meat', 'Bug Meat', 'resource',
    'Dropped by bugs, grubs, and cave flies in the Mines. Used in crafting.',
    8, '684', null, null, [], [], ['The Mines (bugs, grubs, cave flies)']),

  item('bat-wing', 'Bat Wing', 'resource',
    'Dropped by Bats in the Mines. Used to craft Iridium Band and other items.',
    15, '767', null, null, [], [], ['The Mines (Bats)']),

  item('solar-essence', 'Solar Essence', 'resource',
    'Dropped by Metal Heads, Squid Kids, and Iridium Bats. Used in crafting.',
    40, '768', null, null, [], [], ['The Mines (floors 80+)', 'Skull Cavern']),

  item('void-essence', 'Void Essence', 'resource',
    'Dropped by Shadow Brutes and Shadow Shamans. Used in crafting.',
    50, '769', null, null, [], [], ['The Mines (floors 80+)', 'Witch\'s Swamp']),

  item('slime', 'Slime', 'resource',
    'Dropped by Slimes of all types. Used in crafting and certain quests.',
    5, '766', null, null, [], [], ['The Mines (Slimes of all types)', 'Slime Hutch']),

  // ── Animal Products ────────────────────────────────────────────────────

  item('duck-egg', 'Duck Egg', 'animal_product',
    'Laid by a happy Duck in a Big Coop. Can be placed in a Mayonnaise Machine.',
    95, '442', 30, 14, [], [], ['Duck (Big Coop)']),

  item('large-milk', 'Large Milk', 'animal_product',
    'Produced by a very happy Cow. Can be turned into Gold Quality Cheese.',
    190, '438', 50, 22, [], [], ['Cow (Barn, high friendship)']),

  item('large-goat-milk', 'Large Goat Milk', 'animal_product',
    'Produced by a very happy Goat. Makes Gold Quality Goat Cheese.',
    345, '438', 50, 22, [], [], ['Goat (Big Barn, high friendship)']),

  item('dinosaur-egg', 'Dinosaur Egg', 'animal_product',
    'An ancient egg that can be donated to the Museum or incubated in a Big Coop. Also sells for 350g.',
    350, '107', null, null, [], [], ['Artifact Spots', 'Fishing (treasure)', 'Dinosaur Coop']),

  item('ostrich-egg', 'Ostrich Egg', 'animal_product',
    'Laid by an Ostrich on Ginger Island. Can be processed in a Mayonnaise Machine for large quantities.',
    600, '289', null, null, [], [], ['Ostrich (Island Farm Barn)']),

  // ── Artisan Goods ──────────────────────────────────────────────────────

  item('mayonnaise', 'Mayonnaise', 'artisan',
    'Produced by placing an Egg in a Mayonnaise Machine. A versatile condiment.',
    190, '306', 35, 15, [], [], ['Mayonnaise Machine (Egg)']),

  item('void-mayonnaise', 'Void Mayonnaise', 'artisan',
    'A jet-black mayo made from a Void Egg in a Mayonnaise Machine. Krobus loves it.',
    275, '308', 35, 15, [], ['krobus'], ['Mayonnaise Machine (Void Egg)', 'Fishing in the Witch\'s Swamp']),

  item('duck-mayonnaise', 'Duck Mayonnaise', 'artisan',
    'Rich mayonnaise made from a Duck Egg. More valuable than regular mayo.',
    375, '307', 35, 15, [], [], ['Mayonnaise Machine (Duck Egg)']),

  item('dinosaur-mayonnaise', 'Dinosaur Mayonnaise', 'artisan',
    'Rare mayonnaise produced from a Dinosaur Egg. Sells for a premium.',
    800, '807', 35, 15, [], [], ['Mayonnaise Machine (Dinosaur Egg)']),

  item('pale-ale', 'Pale Ale', 'artisan',
    'Brewed from Hops in a Keg. One of the most profitable keg products.',
    300, '346', 50, 22, [], ['pam'], ['Keg (Hops)']),

  item('mead', 'Mead', 'artisan',
    'A sweet alcoholic beverage brewed from Honey in a Keg.',
    200, '459', 40, 18, [], [], ['Keg (Honey)']),

  item('juice', 'Juice', 'artisan',
    'Fruit or vegetable juice made in a Keg. Typically sells for 2.25x the base ingredient value.',
    0, '350', 50, 22, [], [], ['Keg (Fruit or Vegetable)']),

  item('jelly', 'Jelly', 'artisan',
    'Fruit jelly made in a Preserves Jar. Sells for 2x the base fruit value plus 50g.',
    0, '344', 25, 11, [], [], ['Preserves Jar (Fruit)']),

  item('honey', 'Honey', 'artisan',
    'Produced by a Bee House. Value increases when flowers are planted nearby.',
    100, '340', 35, 15, [], [], ['Bee House']),

  item('aged-roe', 'Aged Roe', 'artisan',
    'Roe that has been aged in a Preserves Jar. More valuable than regular Roe.',
    0, '447', 25, 11, [], [], ['Preserves Jar (Roe)']),

  item('caviar', 'Caviar', 'artisan',
    'Aged Sturgeon Roe. An expensive delicacy. Loved by several villagers.',
    500, '445', 25, 11, [], ['willy', 'penny', 'elliott'], ['Preserves Jar (Sturgeon Roe)']),

  item('smoked-fish', 'Smoked Fish', 'artisan',
    'Fish smoked in a Smoker. Sells for twice the base fish value.',
    0, 'SmokedFish', 25, 11, [], [], ['Smoker (any Fish)']),

  // ── Forage ─────────────────────────────────────────────────────────────

  item('spring-onion', 'Spring Onion', 'forage',
    'Found growing naturally in Cindersap Forest during Spring.',
    8, '399', 13, 5, [], [], ['Foraging (Cindersap Forest, Spring)']),

  item('salmonberry', 'Salmonberry', 'forage',
    'A wild salmon-pink berry found on bushes during Spring (days 15-18).',
    5, '296', 13, 5, [], [], ['Bush foraging (Spring 15-18)']),

  item('wild-horseradish', 'Wild Horseradish', 'forage',
    'A spicy root found while foraging in Spring.',
    50, '16', 20, 8, [], [], ['Foraging (Spring)']),

  item('blackberry', 'Blackberry', 'forage',
    'A wild berry found on bushes during Fall (days 8-11). Multiple berries per bush.',
    20, '410', 18, 8, [], [], ['Bush foraging (Fall 8-11)']),

  item('fiddlehead-fern', 'Fiddlehead Fern', 'forage',
    'A young fern with a distinctively curled end. Found in the Secret Woods during Summer.',
    90, '259', 30, 14, [], [], ['Foraging (Secret Woods, Summer)']),

  item('red-mushroom', 'Red Mushroom', 'forage',
    'A slightly poisonous mushroom found in the Mines or forested areas in Fall.',
    75, '420', 20, 8, [], [], ['Foraging (Fall, Mines floor 81+)', 'Farm Cave (Mushroom)']),

  item('purple-mushroom', 'Purple Mushroom', 'forage',
    'A rare mushroom found in the Mines. Used in several bundles and recipes.',
    250, '422', 50, 22, [], [], ['The Mines (floor 81+)', 'Farm Cave (Mushroom)']),

  item('chanterelle', 'Chanterelle', 'forage',
    'A popular edible mushroom with a pleasant fruity smell. Found in Fall.',
    160, '281', 50, 22, [], [], ['Foraging (Fall)']),

  item('common-mushroom', 'Common Mushroom', 'forage',
    'A woodland mushroom with a pleasant earthy smell. Found in Fall.',
    40, '281', 25, 11, [], [], ['Foraging (Fall)', 'Farm Cave (Mushroom)']),

  item('morel', 'Morel', 'forage',
    'A highly prized mushroom with a distinctive honeycomb cap. Found in Spring in the Secret Woods.',
    150, '257', 50, 22, [], [], ['Foraging (Secret Woods, Spring)', 'Farm Cave (Mushroom, Spring)']),

  item('winter-root', 'Winter Root', 'forage',
    'A starchy winter root vegetable. Found by tilling soil in Winter.',
    70, '412', 25, 11, [], [], ['Foraging (Winter, tilling soil)']),

  item('crystal-fruit', 'Crystal Fruit', 'forage',
    'An icy, translucent fruit that appears in Winter.',
    150, '414', 50, 22, [], [], ['Foraging (Winter)']),

  item('snow-yam', 'Snow Yam', 'forage',
    'A small but hearty yam found buried in snow during Winter.',
    100, '416', 30, 14, [], [], ['Foraging (Winter, tilling soil)']),

  item('nautilus-shell', 'Nautilus Shell', 'forage',
    'A beautiful shell found on the beach in Winter.',
    120, '392', null, null, [], [], ['Foraging (Beach, Winter)']),

  item('holly', 'Holly', 'forage',
    'The bright red berries and glossy leaves make a traditional Winter decoration.',
    80, '418', null, null, [], [], ['Foraging (Winter)']),

  item('crocus', 'Crocus', 'forage',
    'A colorful flower that blooms in the snow of Winter.',
    60, '418', null, null, [], [], ['Foraging (Winter)']),

  item('sweet-pea', 'Sweet Pea', 'forage',
    'A fragrant wildflower that blooms during Summer.',
    50, '402', null, null, [], [], ['Foraging (Summer)']),

  item('fern', 'Fern', 'forage',
    'A fiddlehead that has fully opened. Found in Summer.',
    20, '259', 20, 8, [], [], ['Foraging (Summer)']),

  item('spice-berry', 'Spice Berry', 'forage',
    'A berry with a spicy, complex flavor found in Summer.',
    80, '396', 30, 14, [], [], ['Foraging (Summer)']),

  item('red-mushroom-fall', 'Red Mushroom', 'forage',
    'A slightly poisonous mushroom with a red cap spotted in Fall forests.',
    75, '420', 20, 8, [], [], ['Foraging (Fall)']),

  item('grape-fall', 'Wild Grape', 'forage',
    'A small, sweet wild grape. Found on vines in Fall.',
    80, '398', 50, 22, [], [], ['Foraging (Fall)']),

  // ── Fish ───────────────────────────────────────────────────────────────

  item('carp', 'Carp', 'fish',
    'A common freshwater fish found in the mountain lake and secret woods pond.',
    30, '142', 15, 6, [], [], ['Mountain Lake (all seasons)', 'Secret Woods Pond', 'Sewers']),

  item('smallmouth-bass', 'Smallmouth Bass', 'fish',
    'A feisty freshwater fish found in the river and mountain lake.',
    50, '145', 25, 11, [], [], ['Town River / Cindersap Forest River (Spring, Fall)', 'Mountain Lake']),

  item('largemouth-bass', 'Largemouth Bass', 'fish',
    'A large freshwater fish found in the mountain lake.',
    100, '136', 25, 11, [], [], ['Mountain Lake (all seasons)']),

  item('eel', 'Eel', 'fish',
    'A slippery fish that prefers rainy weather. Found in the ocean during Spring and Fall.',
    85, '148', 25, 11, [], [], ['Ocean (Spring/Fall, Rain)']),

  item('tuna', 'Tuna', 'fish',
    'A large ocean fish. Found in Summer and Winter at the ocean.',
    100, '130', 25, 11, [], [], ['Ocean (Summer/Winter)']),

  item('red-snapper', 'Red Snapper', 'fish',
    'A common ocean fish. Easier to catch when it\'s raining.',
    50, '150', 18, 8, [], [], ['Ocean (Summer/Fall)']),

  item('tilapia', 'Tilapia', 'fish',
    'Introduced to the valley from a distant land. Found in the ocean during Summer and Fall.',
    75, '701', 18, 8, [], [], ['Ocean (Summer/Fall)']),

  item('pike', 'Pike', 'fish',
    'A freshwater predator found in rivers and the mountain lake.',
    100, '144', 25, 11, [], [], ['Town River / Cindersap Forest River (Summer/Winter)', 'Mountain Lake']),

  item('sunfish', 'Sunfish', 'fish',
    'A small, colorful freshwater fish. Active on sunny days.',
    30, '145', 13, 5, [], [], ['Town River / Cindersap Forest River (Spring/Summer, Sunny)']),

  item('shad', 'Shad', 'fish',
    'A river fish found only when it\'s raining. Appears in Spring, Summer, and Fall.',
    60, '706', 18, 8, [], [], ['Town River / Cindersap Forest River (Spring/Summer/Fall, Rain)']),

  item('sardine', 'Sardine', 'fish',
    'A small, silvery ocean fish. Found in Spring, Fall, and Winter.',
    40, '131', 13, 5, [], [], ['Ocean (Spring/Fall/Winter)']),

  item('herring', 'Herring', 'fish',
    'A common ocean fish caught in Spring and Winter.',
    30, '147', 13, 5, [], [], ['Ocean (Spring/Winter)']),

  item('anchovy', 'Anchovy', 'fish',
    'A small, silvery ocean fish. Often caught in Spring and Fall.',
    30, '129', 13, 5, [], [], ['Ocean (Spring/Fall)']),

  item('bream', 'Bream', 'fish',
    'A river fish that prefers nighttime. Active from 6pm to 2am.',
    45, '132', 18, 8, [], [], ['Town River / Cindersap Forest River (all seasons, 6pm-2am)']),

  item('woodskip', 'Woodskip', 'fish',
    'A rare fish found only in the Secret Woods pond.',
    75, '734', 25, 11, [], [], ['Secret Woods Pond (all seasons)']),

  item('albacore', 'Albacore', 'fish',
    'An ocean fish found early morning or late at night in Fall and Winter.',
    75, '705', 18, 8, [], [], ['Ocean (Fall/Winter, 6am-11am & 6pm-2am)']),

  item('void-salmon', 'Void Salmon', 'fish',
    'A mysterious fish found only in the Witch\'s Swamp.',
    150, '795', 25, 11, [], ['krobus', 'witch'], ['Witch\'s Swamp']),

  item('slimejack', 'Slimejack', 'fish',
    'A fish coated in a thick slime. Found in the Bug Lair beneath the Witch\'s Swamp.',
    100, '796', 25, 11, [], [], ['Bug Lair (beneath Witch\'s Swamp)']),

  item('midnight-carp', 'Midnight Carp', 'fish',
    'A mysterious carp that only appears at night. Found in the mountain lake, river, and forest pond.',
    150, '269', 25, 11, [], [], ['Mountain Lake / Forest Pond (Fall/Winter, 10pm-2am)']),

  item('ghostfish', 'Ghostfish', 'fish',
    'A translucent fish found in the Mines near underground lakes.',
    45, '156', 13, 5, [], [], ['The Mines (floors 20 & 60 underground lake)']),

  item('ice-pip', 'Ice Pip', 'fish',
    'A rare fish that lives in the icy water of the Mines\' frozen level.',
    200, '164', 25, 11, [], [], ['The Mines (floor 60 underground lake)']),

  item('super-cucumber', 'Super Cucumber', 'fish',
    'A rare, purple sea cucumber found in the ocean at night during Summer and Fall.',
    250, '155', 38, 17, [], [], ['Ocean (Summer/Fall, 6pm-2am)']),

  item('lava-eel', 'Lava Eel', 'fish',
    'A rare eel found swimming in lava at the bottom of the Mines.',
    700, '162', 50, 22, [], [], ['The Mines (floor 100 lava lake)', 'Volcano Dungeon']),

  item('walleye', 'Walleye', 'fish',
    'A freshwater fish found in the river and mountain lake on rainy Fall days.',
    105, '140', 25, 11, [], [], ['Town River / Mountain Lake (Fall, Rain)']),

  item('chub', 'Chub', 'fish',
    'A common freshwater fish found in rivers and the mountain lake.',
    50, '702', 18, 8, [], [], ['Mountain Lake / Town River (all seasons)']),

  item('bullhead', 'Bullhead', 'fish',
    'A bottom-feeding fish found in the mountain lake.',
    75, '700', 18, 8, [], [], ['Mountain Lake (all seasons)']),

  item('lingcod', 'Lingcod', 'fish',
    'An ocean fish found in Winter.',
    120, '707', 25, 11, [], [], ['Ocean (Winter)']),

  item('halibut', 'Halibut', 'fish',
    'A flat ocean fish found in the morning and at night.',
    80, '708', 25, 11, [], [], ['Ocean (Spring/Summer/Winter, morning & night)']),

  item('midnight-squid', 'Midnight Squid', 'fish',
    'Caught from the Night Market submarine during Winter.',
    100, '814', 25, 11, [], [], ['Night Market Submarine (Winter 15-17)']),

  item('spookfish', 'Spookfish', 'fish',
    'Caught from the Night Market submarine during Winter.',
    220, '812', 38, 17, [], [], ['Night Market Submarine (Winter 15-17)']),

  item('blobfish', 'Blobfish', 'fish',
    'Caught from the Night Market submarine during Winter.',
    500, '800', 50, 22, [], [], ['Night Market Submarine (Winter 15-17)']),

  // Legendary Fish
  item('legend', 'Legend', 'fish',
    'The most elusive fish in the valley. Caught in the Mountain Lake in Spring when raining. Requires Fishing level 10.',
    5000, '163', null, null, [], [], ['Mountain Lake (Spring, Rain, Fishing level 10)']),

  item('mutant-carp', 'Mutant Carp', 'fish',
    'A carp warped by the pollution in the Sewers. Can only be caught after accessing the Sewers.',
    1000, '682', null, null, [], [], ['Sewers (all seasons)']),

  item('crimsonfish', 'Crimsonfish', 'fish',
    'A rare ocean fish that lives near the east pier. Requires Fishing level 5.',
    1500, '159', null, null, [], [], ['Ocean (Summer, Fishing level 5)']),

  item('angler', 'Angler', 'fish',
    'A rare fish found north of JojaMart in Fall.',
    900, '160', null, null, [], [], ['Town River north of JojaMart (Fall)']),

  item('glacier-fish', 'Glacier Fish', 'fish',
    'A legendary fish found at the south tip of Arrowhead Island in Winter.',
    1000, '161', null, null, [], [], ['Forest River / Arrowhead Island (Winter, Fishing level 6)']),

  item('son-of-crimsonfish', 'Son Of Crimsonfish', 'fish',
    'Legendary II fish — a descendant of Crimsonfish. Caught at the ocean during Summer.',
    1500, '898', null, null, [], [], ['Ocean (Summer) — requires Mr. Qi quest']),

  item('ms-angler', 'Ms. Angler', 'fish',
    'Legendary II fish — a descendant of Angler. Caught north of JojaMart in Fall.',
    900, '899', null, null, [], [], ['Town River north of JojaMart (Fall) — requires Mr. Qi quest']),

  item('legend-ii', 'Legend II', 'fish',
    'Legendary II fish — an even more mythical carp. Caught in the Mountain Lake in Spring.',
    5000, '900', null, null, [], [], ['Mountain Lake (Spring) — requires Mr. Qi quest']),

  item('radioactive-carp', 'Radioactive Carp', 'fish',
    'Legendary II fish — a mutated Sewers carp glowing with radioactivity.',
    1000, '901', null, null, [], [], ['Sewers (all seasons) — requires Mr. Qi quest']),

  item('glacierfish-jr', 'Glacierfish Jr.', 'fish',
    'Legendary II fish — a descendant of the Glacier Fish. Found at Arrowhead Island in Winter.',
    1000, '902', null, null, [], [], ['Forest River / Arrowhead Island (Winter) — requires Mr. Qi quest']),

  // ── Food (cooked dishes not yet present) ───────────────────────────────

  item('bread', 'Bread', 'food',
    'A loaf of fresh-baked bread. Made from Wheat Flour.',
    60, '216', 50, 22, [], [], ['Cooking (Flour)', 'Saloon (120g)']),

  item('fried-mushroom', 'Fried Mushroom', 'food',
    'Earthy and savory. Made from Common Mushroom and Morel.',
    200, '205', 80, 36, [], [], ['Cooking (Common Mushroom, Morel, Oil)']),

  item('bean-hotpot', 'Bean Hotpot', 'food',
    'A warming bean stew. Grants a defense buff.',
    100, '207', 90, 40, [], [], ['Cooking (Green Bean x2)']),

  item('glazed-yams', 'Glazed Yams', 'food',
    'Sweet and satisfying, just like Grandpa used to make.',
    200, '208', 80, 36, [], [], ['Cooking (Yam, Sugar)']),

  item('hashbrowns', 'Hashbrowns', 'food',
    'Crispy and golden. Grant a mining speed buff when eaten.',
    120, '210', 90, 40, [], [], ['Cooking (Potato, Oil)']),

  item('pancakes', 'Pancakes', 'food',
    'A stack of fluffy pancakes. Grant a Foraging buff.',
    80, '211', 90, 40, [], [], ['Cooking (Egg, Wheat Flour)']),

  item('tortilla', 'Tortilla', 'food',
    'Can be used as a plate or eaten as a snack.',
    50, '229', 50, 22, [], [], ['Cooking (Corn)']),

  item('rice-pudding', 'Rice Pudding', 'food',
    'Sweet and creamy. Loved by Evelyn.',
    260, '232', 80, 36, [], [], ['Cooking (Milk, Sugar, Rice)']),

  item('ice-cream', 'Ice Cream', 'food',
    'A creamy frozen treat. Sold at the Ice Cream Stand in Summer.',
    120, '233', 50, 22, [], ['jodi', 'haley', 'emily'], ['Ice Cream Stand (Summer)', 'Cooking (Milk, Sugar)']),

  item('triple-shot-espresso', 'Triple Shot Espresso', 'food',
    'A very strong coffee drink. Grants a powerful speed buff.',
    450, '253', 40, 18, [], [], ['Cooking (Coffee x3)']),

  item('lucky-lunch', 'Lucky Lunch', 'food',
    'A special meal that boosts Luck.',
    250, 'loaded', 100, 45, [], [], ['Cooking (Sea Cucumber, Tortilla, Blue Jazz)']),

  item('escargot', 'Escargot', 'food',
    'Snails poached in garlic butter. Grants a Fishing buff.',
    125, 'escargot', 80, 36, [], [], ['Cooking (Snail, Garlic)']),

  item('fish-taco', 'Fish Taco', 'food',
    'Tuna wrapped in a corn tortilla with a fresh dressing.',
    500, '213', 100, 45, [], [], ['Cooking (Tuna, Tortilla, Mayonnaise, Red Cabbage)']),

  item('algae-soup', 'Algae Soup', 'food',
    'It\'s a little slimy, but nutritious.',
    100, '214', 50, 22, [], [], ['Cooking (Green Algae x4)']),

  item('pale-broth', 'Pale Broth', 'food',
    'A high-protein broth made from White Algae.',
    150, '215', 100, 45, [], [], ['Cooking (White Algae x2)']),

  item('parsnip-soup', 'Parsnip Soup', 'food',
    'A silky spring soup. Loved by Caroline.',
    120, '199', 80, 36, [], ['caroline'], ['Cooking (Parsnip, Milk, Vinegar)']),

  item('maki-roll', 'Maki Roll', 'food',
    'Fish and rice wrapped in seaweed. A light and refreshing snack.',
    220, '228', 100, 45, [], [], ['Cooking (Fish, Seaweed, Rice)', 'Stardrop Saloon']),

  item('lobster-bisque', 'Lobster Bisque', 'food',
    'A rich, creamy bisque. Loved by Willy.',
    205, '730', 100, 45, [], ['willy'], ['Cooking (Lobster, Milk)']),

  item('baked-fish', 'Baked Fish', 'food',
    'Baked fish with lemon. A light main course.',
    100, '198', 70, 32, [], [], ['Cooking (Sunfish or Bream, Wheat Flour)']),

  item('ginger-ale', 'Ginger Ale', 'food',
    'A fizzy ginger drink that settles the stomach. Reduces Nausea debuff.',
    200, '903', 50, 22, [], [], ['Cooking (Ginger, Sugar)', 'Krobus\' Shop (occasionally)']),

  item('banana-pudding', 'Banana Pudding', 'food',
    'A tasty tropical dessert. Loved by Birdie.',
    260, '904', 80, 36, [], [], ['Cooking (Banana, Coconut, Milk)']),

  item('mango-sticky-rice', 'Mango Sticky Rice', 'food',
    'A delicious tropical dessert.',
    250, '905', 80, 36, [], [], ['Cooking (Mango, Coconut, Rice)']),

  item('poi', 'Poi', 'food',
    'Made from pounded Taro Root. Staple of Island cuisine.',
    400, '906', 100, 45, [], [], ['Cooking (Taro Root x2)']),

  item('tropical-curry', 'Tropical Curry', 'food',
    'An exotic dish with a kick. Grants a speed buff.',
    500, '907', 100, 45, [], [], ['Cooking (Coconut, Taro Root, Hot Pepper)']),

  item('seafoam-pudding', 'Seafoam Pudding', 'food',
    'This peculiar pudding grants a powerful Fishing buff.',
    300, '212', 80, 36, [], [], ['Cooking (Midnight Carp)']),

  item('cranberry-candy', 'Cranberry Candy', 'food',
    'A sweet cranberry confection beloved by children.',
    175, '651', 50, 22, [], ['vincent', 'jas'], ['Cooking (Cranberries, Apple, Sugar)']),

  item('artichoke-dip', 'Artichoke Dip', 'food',
    'A creamy dip made with artichoke.',
    210, '605', 70, 32, [], [], ['Cooking (Artichoke, Milk)']),

  item('bruschetta', 'Bruschetta', 'food',
    'Bread and vegetables, carefully prepared.',
    210, '606', 70, 32, [], [], ['Cooking (Bread, Garlic, Tomato)']),

  item('coleslaw', 'Coleslaw', 'food',
    'A healthy and refreshing summer side dish.',
    345, '611', 80, 36, [], [], ['Cooking (Red Cabbage, Vinegar, Mayonnaise)']),

  item('fiddlehead-risotto', 'Fiddlehead Risotto', 'food',
    'A labor of love. Grants an immunity buff.',
    350, '612', 100, 45, [], [], ['Cooking (Fiddlehead Fern, Oil, Garlic)']),

  item('garlic-oil', 'Garlic Oil', 'food',
    'Infused with the pungent aroma of garlic.',
    200, '614', 50, 22, [], [], ['Cooking (Garlic, Oil)']),

  item('radish-salad', 'Radish Salad', 'food',
    'A crispy salad that grants a farming speed buff.',
    300, '616', 80, 36, [], [], ['Cooking (Radish, Oil, Vinegar)']),

  item('stuffing', 'Stuffing', 'food',
    'Rich, complex, delicious.',
    165, '624', 90, 40, [], [], ['Cooking (Bread, Cranberries, Hazelnut)']),

  item('super-tofu', 'Super Tofu', 'food',
    'It\'s very filling, but has an unusual texture.',
    220, '629', 100, 45, [], [], ['Cooking (Bok Choy, Milk, Vinegar)']),

  item('winter-root-soup', 'Winter Root Soup', 'food',
    'A warming soup made from winter roots.',
    100, 'winter-root-soup', 80, 36, [], [], ['Cooking (Winter Root, Milk)']),

  // ── Other / Misc ───────────────────────────────────────────────────────

  item('geode-mineral', 'Geode Mineral', 'mineral',
    'A generic mineral that can be found inside a Geode. Donate to Gunther to complete the mineral collection.',
    0, null, null, null, [], [], ['Geode', 'Frozen Geode', 'Magma Geode', 'Omni Geode']),

  item('artifact', 'Artifact', 'other',
    'A rare object of historical significance. Donate to the Museum to fill Gunther\'s collection.',
    0, null, null, null, [], [], ['Artifact Spots', 'Fishing (treasure)', 'Enemy drops']),

  item('cloth-bolt', 'Cloth (artisan)', 'artisan',
    'Silky smooth. Made from Wool in a Loom.',
    470, '428', null, null, [], ['emily', 'emily'], ['Loom (Wool)']),

  item('refined-quartz', 'Refined Quartz', 'resource',
    'A processed form of Quartz or Fire Quartz. Used in crafting.',
    50, '338', null, null, [], [], ['Furnace (Quartz or Fire Quartz)', 'Recycling Machine (Broken Glass)']),

  item('torch', 'Torch', 'resource',
    'Provides light in dark areas like the Mines.',
    5, '93', null, null, [], [], ['Crafting (Wood x1, Sap x2)', 'The Mines (rarely)']),

  item('bait', 'Bait', 'resource',
    'Attach to a Fiberglass or Iridium Rod to attract fish more quickly.',
    5, '685', null, null, [], [], ['Crafting (Bug Meat)', 'Willy\'s Fish Shop']),

  item('spinner', 'Spinner', 'resource',
    'A fishing tackle that attracts fish. Reduces nibble time slightly.',
    500, '686', null, null, [], [], ['Crafting (Iron Bar x2)', 'Willy\'s Fish Shop']),

  item('trap-bobber', 'Trap Bobber', 'resource',
    'Fishing tackle. Causes fish to escape more slowly from the fishing bar.',
    500, '694', null, null, [], [], ['Crafting (Copper Bar, Sap x10)', 'Willy\'s Fish Shop']),

  item('cork-bobber', 'Cork Bobber', 'resource',
    'Fishing tackle. Slightly increases the size of the fishing bar.',
    750, '695', null, null, [], [], ['Crafting (Wood x10, Hardwood x5, Slimejack or Truffle)', 'Willy\'s Fish Shop']),

  item('dressed-spinner', 'Dressed Spinner', 'resource',
    'The colorful yarn makes this spinner far more visible to fish.',
    1000, '687', null, null, [], [], ['Crafting (Iron Bar x2, Cloth)']),

  item('quality-bobber', 'Quality Bobber', 'resource',
    'Fishing tackle. Increases the quality of the fish you catch.',
    750, '877', null, null, [], [], ['Crafting (Copper Bar, Sap x20, Acorn)']),

  item('magnet', 'Magnet', 'resource',
    'Fishing tackle. Increases the chance of finding treasure while fishing.',
    500, '693', null, null, [], [], ['Crafting (Iron Bar)']),

  item('lead-bobber', 'Lead Bobber', 'resource',
    'Fishing tackle. Adds a weight to the bottom of the fishing bar.',
    150, '692', null, null, [], [], ['Crafting (Iron Bar x2)']),

  item('barbed-hook', 'Barbed Hook', 'resource',
    'Fishing tackle. Makes your catch more secure, causing it to not slip as easily.',
    1000, '691', null, null, [], [], ['Crafting (Copper Bar, Gold Bar, Iron Bar)']),

  item('cherry', 'Cherry', 'forage',
    'A spring fruit from a cherry tree. Can be obtained from a fruit tree planted in Spring.',
    80, '638', 38, 17, [], [], ['Cherry Tree (Spring)']),

  item('apricot', 'Apricot', 'forage',
    'A spring fruit from an apricot tree.',
    50, '634', 25, 11, [], [], ['Apricot Tree (Spring)']),

  item('orange', 'Orange', 'forage',
    'A summer fruit from an orange tree.',
    100, '635', 50, 22, [], [], ['Orange Tree (Summer)']),

  item('apple', 'Apple', 'forage',
    'A fall fruit from an apple tree.',
    100, '613', 50, 22, [], [], ['Apple Tree (Fall)']),

  item('banana', 'Banana', 'forage',
    'A tropical fruit from a banana tree grown on Ginger Island.',
    150, '834', 50, 22, [], [], ['Banana Tree (Ginger Island)']),

  item('mango', 'Mango', 'forage',
    'A juicy tropical fruit from a mango tree on Ginger Island.',
    130, '835', 50, 22, [], [], ['Mango Tree (Ginger Island)']),

  item('mushroom-log', 'Mushroom Log', 'resource',
    'A crafted log that produces mushrooms over time.',
    0, 'MushroomLog', null, null, [], [], ['Crafting (Hardwood x10, Moss x10)']),

  item('moss', 'Moss', 'resource',
    'Grows on trees in Spring. Used in crafting the Mushroom Log.',
    5, 'Moss', null, null, [], [], ['Trees (Spring)', 'Foraging']),

  item('mystic-stone', 'Mystic Stone', 'resource',
    'A rare, magical stone that contains precious gems and ores.',
    0, 'mystic', null, null, [], [], ['The Mines (floors 100+)', 'Skull Cavern']),

  item('golden-egg', 'Golden Egg', 'animal_product',
    'An extraordinary egg produced by a Golden Chicken. Worth a great deal.',
    500, '928', null, null, [], [], ['Golden Chicken (Deluxe Coop, Perfection route)']),

  item('golden-milk', 'Golden Milk', 'animal_product',
    'Rich, golden milk from a Golden Cow. Exceptionally valuable.',
    0, '929', null, null, [], [], ['Golden Cow (Deluxe Barn, Perfection route)']),

  item('large-egg-brown', 'Large Brown Egg', 'animal_product',
    'A large brown egg from a happy Chicken. Can be processed in a Mayonnaise Machine.',
    95, '174', 50, 22, [], [], ['Chicken (Coop, high friendship)']),
];

// ── NEW QUESTS ─────────────────────────────────────────────────────────────

const newQuests = [

  // Story quests
  quest('meet-the-wizard', 'Meet The Wizard', 'story', 'wizard',
    '500g',
    'The mysterious Wizard has sent you a letter asking you to visit his tower south of Cindersap Forest.',
    [
      step('mtw-1', 'Visit the Wizard\'s Tower in Cindersap Forest.', null, ['wizard'], []),
    ]),

  quest('community-center-intro', 'The Community Center', 'story', null,
    'None',
    'You discovered the old Community Center. Something magical seems to lurk inside. Perhaps the Wizard knows more.',
    [
      step('cci-1', 'Enter the Community Center in town.', null, [], []),
      step('cci-2', 'Visit the Wizard and learn about the Junimo language.', null, ['wizard'], []),
      step('cci-3', 'Return to the Community Center and read the golden scroll.', null, [], []),
    ]),

  quest('restoring-the-community-center', 'Restoring The Community Center', 'story', null,
    'Completion of all Community Center Bundles',
    'The Junimos have asked you to restore the Community Center by completing all the bundles. Each bundle you complete repairs part of the building.',
    [
      step('rcc-1', 'Complete the Crafts Room bundles (Spring, Summer, Fall, Winter, Construction, Exotic).', 'Forage items, resources, and exotic crops fill these bundles.', [], []),
      step('rcc-2', 'Complete the Pantry bundles (Spring, Summer, Fall, Quality, Animal, Artisan).', 'Crops, animal products, and artisan goods.', [], []),
      step('rcc-3', 'Complete the Fish Tank bundles (Spring, Summer, Fall, Winter, Specialty, Crab Pot).', 'Various fish and shellfish from all seasons.', [], []),
      step('rcc-4', 'Complete the Boiler Room bundles (Blacksmith, Geologist, Adventurer).', null, [], []),
      step('rcc-5', 'Complete the Bulletin Board bundles (Chef, Dye, Field Research, Fodder, Enchanter).', null, [], []),
      step('rcc-6', 'Complete the Vault bundles (2,500g, 5,000g, 10,000g, 25,000g).', null, [], []),
    ]),

  quest('joja-membership', 'JojaMart Membership', 'joja',
    null,
    'None — replaces Community Center',
    'Instead of restoring the Community Center, purchase a JojaMart membership and fund community development projects directly.',
    [
      step('jm-1', 'Purchase a JojaMart Membership from Morris for 5,000g.', null, [], []),
      step('jm-2', 'Fund the Greenhouse project.', null, [], []),
      step('jm-3', 'Fund the Bridge Repair.', null, [], []),
      step('jm-4', 'Fund the Glittering Boulder Removal.', null, [], []),
      step('jm-5', 'Fund the Minecarts.', null, [], []),
      step('jm-6', 'Fund the Bus Repair.', null, [], []),
    ]),

  quest('journey-to-the-desert', 'Journey To The Desert', 'story', null,
    'Access to Calico Desert',
    'The bus to Calico Desert has been repaired. You can now travel to the desert to find the Oasis shop and the Skull Cavern.',
    [
      step('jd-1', 'Repair the Bus Stop by completing the Vault bundles or buying a JojaMart Membership.', null, [], []),
      step('jd-2', 'Purchase a bus ticket from Pam and travel to Calico Desert.', null, ['pam'], []),
    ]),

  quest('visit-skull-cavern', 'Into The Skull Cavern', 'story', null,
    'None — personal milestone',
    'The Skull Cavern looms over the Calico Desert. Descend as deep as possible to find Iridium Ore and other rare treasures.',
    [
      step('vsc-1', 'Obtain a Skull Key from floor 120 of the Mines.', 'The Skull Key is always at floor 120.', [], ['skull-key']),
      step('vsc-2', 'Travel to Calico Desert and unlock the Skull Cavern with the Skull Key.', null, [], []),
    ]),

  quest('ginger-island', 'Ginger Island', 'story', 'willy',
    'Access to Ginger Island',
    'Willy has asked for help fixing his old boat. Once repaired, it will take you to the mysterious Ginger Island.',
    [
      step('gi-1', 'Enter Willy\'s back room after getting 5 hearts with him.', null, ['willy'], []),
      step('gi-2', 'Donate 200 Hardwood to repair the boat hull.', null, [], ['hardwood']),
      step('gi-3', 'Donate 5 Iridium Bars to repair the boat anchor.', null, [], ['iridium-bar']),
      step('gi-4', 'Donate 5 Battery Packs to repair the boat ticketing machine.', null, [], ['battery-pack']),
      step('gi-5', 'Purchase a ticket from Willy and sail to Ginger Island.', null, ['willy'], []),
    ]),

  quest('perfection', 'Perfection', 'story', null,
    'Perfection Rewards (Golden Scythe variants, farmhouse upgrades)',
    'Reach 100% Perfection by completing every major goal in the game. The Statue of True Perfection awaits.',
    [
      step('perf-1', 'Ship every item in the game.', null, [], []),
      step('perf-2', 'Cook every recipe.', null, [], []),
      step('perf-3', 'Craft every item.', null, [], []),
      step('perf-4', 'Catch every fish.', null, [], []),
      step('perf-5', 'Complete the Museum collection (donate all artifacts and minerals).', null, [], []),
      step('perf-6', 'Befriend every villager to maximum hearts.', null, [], []),
      step('perf-7', 'Achieve Grandpa\'s 4-candle evaluation.', 'Have 12+ Grandpa Points by Spring 1, Year 3.', [], []),
      step('perf-8', 'Complete the Community Center or Joja route.', null, [], []),
      step('perf-9', 'Achieve full Mastery (level 10+ in all 5 skills).', null, [], []),
    ]),

  quest('grandpas-evaluation', 'Grandpa\'s Evaluation', 'story', null,
    'Statue of Perfection',
    'On the night of Spring 1, Year 3, Grandpa\'s ghost will evaluate your progress on the farm. Earn enough points for 4 candles to receive the Statue of Perfection.',
    [
      step('ge-1', 'Earn at least 12 Grandpa Points before Spring 1, Year 3.', 'Points come from earning gold, friendship, and completing milestones.', [], []),
      step('ge-2', 'Receive the Statue of Perfection for achieving 4 candles.', null, [], []),
    ]),

  // Misc bulletin-board / help-wanted quests
  quest('blacksmith-request', 'A Favor For Clint', 'misc', 'clint',
    '1000g',
    'Clint has asked you to bring him a specific ore or bar. Check the Help Wanted board outside Pierre\'s for today\'s request.',
    [
      step('br-1', 'Check the Help Wanted board for Clint\'s request.', null, ['clint'], []),
      step('br-2', 'Deliver the requested item to Clint.', null, ['clint'], []),
    ]),

  quest('fishing-request', 'Fishing Request', 'misc', 'willy',
    '500g–2500g',
    'A villager has posted a request on the Help Wanted board for a specific fish.',
    [
      step('fr-1', 'Check the Help Wanted board outside Pierre\'s.', null, [], []),
      step('fr-2', 'Catch the requested fish and deliver it to the requester.', null, [], []),
    ]),

  quest('crop-request', 'Crop Delivery', 'misc', null,
    '500g–1500g',
    'A villager has posted a Help Wanted request for a specific crop or forage item.',
    [
      step('cr-1', 'Check the Help Wanted board outside Pierre\'s General Store.', null, [], []),
      step('cr-2', 'Bring the requested crop or forage item to the requester.', null, [], []),
    ]),

  quest('gift-for-emily', 'Emily\'s Cloth Request', 'misc', 'emily',
    '500g + friendship',
    'Emily has asked if you could bring her some Cloth for her fabric projects.',
    [
      step('ge-1', 'Make Cloth by putting Wool through a Loom.', null, ['emily'], ['wool', 'cloth']),
      step('ge-2', 'Give the Cloth to Emily.', null, ['emily'], ['cloth']),
    ]),

  quest('harveys-checkup', 'Harvey\'s Checkup', 'misc', 'harvey',
    '500g + friendship',
    'Harvey wants you to come in for a checkup at the clinic.',
    [
      step('hc-1', 'Visit Harvey\'s Clinic between 9am and 3pm.', null, ['harvey'], []),
    ]),

  quest('linus-rock-porridge', 'Linus\' Rock Porridge', 'misc', 'linus',
    '500g + friendship',
    'Linus has asked you to bring him a Geode. He says he has a recipe that calls for one.',
    [
      step('lrp-1', 'Obtain a Geode from the Mines.', null, ['linus'], ['geode']),
      step('lrp-2', 'Deliver the Geode to Linus at his tent on the Mountain.', null, ['linus'], ['geode']),
    ]),

  quest('pennys-books', 'Penny\'s Books', 'misc', 'penny',
    '500g + friendship',
    'Penny is looking for a specific book from the Library or a resource for teaching the children.',
    [
      step('pb-1', 'Speak to Penny at the Library/Trailer.', null, ['penny'], []),
      step('pb-2', 'Deliver the requested item to Penny.', null, ['penny'], []),
    ]),

  // Special Orders
  quest('the-pirates-wife-special', 'The Pirate\'s Wife (Special Order)', 'special_order', 'marlon',
    '5000g',
    'An extension of the pirate\'s wife storyline. Marlon posts a special order for rare sea artifacts.',
    [
      step('tpws-1', 'Check the Special Orders board outside the Mayor\'s Manor.', null, ['marlon'], []),
      step('tpws-2', 'Complete the order within the 7-day time limit.', null, [], []),
    ]),

  quest('crop-order', 'Harvest The Valley', 'special_order', null,
    '5000g–10000g + bonus',
    'A special order posted on the Mayor\'s board asking for a large quantity of a high-value crop.',
    [
      step('co-1', 'Check the Special Orders board at the start of the week.', null, [], []),
      step('co-2', 'Grow and ship the requested quantity within 7 days.', null, [], []),
    ]),

  quest('demetrius-order', 'Demetrius\' Field Study', 'special_order', 'demetrius',
    '7500g + new recipe',
    'Demetrius wants you to gather specific resources for his scientific research.',
    [
      step('do-1', 'Accept Demetrius\'s Special Order from the board.', null, ['demetrius'], []),
      step('do-2', 'Collect the requested natural resources (e.g., Slimes, Bat Wings, specific fish).', null, [], []),
      step('do-3', 'Deliver to Demetrius\'s Lab at the Mountain.', null, ['demetrius'], []),
    ]),

  quest('winnies-delivery', 'A Curious Substance', 'special_order', null,
    '5000g',
    'The Witch wants you to bring her a rare magical item. Her request appears as a special order.',
    [
      step('wd-1', 'Accept the order from the Special Orders board.', null, [], []),
      step('wd-2', 'Obtain and deliver the required magical substance.', null, [], []),
    ]),

  quest('gunthers-order', 'Gunther\'s Excavation', 'special_order', 'gunther',
    '3000g + artifact unlock',
    'Gunther is seeking a specific set of artifacts or minerals for the Museum. Completing his order may unlock additional exhibits.',
    [
      step('guo-1', 'Accept Gunther\'s Special Order from the Mayor\'s board.', null, ['gunther'], []),
      step('guo-2', 'Collect the requested artifacts or minerals.', 'Use a Hoe on Artifact Spots marked by wriggling worms.', [], []),
      step('guo-3', 'Donate them to the Museum.', null, ['gunther'], []),
    ]),

  quest('sos-qi', 'A Winter Mystery (Qi)', 'special_order', null,
    'Mr. Qi rewards (Qi Gems)',
    'Mr. Qi has posted a challenging special order. Complete it within the time limit for Qi Gems.',
    [
      step('sq-1', 'Accept Mr. Qi\'s order from the Special Orders board.', null, [], []),
      step('sq-2', 'Complete the specific challenge listed in the order.', null, [], []),
      step('sq-3', 'Report back to Mr. Qi\'s walnut box.', null, [], []),
    ]),

  quest('willy-order', 'Willy\'s Tackle Box', 'special_order', 'willy',
    '5000g + new fishing tackle',
    'Willy needs specific fish delivered for a special project. Rewards include unique fishing tackle.',
    [
      step('wo-1', 'Accept Willy\'s Special Order from the board.', null, ['willy'], []),
      step('wo-2', 'Catch and deliver the listed fish to Willy\'s Fish Shop.', null, ['willy'], []),
    ]),

  quest('robin-order', 'Robin\'s Project', 'special_order', 'robin',
    '4000g + building discount',
    'Robin needs a large amount of wood and stone for a construction project. Rewards include a discount on future buildings.',
    [
      step('ro-1', 'Accept Robin\'s Special Order from the Mayor\'s board.', null, ['robin'], []),
      step('ro-2', 'Gather the requested Wood, Stone, and/or Hardwood.', null, [], ['wood', 'stone', 'hardwood']),
      step('ro-3', 'Deliver the materials to Robin\'s Carpenter Shop.', null, ['robin'], []),
    ]),

  quest('clint-order', 'Clint\'s Masterwork', 'special_order', 'clint',
    '5000g + new tool upgrade',
    'Clint needs rare metal bars to forge a masterwork. Complete his special order for a reward.',
    [
      step('clo-1', 'Accept Clint\'s Special Order from the Mayor\'s board.', null, ['clint'], []),
      step('clo-2', 'Deliver the required metal bars to the Blacksmith.', null, ['clint'], ['gold-bar', 'iridium-bar']),
    ]),

  // Joja route
  quest('joja-greenhouse', 'Joja Greenhouse Project', 'joja', null,
    'Greenhouse unlocked',
    'After buying a JojaMart Membership, fund the Greenhouse community project for 35,000g.',
    [
      step('jgg-1', 'Purchase a JojaMart Membership from Morris.', null, [], []),
      step('jgg-2', 'Pay 35,000g at the JojaMart customer service desk for the Greenhouse.', null, [], []),
    ]),

  quest('joja-bridge', 'Joja Bridge Repair', 'joja', null,
    'Bridge repaired (access to Quarry)',
    'Fund the bridge repair project through JojaMart for 25,000g.',
    [
      step('jjb-1', 'Pay 25,000g at JojaMart customer service for the bridge repair.', null, [], []),
    ]),

  quest('joja-minecarts', 'Joja Minecarts', 'joja', null,
    'Minecarts restored',
    'Fund the minecart repair through JojaMart for 15,000g.',
    [
      step('jmc-1', 'Pay 15,000g at JojaMart customer service for the minecarts.', null, [], []),
    ]),

  quest('joja-bus', 'Joja Bus Repair', 'joja', null,
    'Bus repaired (access to Calico Desert)',
    'Fund the bus repair through JojaMart for 40,000g.',
    [
      step('jbus-1', 'Pay 40,000g at JojaMart customer service for the bus repair.', null, [], []),
    ]),

  quest('joja-glittering-boulder', 'Joja Boulder Removal', 'joja', null,
    'Mountain Lake area accessible',
    'Fund the removal of the Glittering Boulder through JojaMart for 50,000g.',
    [
      step('jgb-1', 'Pay 50,000g at JojaMart customer service to remove the boulder.', null, [], []),
    ]),
];

// ── PATCH ──────────────────────────────────────────────────────────────────

let addedItems = 0;
let skippedItems = 0;
let addedQuests = 0;
let skippedQuests = 0;

for (const it of newItems) {
  if (existingItemIds.has(it.id)) {
    skippedItems++;
  } else {
    data.items.push(it);
    existingItemIds.add(it.id);
    addedItems++;
  }
}

for (const q of newQuests) {
  if (existingQuestIds.has(q.id)) {
    skippedQuests++;
  } else {
    data.quests.push(q);
    existingQuestIds.add(q.id);
    addedQuests++;
  }
}

writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf8');

console.log(`Done.`);
console.log(`  Items:  +${addedItems} added, ${skippedItems} already present (total: ${data.items.length})`);
console.log(`  Quests: +${addedQuests} added, ${skippedQuests} already present (total: ${data.quests.length})`);
