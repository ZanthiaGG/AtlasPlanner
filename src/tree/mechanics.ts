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
  /** Chip + node-highlight colour. Chosen to stay legible on the dark graphite bg. */
  color: string
}

/** Display order: alphabetical by label, with the catch-all last. */
export const MECHANICS: Mechanic[] = [
  { id: 'abyss', label: 'Abyss', color: '#8b7fd0' },
  { id: 'anomalies', label: 'Atlas Anomalies', color: '#7fd4c1' },
  { id: 'memories', label: 'Atlas Memories', color: '#b9a7e0' },
  { id: 'bestiary', label: 'Bestiary', color: '#d4875f' },
  { id: 'betrayal', label: 'Betrayal', color: '#9aa7b8' },
  { id: 'beyond', label: 'Beyond', color: '#c0527a' },
  { id: 'blight', label: 'Blight', color: '#9fc84a' },
  { id: 'breach', label: 'Breach', color: '#c062d8' },
  { id: 'conquerors', label: 'Conquerors', color: '#d2b48c' },
  { id: 'delirium', label: 'Delirium', color: '#cfd6e0' },
  { id: 'divination', label: 'Divination Cards', color: '#6fb8d6' },
  { id: 'essence', label: 'Essence', color: '#64d0e8' },
  { id: 'expedition', label: 'Expedition', color: '#d8c35a' },
  { id: 'gateways', label: 'Gateways', color: '#ff9f68' },
  { id: 'general', label: 'General', color: '#8d97a8' },
  { id: 'gold', label: 'Gold', color: '#e8c25a' },
  { id: 'harvest', label: 'Harvest', color: '#6ed08a' },
  { id: 'incursion', label: 'Incursion', color: '#5ac8a8' },
  { id: 'labyrinth', label: 'Labyrinth', color: '#c8b06a' },
  { id: 'legion', label: 'Legion', color: '#d9b36c' },
  { id: 'magicMonsters', label: 'Magic Monsters', color: '#6f8fe8' },
  { id: 'mapDrops', label: 'Map Drops', color: '#7f9ad0' },
  { id: 'mapMods', label: 'Map Modifiers', color: '#a0b0c4' },
  { id: 'maven', label: 'The Maven', color: '#8ad6e8' },
  { id: 'mercenaries', label: 'Mercenaries', color: '#e07f6a' },
  { id: 'mirage', label: 'Mirage', color: '#a8c8e8' },
  { id: 'packSize', label: 'Pack Size & Rarity', color: '#e8d08a' },
  { id: 'rareMonsters', label: 'Rare Monsters', color: '#f5f07a' },
  { id: 'ritual', label: 'Ritual', color: '#e05a5a' },
  { id: 'rogueExiles', label: 'Rogue Exiles', color: '#d86a9a' },
  { id: 'sentinel', label: 'Sentinel', color: '#7ad8c8' },
  { id: 'settlers', label: 'Settlers of Kalguur', color: '#c89a5a' },
  { id: 'elderShaper', label: 'Shaper & Elder', color: '#b0c8e0' },
  { id: 'shrines', label: 'Shrines', color: '#8ad0f0' },
  { id: 'strongbox', label: 'Strongboxes', color: '#c8a070' },
  { id: 'synthesis', label: 'Synthesis', color: '#9ad0e8' },
  { id: 'eater', label: 'The Eater of Worlds', color: '#9f6ad8' },
  { id: 'exarch', label: 'The Searing Exarch', color: '#e8824a' },
  { id: 'threads', label: 'Threads', color: '#4db5ff' },
  { id: 'torment', label: 'Torment', color: '#a87ad8' },
  { id: 'ultimatum', label: 'Ultimatum', color: '#d8a84a' },
  { id: 'uniqueMonsters', label: 'Unique Monsters', color: '#c8733a' },
  { id: 'azmeri', label: 'Viridian Wildwood', color: '#7fd06a' },
]

export const MECHANIC_BY_ID = new Map(MECHANICS.map((m) => [m.id, m]))

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
