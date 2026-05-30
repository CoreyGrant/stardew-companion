#!/usr/bin/env node
// Cleans up agent-added quests and adds the proper Special Orders.

const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, '..', 'public', 'gamedata.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// ── REMOVE ────────────────────────────────────────────────────────────────────
// Reasons:
//  visit-skull-cavern / the-pirates-wife-special  → duplicate of existing quests
//  blacksmith-request / fishing-request / crop-request → represent random Help Wanted
//    board mechanics, not fixed journal quests
//  gift-for-emily / harveys-checkup / linus-rock-porridge / pennys-books → fabricated
//  meet-the-wizard → 1-step stub; community-center-intro already covers this
//  demetrius-order / winnies-delivery / sos-qi / willy-order / robin-order /
//    clint-order / gunthers-order / crop-order → wrong names or inaccurate content;
//    replaced below with properly named versions
//  joja-greenhouse/bridge/minecarts/bus/joja-glittering-boulder → all covered
//    as steps inside joja-membership already

const REMOVE = new Set([
  'visit-skull-cavern',
  'the-pirates-wife-special',
  'blacksmith-request',
  'fishing-request',
  'crop-request',
  'gift-for-emily',
  'harveys-checkup',
  'linus-rock-porridge',
  'pennys-books',
  'meet-the-wizard',
  'demetrius-order',
  'winnies-delivery',
  'sos-qi',
  'willy-order',
  'robin-order',
  'clint-order',
  'gunthers-order',
  'crop-order',
  'joja-greenhouse',
  'joja-bridge',
  'joja-minecarts',
  'joja-bus',
  'joja-glittering-boulder',
]);

const before = data.quests.length;
data.quests = data.quests.filter(q => !REMOVE.has(q.id));
const removed = before - data.quests.length;

// ── IMPROVE existing quests ───────────────────────────────────────────────────

// community-center-intro: add proper steps
const cci = data.quests.find(q => q.id === 'community-center-intro');
if (cci) {
  cci.giverId = 'lewis';
  cci.reward = 'Community Center restoration begins';
  cci.description = 'Mayor Lewis mentions the old Community Center. When you investigate, you find a golden scroll in an unfamiliar language — and a group of small creatures called Junimos.';
  cci.steps = [
    { id: 'cci-1', text: 'Unlock the Community Center by entering it for the first time (no key required).',
      linkedNPCs: ['lewis'], linkedItems: [] },
    { id: 'cci-2', text: 'Inspect the golden scroll inside — you can\'t read the Junimo language.',
      linkedNPCs: [], linkedItems: [] },
    { id: 'cci-3', text: 'The Wizard sends you a letter inviting you to his tower. Visit him in Cindersap Forest.',
      linkedNPCs: ['wizard'], linkedItems: [] },
    { id: 'cci-4', text: 'The Wizard grants you the ability to understand Junimo writing. Return to the Community Center.',
      tip: 'The Wizard\'s Tower is in the south-west of Cindersap Forest. He\'s available every day.',
      linkedNPCs: ['wizard'], linkedItems: [] },
    { id: 'cci-5', text: 'Read the golden scroll — the Junimos want you to restore the Community Center by completing bundles in each room.',
      linkedNPCs: [], linkedItems: [] },
  ];
}

// ginger-island: correct 1,000g ticket price and details
const gi = data.quests.find(q => q.id === 'ginger-island');
if (gi) {
  gi.description = 'Willy\'s old boat is rotting in his back room. Repair it to sail to Ginger Island, a tropical paradise filled with resources, puzzles, and secrets.';
  gi.reward = 'Access to Ginger Island';
  gi.steps = [
    { id: 'gi-1', text: "After reaching 5 friendship hearts with Willy, he shows you his back room with a broken boat.",
      linkedNPCs: ['willy'], linkedItems: [] },
    { id: 'gi-2', text: 'Repair the Boat Hull: donate 200 Hardwood to Willy.',
      linkedNPCs: [], linkedItems: ['hardwood'] },
    { id: 'gi-3', text: 'Repair the Boat Anchor: donate 5 Iridium Bars.',
      linkedNPCs: [], linkedItems: ['iridium-bar'] },
    { id: 'gi-4', text: 'Repair the Ticket Machine: donate 5 Battery Packs.',
      linkedNPCs: [], linkedItems: ['battery-pack'] },
    { id: 'gi-5', text: 'Purchase a boat ticket from Willy for 1,000g and sail to Ginger Island.',
      tip: 'The boat departs from Willy\'s shop. You can travel back for free once per day.',
      linkedNPCs: ['willy'], linkedItems: [] },
  ];
}

// journey-to-the-desert: add Pam as giver and more detail
const jd = data.quests.find(q => q.id === 'journey-to-the-desert');
if (jd) {
  jd.giverId = 'pam';
  jd.description = 'The Calico Desert is accessible by bus from the Bus Stop, but the bus has been broken down for years. Repair it through the Community Center Vault bundles or the Joja route.';
  jd.reward = 'Access to Calico Desert, Sandy\'s shop, and Skull Cavern';
  jd.steps = [
    { id: 'jd-1', text: 'Complete the Vault room bundles at the Community Center (or fund bus repair through the Joja route).',
      linkedNPCs: [], linkedItems: [] },
    { id: 'jd-2', text: 'The bus is repaired! Pam drives it on workdays. Pay her 500g for a round trip.',
      linkedNPCs: ['pam'], linkedItems: [] },
    { id: 'jd-3', text: 'Explore the Calico Desert: visit Sandy\'s Oasis shop, find the Skull Cavern entrance, and dig up artifacts.',
      linkedNPCs: ['sandy'], linkedItems: [] },
  ];
}

// ── ADD new quests ────────────────────────────────────────────────────────────

const existingIds = new Set(data.quests.map(q => q.id));

const toAdd = [
  // Fixed NPC letter quest
  {
    id: 'marnies-request',
    name: "Marnie's Request",
    type: 'misc',
    giverId: 'marnie',
    reward: '300g',
    description: "Marnie has written to ask for an Amethyst. She'd like to give it to Jas as a gift.",
    steps: [
      { id: 'mnr-1', text: 'Obtain an Amethyst — found in the Mines on floors 1–39, inside Geodes, or as a rare forage item.',
        tip: "Geodes can be cracked open at Clint's Blacksmith for 25g each.",
        linkedNPCs: ['clint'], linkedItems: ['amethyst', 'geode'] },
      { id: 'mnr-2', text: "Give the Amethyst to Marnie at her ranch south of town.",
        linkedNPCs: ['marnie'], linkedItems: [] },
    ],
  },

  // ── Special Orders (Pierre's Board) ───────────────────────────────────────
  {
    id: 'aquatic-overpopulation',
    name: 'Aquatic Overpopulation',
    type: 'special_order',
    giverId: 'demetrius',
    reward: '2,500g',
    description: "Demetrius needs data on the Carp population — the river is overrun. Catch 100 Carp within the 7-day window.",
    steps: [
      { id: 'ao-1', text: "Accept the order from the Special Orders Board outside Pierre's shop.",
        linkedNPCs: ['pierre'], linkedItems: [] },
      { id: 'ao-2', text: 'Catch 100 Carp from any freshwater spot: river, mountain lake, ponds, or the Secret Woods.',
        tip: 'Carp are the easiest fish in the game — even a Bamboo Pole works. Add Bait to fish faster.',
        linkedNPCs: [], linkedItems: ['carp'] },
      { id: 'ao-3', text: "Deliver all 100 Carp to Demetrius at the Science House before the deadline.",
        linkedNPCs: ['demetrius'], linkedItems: [] },
    ],
  },
  {
    id: 'juicy-bugs-wanted',
    name: 'Juicy Bugs Wanted!',
    type: 'special_order',
    giverId: 'willy',
    reward: 'Super Bait recipe + 500g',
    description: "Willy is experimenting with a new bait formula and needs 500 pieces of Bug Meat within 7 days.",
    steps: [
      { id: 'jbw-1', text: "Accept the order from the Special Orders Board.",
        linkedNPCs: [], linkedItems: [] },
      { id: 'jbw-2', text: 'Kill Bugs, Cave Flies, and Grubs in the Mines — all three drop Bug Meat.',
        tip: 'Floors 1–39 are packed with bug-type enemies. A good sword makes farming fast.',
        linkedNPCs: [], linkedItems: ['bug-meat'] },
      { id: 'jbw-3', text: "Deliver 500 Bug Meat to Willy at his shop on the beach.",
        linkedNPCs: ['willy'], linkedItems: [] },
    ],
  },
  {
    id: 'rock-rejuvenation',
    name: 'Rock Rejuvenation',
    type: 'special_order',
    giverId: 'emily',
    reward: '1 Cloth + 1,000g',
    description: "Emily wants to attempt a dazzling gem fusion. Deliver one each of all seven standard gems within the time limit.",
    steps: [
      { id: 'rr-1', text: "Accept the order from the Special Orders Board.",
        linkedNPCs: [], linkedItems: [] },
      { id: 'rr-2', text: "Gather all 7 gems: Amethyst, Topaz, Jade, Aquamarine, Ruby, Emerald, and Diamond.",
        tip: 'Omni Geodes can contain any gem. Crack them open at Clint\'s Blacksmith for 25g each.',
        linkedNPCs: ['clint'], linkedItems: ['amethyst','topaz','jade','aquamarine','ruby','emerald','diamond'] },
      { id: 'rr-3', text: "Deliver all 7 gems to Emily at her house. She shares a home with Haley on Willow Lane.",
        linkedNPCs: ['emily'], linkedItems: [] },
    ],
  },
  {
    id: 'gifts-for-george',
    name: 'Gifts for George',
    type: 'special_order',
    giverId: 'evelyn',
    reward: '500g',
    description: "Evelyn wants to put together a seasonal gift basket for George. She needs a selection of crops from different seasons.",
    steps: [
      { id: 'gfg-1', text: "Accept the order from the Special Orders Board.",
        linkedNPCs: [], linkedItems: [] },
      { id: 'gfg-2', text: "Gather the requested crops. Evelyn typically asks for spring staples (Leek, Cauliflower), summer fruit (Melon), and fall produce (Pumpkin).",
        tip: "Out of season? Check the Traveling Cart on Fridays and Sundays, or grow in the Greenhouse.",
        linkedNPCs: [], linkedItems: ['leek','cauliflower','melon','pumpkin'] },
      { id: 'gfg-3', text: "Deliver the crops to Evelyn at 1 River Road.",
        linkedNPCs: ['evelyn'], linkedItems: [] },
    ],
  },
  {
    id: 'curious-substance',
    name: 'A Curious Substance',
    type: 'special_order',
    giverId: 'clint',
    reward: '1,000g',
    description: "Clint has found a mysterious residue inside Omni Geodes and wants samples for metallurgical research.",
    steps: [
      { id: 'cs-1', text: "Accept the order from the Special Orders Board.",
        linkedNPCs: [], linkedItems: [] },
      { id: 'cs-2', text: 'Collect the required number of Omni Geodes by mining and defeating enemies in the Mines.',
        tip: 'Magma Sprites in the deep Mine (floors 80+) are a reliable Omni Geode source.',
        linkedNPCs: [], linkedItems: ['omni-geode'] },
      { id: 'cs-3', text: "Deliver the Omni Geodes to Clint at his Blacksmith shop on Robin's Road.",
        linkedNPCs: ['clint'], linkedItems: [] },
    ],
  },
  {
    id: 'community-cleanup',
    name: 'Community Cleanup',
    type: 'special_order',
    giverId: 'linus',
    reward: 'Recycling Machine recipe + 1,500g',
    description: "Linus wants to restore native plants to the forest floor. Gather 20 Mixed Seeds from weeds to help him replant.",
    steps: [
      { id: 'cl-1', text: "Accept the order from the Special Orders Board.",
        linkedNPCs: [], linkedItems: [] },
      { id: 'cl-2', text: 'Collect 20 Mixed Seeds by cutting weeds with your Scythe or any weapon.',
        tip: 'Weeds are plentiful on your farm and around town, especially in spring and summer. They drop seeds when cut.',
        linkedNPCs: [], linkedItems: ['mixed-seeds'] },
      { id: 'cl-3', text: "Deliver 20 Mixed Seeds to Linus at his tent on the Mountain.",
        linkedNPCs: ['linus'], linkedItems: [] },
    ],
  },
  {
    id: 'tropical-fish',
    name: 'Tropical Fish',
    type: 'special_order',
    giverId: 'gus',
    reward: '1,500g',
    description: "Gus wants to add an exotic dish to the Saloon menu and needs a supply of tropical ocean fish.",
    steps: [
      { id: 'tf-1', text: "Accept the order from the Special Orders Board.",
        linkedNPCs: [], linkedItems: [] },
      { id: 'tf-2', text: 'Catch 10 Tuna, 10 Red Snapper, and 10 Tilapia from ocean fishing spots.',
        tip: 'Tuna: summer/winter. Red Snapper: summer/fall rainy. Tilapia: summer/fall. Fish the east pier for best access.',
        linkedNPCs: [], linkedItems: ['tuna','red-snapper','tilapia'] },
      { id: 'tf-3', text: "Deliver the fish to Gus at the Stardrop Saloon.",
        linkedNPCs: ['gus'], linkedItems: [] },
    ],
  },
  {
    id: 'crop-research',
    name: 'Crop Research',
    type: 'special_order',
    giverId: 'pierre',
    reward: '1,000g',
    description: "Pierre is collecting crop samples for agronomic research. Deliver the requested seasonal produce within the 7-day window.",
    steps: [
      { id: 'crp-1', text: "Accept the order from the Special Orders Board. The exact crops required vary each time.",
        linkedNPCs: [], linkedItems: [] },
      { id: 'crp-2', text: 'Grow or buy the requested crops. Common requests include Parsnip, Cauliflower, Melon, and Pumpkin.',
        tip: "The Traveling Cart (Fridays and Sundays) can supply out-of-season crops. Check your storage chest first.",
        linkedNPCs: [], linkedItems: ['parsnip','cauliflower','melon','pumpkin'] },
      { id: 'crp-3', text: "Deliver the crops to Pierre at his General Store.",
        linkedNPCs: ['pierre'], linkedItems: [] },
    ],
  },
  {
    id: 'island-ingredients',
    name: 'Island Ingredients',
    type: 'special_order',
    giverId: 'robin',
    reward: 'Deluxe Fertilizer recipe + 1,000g',
    description: "Robin wants to study tropical farming techniques. She needs Ginger Island crops for research.",
    steps: [
      { id: 'ii-1', text: "Accept the order from the Special Orders Board. You'll need Ginger Island access first.",
        linkedNPCs: [], linkedItems: [] },
      { id: 'ii-2', text: "Sail to Ginger Island by repairing Willy's boat, then plant Taro Root and Pineapple crops there.",
        linkedNPCs: ['willy'], linkedItems: ['taro-root','pineapple'] },
      { id: 'ii-3', text: "Harvest the crops and deliver them to Robin at her Carpenter Shop.",
        linkedNPCs: ['robin'], linkedItems: [] },
    ],
  },
  {
    id: 'fragments-of-the-past',
    name: 'Fragments of the Past',
    type: 'special_order',
    giverId: 'gunther',
    reward: 'Ossified Blade',
    description: "Gunther is reconstructing an ancient skeleton from fossil fragments. He needs 20 Bone Fragments.",
    steps: [
      { id: 'fp-1', text: "Accept the order from the Special Orders Board.",
        linkedNPCs: [], linkedItems: [] },
      { id: 'fp-2', text: 'Collect 20 Bone Fragments from fishing in the Mines or digging at the Ginger Island Dig Site.',
        tip: 'Fishing in underground Mine rivers and the Ginger Island fossil site are the most reliable sources.',
        linkedNPCs: [], linkedItems: ['bone-fragment'] },
      { id: 'fp-3', text: "Deliver 20 Bone Fragments to Gunther at the Museum.",
        linkedNPCs: ['gunther'], linkedItems: [] },
    ],
  },
  {
    id: 'carolines-order',
    name: "Pierre's Missing Stocklist",
    type: 'special_order',
    giverId: 'caroline',
    reward: '500g',
    description: "Caroline has posted a Special Order: Pierre lost his vegetable stocklist. She needs help recreating it by gathering produce samples.",
    steps: [
      { id: 'co-1', text: "Accept the order from the Special Orders Board.",
        linkedNPCs: [], linkedItems: [] },
      { id: 'co-2', text: 'Gather the requested vegetables. Caroline typically asks for spring and summer staples.',
        linkedNPCs: [], linkedItems: ['potato','green-bean','kale','tomato'] },
      { id: 'co-3', text: "Deliver the vegetables to Caroline at Pierre's shop.",
        linkedNPCs: ['caroline'], linkedItems: [] },
    ],
  },

  // ── Mr. Qi Special Orders (Ginger Island board) ────────────────────────────
  {
    id: 'qi-lets-play-a-game',
    name: "Let's Play A Game",
    type: 'special_order',
    giverId: null,
    reward: '10 Qi Gems',
    description: "Mr. Qi challenges you to complete Journey of the Prairie King without dying — all three worlds.",
    steps: [
      { id: 'qi-lpg-1', text: "Unlock Qi's Walnut Room on Ginger Island by collecting 100 Golden Walnuts.",
        tip: 'Walnuts are earned through farming, fishing, mining, and solving Ginger Island puzzles.',
        linkedNPCs: [], linkedItems: [] },
      { id: 'qi-lpg-2', text: "Accept the challenge from Mr. Qi's Special Orders Board inside his Walnut Room.",
        linkedNPCs: [], linkedItems: [] },
      { id: 'qi-lpg-3', text: "Play Journey of the Prairie King at the Stardrop Saloon arcade machine and finish all three worlds without dying.",
        tip: "Eat food that doesn't give energy (like Coffee) before playing so your energy bar stays out of the way. Buy mid-game upgrades when offered.",
        linkedNPCs: [], linkedItems: [] },
    ],
  },
  {
    id: 'qi-extended-family',
    name: 'Extended Family',
    type: 'special_order',
    giverId: null,
    reward: '40 Qi Gems',
    description: "Mr. Qi challenges you to catch all five Qi-Bean variants of the Legendary Fish using special Qi Bait.",
    steps: [
      { id: 'qi-ef-1', text: "Accept the challenge from Qi's Special Orders Board.",
        linkedNPCs: [], linkedItems: [] },
      { id: 'qi-ef-2', text: "Buy Qi Bait from Qi's shop (10 Qi Gems per pack). You must use Qi Bait at each Legendary Fish location.",
        tip: 'Qi Bait lets you catch the Legendary II fish even if you caught the originals in a previous year.',
        linkedNPCs: [], linkedItems: [] },
      { id: 'qi-ef-3', text: "Catch all five: Ms. Angler (river north of JojaMart, Fall), Son of Crimsonfish (east pier, Summer), Radioactive Carp (Sewers), Glacier Fish Jr. (south island pond, Winter), Legend II (mountain lake, Spring).",
        tip: 'Each is caught at the same location as its parent, but requires Qi Bait instead of the season/weather check.',
        linkedNPCs: [], linkedItems: [] },
    ],
  },
  {
    id: 'qi-danger-in-the-deep',
    name: 'Danger In The Deep',
    type: 'special_order',
    giverId: null,
    reward: '40 Qi Gems',
    description: "Mr. Qi activates Danger Mode in the regular Mine. Reach floor 100 while all monsters are harder and more numerous.",
    steps: [
      { id: 'qi-did-1', text: "Accept the challenge from Qi's Special Orders Board.",
        linkedNPCs: [], linkedItems: [] },
      { id: 'qi-did-2', text: "Enter the Mine. In Danger Mode all enemies have more HP and deal more damage. Descend to floor 100.",
        tip: 'Bring your best sword, rings (Napalm Ring for clearing crowds), and stack HP-restoring food.',
        linkedNPCs: [], linkedItems: [] },
      { id: 'qi-did-3', text: "Reach floor 100 to complete the challenge and claim your reward.",
        linkedNPCs: [], linkedItems: [] },
    ],
  },
  {
    id: 'qi-skull-cavern-invasion',
    name: 'Skull Cavern Invasion',
    type: 'special_order',
    giverId: null,
    reward: '40 Qi Gems',
    description: "Mr. Qi activates Danger Mode in the Skull Cavern. Reach floor 100 under these harrowing conditions.",
    steps: [
      { id: 'qi-sci-1', text: "Accept the challenge from Qi's Special Orders Board.",
        linkedNPCs: [], linkedItems: [] },
      { id: 'qi-sci-2', text: "Travel to the Skull Cavern in the Calico Desert. All monsters are stronger in Danger Mode.",
        tip: 'Pre-craft at least 100 Staircases (99 Stone each) and pack Bombs, Mega Bombs, and Lucky food.',
        linkedNPCs: [], linkedItems: ['iridium-bar'] },
      { id: 'qi-sci-3', text: "Reach floor 100 of the Skull Cavern in Danger Mode to complete the challenge.",
        linkedNPCs: [], linkedItems: [] },
    ],
  },
  {
    id: 'qi-four-precious-stones',
    name: 'Four Precious Stones',
    type: 'special_order',
    giverId: null,
    reward: '40 Qi Gems',
    description: "Mr. Qi demands four Prismatic Shards as proof you've mastered the Skull Cavern.",
    steps: [
      { id: 'qi-fps-1', text: "Accept the challenge from Qi's Special Orders Board.",
        linkedNPCs: [], linkedItems: [] },
      { id: 'qi-fps-2', text: "Farm Prismatic Shards from the Skull Cavern — they drop from Iridium Nodes and Omni Geode clusters on deep floors.",
        tip: 'Each deep-dive run has a chance at 1–2 shards. Lucky days dramatically increase drop rates.',
        linkedNPCs: [], linkedItems: ['prismatic-shard'] },
      { id: 'qi-fps-3', text: "Deliver 4 Prismatic Shards to complete the challenge.",
        linkedNPCs: [], linkedItems: [] },
    ],
  },
];

let added = 0;
for (const quest of toAdd) {
  if (!existingIds.has(quest.id)) {
    data.quests.push(quest);
    existingIds.add(quest.id);
    added++;
  }
}

fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
console.log(`Removed ${removed} quests, added ${added} quests.`);
console.log(`Total quests: ${data.quests.length}`);
