/**
 * Mechanic taxonomy for the Atlas tree.
 *
 * GGG's export has no "which league mechanic is this node about?" field, but the
 * node's `icon` path encodes it: `.../AtlasTrees/AbyssNode1.png`, `EssenceNotable2.png`,
 * `AtlasPassiveMasteryBreach.png`. Stripping the directory and the trailing digits
 * leaves ~178 distinct icon bases, which collapse onto the ~43 mechanics below.
 *
 * `scripts/fetch-tree.ts` applies this at build time and writes a `m` field onto every
 * node, so the client never has to parse icon paths. The script fails loudly on an
 * unmapped icon base, which is how a new league's mechanic gets noticed.
 */

export type MechanicId =
  | 'abyss' | 'anomalies' | 'azmeri' | 'bestiary' | 'betrayal' | 'beyond'
  | 'blight' | 'breach' | 'conquerors' | 'delirium' | 'divination' | 'eater'
  | 'elderShaper' | 'essence' | 'exarch' | 'expedition' | 'gateways' | 'gold'
  | 'harvest' | 'incursion' | 'labyrinth' | 'legion' | 'magicMonsters'
  | 'mapDrops' | 'mapMods' | 'maven' | 'memories' | 'mercenaries' | 'mirage'
  | 'packSize' | 'rareMonsters' | 'ritual' | 'rogueExiles' | 'sentinel'
  | 'settlers' | 'shrines' | 'strongbox' | 'synthesis' | 'threads' | 'torment'
  | 'ultimatum' | 'uniqueMonsters' | 'general'

export interface Mechanic {
  id: MechanicId
  label: string
}

/** Display order: alphabetical by label, with the catch-all last. */
export const MECHANICS: Mechanic[] = [
  { id: 'abyss', label: 'Abyss' },
  { id: 'anomalies', label: 'Atlas Anomalies' },
  { id: 'memories', label: 'Atlas Memories' },
  { id: 'bestiary', label: 'Bestiary' },
  { id: 'betrayal', label: 'Betrayal' },
  { id: 'beyond', label: 'Beyond' },
  { id: 'blight', label: 'Blight' },
  { id: 'breach', label: 'Breach' },
  { id: 'conquerors', label: 'Conquerors' },
  { id: 'delirium', label: 'Delirium' },
  { id: 'divination', label: 'Divination Cards' },
  { id: 'essence', label: 'Essence' },
  { id: 'expedition', label: 'Expedition' },
  { id: 'gateways', label: 'Gateways' },
  { id: 'general', label: 'General' },
  { id: 'gold', label: 'Gold' },
  { id: 'harvest', label: 'Harvest' },
  { id: 'incursion', label: 'Incursion' },
  { id: 'labyrinth', label: 'Labyrinth' },
  { id: 'legion', label: 'Legion' },
  { id: 'magicMonsters', label: 'Magic Monsters' },
  { id: 'mapDrops', label: 'Map Drops' },
  { id: 'mapMods', label: 'Map Modifiers' },
  { id: 'maven', label: 'The Maven' },
  { id: 'mercenaries', label: 'Mercenaries' },
  { id: 'mirage', label: 'Mirage' },
  { id: 'packSize', label: 'Pack Size & Rarity' },
  { id: 'rareMonsters', label: 'Rare Monsters' },
  { id: 'ritual', label: 'Ritual' },
  { id: 'rogueExiles', label: 'Rogue Exiles' },
  { id: 'sentinel', label: 'Sentinel' },
  { id: 'settlers', label: 'Settlers of Kalguur' },
  { id: 'elderShaper', label: 'Shaper & Elder' },
  { id: 'shrines', label: 'Shrines' },
  { id: 'strongbox', label: 'Strongboxes' },
  { id: 'synthesis', label: 'Synthesis' },
  { id: 'eater', label: 'The Eater of Worlds' },
  { id: 'exarch', label: 'The Searing Exarch' },
  { id: 'threads', label: 'Threads' },
  { id: 'torment', label: 'Torment' },
  { id: 'ultimatum', label: 'Ultimatum' },
  { id: 'uniqueMonsters', label: 'Unique Monsters' },
  { id: 'azmeri', label: 'Viridian Wildwood' },
]

export const MECHANIC_BY_ID = new Map(MECHANICS.map((m) => [m.id, m]))

/**
 * Colour is assigned on selection, not owned by the mechanic.
 *
 * Giving all 43 mechanics a fixed hue produced 46 pairs closer than deltaE 14 —
 * Atlas Anomalies and Sentinel were deltaE 2.9 apart, which is to say the same
 * colour. No palette separates 43 categories. Since you only ever have a handful
 * selected at once, the colours that need to be distinguishable are only ever a
 * handful, so they come from this short, well-separated list in selection order.
 * Everything unselected stays neutral, which also means colour on screen always
 * carries meaning rather than decorating.
 */
export const SELECTION_PALETTE = [
  '#4db5ff', // blue
  '#ffb84d', // amber
  '#7fd06a', // green
  '#ff6ad5', // magenta
  '#5ce0c8', // teal
  '#c58cff', // violet
  '#ff7a5c', // coral
  '#e8e04d', // yellow
] as const

export const NEUTRAL_MECHANIC_COLOR = '#6b7585'

/** The colour a mechanic should be drawn in, given the current selection order. */
export function mechanicColor(id: MechanicId, selected: readonly MechanicId[]): string {
  const i = selected.indexOf(id)
  return i < 0 ? NEUTRAL_MECHANIC_COLOR : SELECTION_PALETTE[i % SELECTION_PALETTE.length]!
}

/**
 * Icon base (filename minus directory, trailing digits and `.png`) -> mechanic.
 * Derived from the full icon-base census of the 3.30.0 export.
 */
export const ICON_BASE_TO_MECHANIC: Record<string, MechanicId> = {
  // --- Abyss ---
  AbyssCrack: 'abyss', AbyssMonstersSpawn: 'abyss', AbyssNode: 'abyss',
  AbyssNotable: 'abyss', AtlasPassiveMasteryAbyss: 'abyss',

  // --- Incursion (Alva) ---
  AlvaNode: 'incursion', AlvaNotable: 'incursion', AtlasPassiveMasteryAlva: 'incursion',

  // --- Rogue Exiles (Anarchy) ---
  Anarchy: 'rogueExiles', AnarchyNode: 'rogueExiles', AnarchyNotable: 'rogueExiles',
  AtlasPassiveMasteryAnarchy: 'rogueExiles',

  // --- Ritual ---
  ArbitraryTenets: 'ritual', Ritual: 'ritual', RitualChanceBloodFilledVessel: 'ritual',
  RitualNode: 'ritual', RitualNotable: 'ritual', RitualReducedCostDeferRewards: 'ritual',
  RitualReduceRerollCost: 'ritual', AtlasPassiveMasteryRitual: 'ritual',

  // --- Labyrinth ---
  Ascendancy: 'labyrinth', AscendancyNode: 'labyrinth', AtlasPassiveMasteryLabyrinth: 'labyrinth',

  // --- Atlas Anomalies ---
  AtlasAnomalies: 'anomalies', AtlasPassiveMasteryAnomalies: 'anomalies',
  EagonKeystone: 'anomalies',

  // --- Divination Cards ---
  AtlasDivinationCards: 'divination', AtlasPassiveMasteryDivination: 'divination',
  ScryingOrbNode: 'divination', ScryingOrbNotable: 'divination',
  TwinProphecyKeystone: 'divination',

  // --- Gold ---
  AtlasGold: 'gold', AtlasPassiveMasteryGold: 'gold',

  // --- Harvest ---
  AtlasHarvestLifeforceDuplicated: 'harvest', HarvestNode: 'harvest',
  HarvestNotable: 'harvest', AtlasPassiveMasteryHarvest: 'harvest',

  // --- Magic Monsters ---
  AtlasMagicmonsters: 'magicMonsters', AtlasMagicmonstersNode: 'magicMonsters',
  AtlasPassiveMasteryMagicMonsters: 'magicMonsters',
  // 13 of the 14 nodes using this icon are "Map Magic Monsters"; the odd one out
  // (Thorough Exploration) is redirected by NAME_OVERRIDES below.
  NewAtlasKeystone: 'magicMonsters',

  // --- Map Modifiers ---
  AtlasMapModGenericNotable: 'mapMods', ModifierTier: 'mapMods',

  // --- Atlas Memories ---
  AtlasMemoriesNode: 'memories', AtlasMemoriesNotableAnger: 'memories',
  AtlasMemoriesNotableBenevolence: 'memories', AtlasMemoriesNotableIgnorance: 'memories',
  AtlasMemoriesNotableMemoryTears: 'memories', AtlasPassiveMasteryMemories: 'memories',

  // --- Viridian Wildwood (Azmeri) ---
  AzmeriForest: 'azmeri', AzmeriForestNotable: 'azmeri',
  AtlasPassiveMasteryAzmeriForest: 'azmeri', MorePrimalWisps: 'azmeri',

  // --- Bestiary ---
  Bestiarybosses: 'bestiary', BestiaryNode: 'bestiary', BestiaryNotable: 'bestiary',
  AtlasPassiveMasteryBestiary: 'bestiary',

  // --- Beyond ---
  BeyondNode: 'beyond', BeyondNotable: 'beyond', AtlasPassiveMasteryBeyond: 'beyond',

  // --- Blight ---
  BlightedLands: 'blight', BlightInfectedMap: 'blight', BlightMapsEncounter: 'blight',
  BlightNode: 'blight', BlightNotable: 'blight', AtlasPassiveMasteryBlight: 'blight',
  CassiasPride: 'blight',

  // --- Map drops / shaping ---
  BossMapDrops: 'mapDrops', Mapnode: 'mapDrops', Mapnotable: 'mapDrops',
  AtlasPassiveMasteryMap: 'mapDrops', TwistOfFateKeystone: 'mapDrops',

  // --- Conquerors ---
  ConquerorNode: 'conquerors', ConquerorNotable: 'conquerors',
  AtlasPassiveMasteryConqueror: 'conquerors',

  // --- Delirium ---
  DeliriumNode: 'delirium', DeliriumNotable: 'delirium',
  AtlasPassiveMasteryDelirium: 'delirium',

  // --- The Maven ---
  DestructivePlay: 'maven', TheMaven: 'maven', TheMavenNode: 'maven',

  // --- Shaper & Elder ---
  ElderShaperNode: 'elderShaper', ElderShaperNotable: 'elderShaper',
  AtlasPassiveMasteryElderShaper: 'elderShaper',

  // --- The Eater of Worlds (Tangle) ---
  TheTangle: 'eater', TheTangleNode: 'eater', AtlasPassiveMasteryTangle: 'eater',
  EldritchGazeKeystone: 'eater',

  // --- The Searing Exarch (Cleansing Fire) ---
  TheCleansingFire: 'exarch', TheCleansingFireNode: 'exarch',
  AtlasPassiveMasteryCleansingFire: 'exarch', WrathOfTheCosmosKeystone: 'exarch',

  // --- Essence ---
  EssenceNode: 'essence', EssenceNotable: 'essence', AtlasPassiveMasteryEssence: 'essence',

  // --- Expedition ---
  ExpeditionNode: 'expedition', ExpeditionNotable: 'expedition',
  ExpeditionSpawnMissingLife: 'expedition', ExtremeArchaeology: 'expedition',
  AtlasPassiveMasteryExpedition: 'expedition',

  // --- Shrines (Domination) ---
  GreedShrinenoteble: 'shrines', Shrines: 'shrines', ShrinesNode: 'shrines',
  AtlasPassiveMasteryDomination: 'shrines',

  // --- Ultimatum ---
  GruelingGauntletKeystone: 'ultimatum', RuinousWagerKeystone: 'ultimatum',
  UltimatumNode: 'ultimatum', UltimatumNotable: 'ultimatum',
  UltimatumNotableMonsters: 'ultimatum', AtlasPassiveMasteryUltimatum: 'ultimatum',

  // --- Pack size, quantity & rarity ---
  ItemQuantity: 'packSize', ItemQuantityandRarity: 'packSize',

  // --- Betrayal (Jun) ---
  JunNode: 'betrayal', JunNotable: 'betrayal', AtlasPassiveMasteryJun: 'betrayal',

  // --- Settlers of Kalguur ---
  KalguurNode: 'settlers', KalguurNotable: 'settlers',
  AtlasPassiveMasterySettlers: 'settlers',

  // --- Legion ---
  LegionAdditionalReward: 'legion', LegionNode: 'legion', LegionNotable: 'legion',
  LegionPackSize: 'legion', RuptureMeter: 'legion', AtlasPassiveMasteryLegion: 'legion',

  // --- Gateways (wormholes) ---
  MasteryBlank: 'gateways',

  // --- Mercenaries ---
  MercAppear: 'mercenaries', MercenaryFighting: 'mercenaries', MercGold: 'mercenaries',
  MercInt: 'mercenaries', MercNode: 'mercenaries', MercOnslaught: 'mercenaries',
  MercRandomShrine: 'mercenaries', MercRucksack: 'mercenaries', MercStrength: 'mercenaries',
  AtlasPassiveMasteryMercenaries: 'mercenaries',

  // --- Mirage ---
  MirageNode: 'mirage', MirageNotable: 'mirage', AtlasPassiveMasteryMirage: 'mirage',

  // --- Breach ---
  NewBreachKeystoneUnstable: 'breach', NewBreachNode: 'breach',
  NewBreachNotable: 'breach', AtlasPassiveMasteryBreach: 'breach',

  // --- Rare monsters ---
  RareMonstersnode: 'rareMonsters', RareMonstersnotable: 'rareMonsters',
  AtlasDifficultMonstersNotable: 'rareMonsters',
  AtlasPassiveMasteryRareMonsters: 'rareMonsters',

  // --- Unique monsters ---
  AtlasUniquemonsters: 'uniqueMonsters', AtlasUniquemonstersNode: 'uniqueMonsters',
  AtlasPassiveMasteryUniqueMonsters: 'uniqueMonsters',

  // --- Sentinel ---
  SentinelNode: 'sentinel', SentinelNotable: 'sentinel',
  AtlasPassiveMasterySentinek: 'sentinel',

  // --- Torment ---
  SpeakeroftheDead: 'torment', TormentNode: 'torment', TormentNotable: 'torment',
  AtlasPassiveMasteryTorment: 'torment',

  // --- Strongboxes ---
  StrongboxCelestial: 'strongbox', StrongboxCurrency: 'strongbox',
  StrongboxDiviner: 'strongbox', StrongboxNode: 'strongbox',
  StrongboxNotable: 'strongbox', StrongboxScarab: 'strongbox',
  AtlasPassiveMasteryStrongbox: 'strongbox',

  // --- Synthesis ---
  SynthesisNode: 'synthesis', SynthesisNotable: 'synthesis',
  AtlasPassiveMasterySynthesis: 'synthesis',

  // --- Threads (3.30's replacement for scarabs) ---
  AtlasThreads: 'threads', ThreadNode: 'threads', AtlasPassiveMasteryThread: 'threads',
  StreamOfConsciousnessKeystone: 'threads',
  WheelofDisablingDelirium: 'threads', WheelofDisablingExpedition: 'threads',
  WheelofDisablingOreDesposits: 'threads', WheelofDisablingUltimatum: 'threads',

  // --- General / cross-cutting ---
  DanceofDestructKeystone: 'general', WellspringofCreationKeystone: 'general',
  OverloadedCircuits: 'general',
  // "Select a type of content to have additional chance to spawn" — the three
  // multiple-choice notables span every mechanic, so they belong to none.
  TempestNotable: 'general',
}

/**
 * Per-node corrections where a shared icon lies about the mechanic.
 * Keyed by exact node name.
 */
export const NAME_OVERRIDES: Record<string, MechanicId> = {
  // Uses the generic NewAtlasKeystone icon but is about Wildwood Wisps.
  'Thorough Exploration': 'azmeri',
}

const ICON_BASE_RE = /\d+$/

/** `Art/2DArt/SkillIcons/passives/AtlasTrees/AbyssNode1.png` -> `AbyssNode` */
export function iconBase(icon: string): string {
  const file = icon.split('/').pop() ?? ''
  return file.replace(/\.png$/i, '').replace(ICON_BASE_RE, '')
}

/** Resolve a node's mechanic, or `null` when the icon base is unknown. */
export function mechanicFor(icon: string | undefined, name: string | undefined): MechanicId | null {
  if (name && NAME_OVERRIDES[name]) return NAME_OVERRIDES[name]
  if (!icon) return null
  return ICON_BASE_TO_MECHANIC[iconBase(icon)] ?? null
}
