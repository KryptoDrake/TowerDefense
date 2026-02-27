// Unit configuration system - maps each of the 20 weapons to a deployable unit

import { WeaponKey } from '../systems/BalanceConfig';

export type UnitRole = 'tank' | 'dps_melee' | 'dps_ranged' | 'support' | 'specialist';
export type UnitElement = 'physical' | 'fire' | 'ice' | 'lightning' | 'poison' | 'arcane' | 'nature' | 'dark';

export interface UnitDef {
  id: string;
  name: string;
  sourceWeapon: WeaponKey | null;
  hp: number;
  attack: number;
  defense: number;
  speed: number;         // Bewegungsgeschwindigkeit (Auto-Battle), Zugpriorität (Arena)
  attackRange: number;   // 1 = Nahkampf, >1 = Fernkampf (in Rasterzellen)
  attackSpeed: number;   // Angriffe pro Sekunde
  role: UnitRole;
  element: UnitElement;
  color: number;         // Primärfarbe für Mesh
  tier: 1 | 2 | 3 | 4;  // Shop-Stufe (basierend auf Original-Waffenkosten)
  shopCost: number;      // Goldkosten im Auto-Battle Shop (Stufe 1=1, 2=2, 3=3, 4=4)
  // Fähigkeitsbeschreibung für Tooltip
  abilityName: string;
  abilityDesc: string;
}

// Elementvorteil-Multiplikatoren
// Gleiches Element = 0.5x, Vorteil = 1.3x oder 1.5x, Neutral = 1.0x
export const ELEMENT_ADVANTAGE: Record<UnitElement, Partial<Record<UnitElement, number>>> = {
  physical: {
    physical: 0.5,
  },
  fire: {
    fire: 0.5,
    ice: 1.5,
    nature: 1.5,
  },
  ice: {
    ice: 0.5,
    lightning: 1.5,
    nature: 1.3,
  },
  lightning: {
    lightning: 0.5,
    arcane: 1.5,
    ice: 1.3,
  },
  poison: {
    poison: 0.5,
    nature: 1.5,
    dark: 1.3,
  },
  arcane: {
    arcane: 0.5,
    dark: 1.5,
    lightning: 1.3,
  },
  nature: {
    nature: 0.5,
    lightning: 1.5,
    physical: 1.3,
  },
  dark: {
    dark: 0.5,
    arcane: 1.5,
    nature: 1.3,
  },
};

/**
 * Gibt den Elementvorteil-Multiplikator zurück.
 * Standard ist 1.0 (neutral) wenn keine spezielle Beziehung definiert ist.
 */
export function getElementMultiplier(attackerElement: UnitElement, defenderElement: UnitElement): number {
  const advantages = ELEMENT_ADVANTAGE[attackerElement];
  if (advantages && defenderElement in advantages) {
    return advantages[defenderElement]!;
  }
  return 1.0;
}

// ─── Alle 20 Einheiten-Definitionen ─────────────────────────────────────────

export const UNIT_DEFS: Record<string, UnitDef> = {
  // ─── Stufe 1 (Basis-Einheiten) ──────────────────
  archer: {
    id: 'archer',
    name: 'Bogenschütze',
    sourceWeapon: 'arrowTower',
    hp: 60,
    attack: 15,
    defense: 5,
    speed: 3.0,
    attackRange: 6,
    attackSpeed: 2.0,
    role: 'dps_ranged',
    element: 'physical',
    color: 0x8B4513,
    tier: 1,
    shopCost: 1,
    abilityName: 'Schnellschuss',
    abilityDesc: 'Feuert schnelle Pfeile auf einzelne Ziele. Hohe Angriffsgeschwindigkeit.',
  },
  bomber: {
    id: 'bomber',
    name: 'Sprengmeister',
    sourceWeapon: 'landmine',
    hp: 30,
    attack: 200,
    defense: 1,
    speed: 0.5,
    attackRange: 1,
    attackSpeed: 0.2,
    role: 'specialist',
    element: 'physical',
    color: 0x555555,
    tier: 1,
    shopCost: 1,
    abilityName: 'Selbstzerstörung',
    abilityDesc: 'Opfert sich für massiven Flächenschaden. Einmalig, aber verheerend.',
  },
  trapper: {
    id: 'trapper',
    name: 'Fallensteller',
    sourceWeapon: 'spikeTrap',
    hp: 45,
    attack: 8,
    defense: 3,
    speed: 2.0,
    attackRange: 1,
    attackSpeed: 2.0,
    role: 'specialist',
    element: 'physical',
    color: 0x888888,
    tier: 1,
    shopCost: 1,
    abilityName: 'Stachelfalle',
    abilityDesc: 'Legt Fallen, die Gegnern Dauerschaden zufügen und sie verlangsamen.',
  },
  frost_bomber: {
    id: 'frost_bomber',
    name: 'Frostbomber',
    sourceWeapon: 'frostMine',
    hp: 35,
    attack: 20,
    defense: 2,
    speed: 1.0,
    attackRange: 2,
    attackSpeed: 0.3,
    role: 'specialist',
    element: 'ice',
    color: 0x88ccff,
    tier: 1,
    shopCost: 1,
    abilityName: 'Frostexplosion',
    abilityDesc: 'Friert alle nahen Gegner für 3 Sekunden ein. Einmalige Detonation.',
  },
  prospector: {
    id: 'prospector',
    name: 'Goldgräber',
    sourceWeapon: 'goldMine',
    hp: 60,
    attack: 0,
    defense: 5,
    speed: 1.5,
    attackRange: 0,
    attackSpeed: 0,
    role: 'support',
    element: 'physical',
    color: 0xffcc00,
    tier: 1,
    shopCost: 1,
    abilityName: 'Goldader',
    abilityDesc: 'Generiert passiv Gold über Zeit. Kämpft nicht, aber stärkt die Wirtschaft.',
  },

  // ─── Stufe 2 (Fortgeschrittene Einheiten) ─────────
  cannoneer: {
    id: 'cannoneer',
    name: 'Kanonier',
    sourceWeapon: 'cannonTower',
    hp: 80,
    attack: 40,
    defense: 8,
    speed: 1.5,
    attackRange: 5,
    attackSpeed: 0.7,
    role: 'dps_ranged',
    element: 'physical',
    color: 0x444444,
    tier: 2,
    shopCost: 2,
    abilityName: 'Kanonenkugel',
    abilityDesc: 'Verschießt explodierende Kugeln mit Flächenschaden.',
  },
  frost_mage: {
    id: 'frost_mage',
    name: 'Frostmagier',
    sourceWeapon: 'iceTower',
    hp: 55,
    attack: 5,
    defense: 4,
    speed: 2.5,
    attackRange: 5,
    attackSpeed: 1.5,
    role: 'support',
    element: 'ice',
    color: 0x88ccff,
    tier: 2,
    shopCost: 2,
    abilityName: 'Froststrahl',
    abilityDesc: 'Verlangsamt getroffene Gegner stark. Geringer Schaden, hohe Kontrolle.',
  },
  fire_mage: {
    id: 'fire_mage',
    name: 'Feuermagier',
    sourceWeapon: 'fireTower',
    hp: 50,
    attack: 8,
    defense: 3,
    speed: 3.5,
    attackRange: 4,
    attackSpeed: 3.0,
    role: 'dps_ranged',
    element: 'fire',
    color: 0xff4400,
    tier: 2,
    shopCost: 2,
    abilityName: 'Feuersalve',
    abilityDesc: 'Schnelle Feuergeschosse, die Schaden über Zeit verursachen.',
  },
  alchemist: {
    id: 'alchemist',
    name: 'Giftmischer',
    sourceWeapon: 'poisonTower',
    hp: 70,
    attack: 3,
    defense: 4,
    speed: 2.0,
    attackRange: 5,
    attackSpeed: 1.0,
    role: 'specialist',
    element: 'poison',
    color: 0x27ae60,
    tier: 2,
    shopCost: 2,
    abilityName: 'Giftwolke',
    abilityDesc: 'Erzeugt eine Giftwolke, die Flächenschaden über Zeit verursacht.',
  },
  wind_caller: {
    id: 'wind_caller',
    name: 'Windstoßer',
    sourceWeapon: 'windTower',
    hp: 60,
    attack: 5,
    defense: 5,
    speed: 3.0,
    attackRange: 5,
    attackSpeed: 0.8,
    role: 'support',
    element: 'nature',
    color: 0x88ddcc,
    tier: 2,
    shopCost: 2,
    abilityName: 'Windstoß',
    abilityDesc: 'Stößt Gegner zurück und unterbricht ihre Bewegung.',
  },
  pyro: {
    id: 'pyro',
    name: 'Flammenwerfer',
    sourceWeapon: 'flamethrowerTower',
    hp: 85,
    attack: 6,
    defense: 6,
    speed: 2.5,
    attackRange: 2,
    attackSpeed: 8.0,
    role: 'dps_melee',
    element: 'fire',
    color: 0xff6600,
    tier: 2,
    shopCost: 2,
    abilityName: 'Flammenstrahl',
    abilityDesc: 'Kurze Reichweite, aber extrem schneller Feuerschaden im Nahkampf.',
  },

  // ─── Stufe 3 (Elite-Einheiten) ────────────────────
  sniper: {
    id: 'sniper',
    name: 'Scharfschütze',
    sourceWeapon: 'sniperTower',
    hp: 40,
    attack: 120,
    defense: 2,
    speed: 1.0,
    attackRange: 12,
    attackSpeed: 0.4,
    role: 'dps_ranged',
    element: 'physical',
    color: 0x2c3e50,
    tier: 3,
    shopCost: 3,
    abilityName: 'Kopfschuss',
    abilityDesc: 'Extreme Reichweite und Schaden. Sehr langsam, aber tödlich.',
  },
  lightning_mage: {
    id: 'lightning_mage',
    name: 'Blitzmagier',
    sourceWeapon: 'teslaTower',
    hp: 65,
    attack: 25,
    defense: 5,
    speed: 2.0,
    attackRange: 5,
    attackSpeed: 1.0,
    role: 'dps_ranged',
    element: 'lightning',
    color: 0x9b59b6,
    tier: 3,
    shopCost: 3,
    abilityName: 'Kettenblitz',
    abilityDesc: 'Blitz springt zwischen bis zu 3 Gegnern. Hoher Flächeneffekt.',
  },
  mortar: {
    id: 'mortar',
    name: 'Mörserschütze',
    sourceWeapon: 'mortarTower',
    hp: 75,
    attack: 60,
    defense: 7,
    speed: 1.0,
    attackRange: 10,
    attackSpeed: 0.5,
    role: 'dps_ranged',
    element: 'physical',
    color: 0x7f6b52,
    tier: 3,
    shopCost: 3,
    abilityName: 'Sperrfeuer',
    abilityDesc: 'Wirft Granaten mit großem Flächenschaden über weite Entfernungen.',
  },
  laser_tech: {
    id: 'laser_tech',
    name: 'Laseringenieur',
    sourceWeapon: 'laserTower',
    hp: 55,
    attack: 12,
    defense: 4,
    speed: 4.0,
    attackRange: 7,
    attackSpeed: 4.0,
    role: 'dps_ranged',
    element: 'arcane',
    color: 0xff2222,
    tier: 3,
    shopCost: 3,
    abilityName: 'Fokusstrahl',
    abilityDesc: 'Kontinuierlicher Laserstrahl. Schaden steigt je länger das Ziel erfasst wird.',
  },
  archmage: {
    id: 'archmage',
    name: 'Erzmagier',
    sourceWeapon: 'mageTower',
    hp: 45,
    attack: 30,
    defense: 3,
    speed: 2.5,
    attackRange: 8,
    attackSpeed: 1.2,
    role: 'dps_ranged',
    element: 'arcane',
    color: 0x6644cc,
    tier: 3,
    shopCost: 3,
    abilityName: 'Arkaner Strahl',
    abilityDesc: 'Homing-Projektile durchbohren bis zu 2 Gegner.',
  },
  guardian: {
    id: 'guardian',
    name: 'Schildträger',
    sourceWeapon: 'barrierTower',
    hp: 150,
    attack: 0,
    defense: 15,
    speed: 1.5,
    attackRange: 1,
    attackSpeed: 0.5,
    role: 'tank',
    element: 'ice',
    color: 0x4488ff,
    tier: 3,
    shopCost: 3,
    abilityName: 'Schutzwall',
    abilityDesc: 'Erzeugt ein Verlangsamungsfeld. Extrem hohe LP und Verteidigung.',
  },
  earth_shaker: {
    id: 'earth_shaker',
    name: 'Erderschütterer',
    sourceWeapon: 'earthquakeTower',
    hp: 120,
    attack: 35,
    defense: 10,
    speed: 1.0,
    attackRange: 3,
    attackSpeed: 0.25,
    role: 'dps_melee',
    element: 'nature',
    color: 0x886644,
    tier: 3,
    shopCost: 3,
    abilityName: 'Erdbeben',
    abilityDesc: 'Periodischer Flächenschaden + Stun in der Nähe. Langsam aber mächtig.',
  },
  healer: {
    id: 'healer',
    name: 'Heiler',
    sourceWeapon: 'healTower',
    hp: 70,
    attack: 0,
    defense: 4,
    speed: 2.0,
    attackRange: 5,
    attackSpeed: 1.0,
    role: 'support',
    element: 'nature',
    color: 0x44ff88,
    tier: 3,
    shopCost: 3,
    abilityName: 'Heilaura',
    abilityDesc: 'Heilt verbündete Einheiten in Reichweite. Verursacht keinen Schaden.',
  },

  // ─── Stufe 4 (Legendäre Einheiten) ────────────────
  necromancer: {
    id: 'necromancer',
    name: 'Nekromant',
    sourceWeapon: 'necromancerTower',
    hp: 50,
    attack: 20,
    defense: 3,
    speed: 1.5,
    attackRange: 6,
    attackSpeed: 0.6,
    role: 'specialist',
    element: 'dark',
    color: 0x553388,
    tier: 4,
    shopCost: 4,
    abilityName: 'Untote Armee',
    abilityDesc: 'Beschwört Skelettkrieger aus besiegten Gegnern. Jeder Kill stärkt die Armee.',
  },
};

// ─── Waffe → Einheit Zuordnung ──────────────────────────────────────────────

export const WEAPON_TO_UNIT: Record<WeaponKey, string> = {
  arrowTower: 'archer',
  cannonTower: 'cannoneer',
  iceTower: 'frost_mage',
  fireTower: 'fire_mage',
  sniperTower: 'sniper',
  teslaTower: 'lightning_mage',
  mortarTower: 'mortar',
  poisonTower: 'alchemist',
  laserTower: 'laser_tech',
  windTower: 'wind_caller',
  mageTower: 'archmage',
  flamethrowerTower: 'pyro',
  barrierTower: 'guardian',
  necromancerTower: 'necromancer',
  earthquakeTower: 'earth_shaker',
  healTower: 'healer',
  landmine: 'bomber',
  spikeTrap: 'trapper',
  frostMine: 'frost_bomber',
  goldMine: 'prospector',
};

// ─── Stufenpools für den Shop ───────────────────────────────────────────────

export const UNIT_TIER_POOLS: Record<1 | 2 | 3 | 4, string[]> = {
  1: Object.values(UNIT_DEFS).filter(u => u.tier === 1).map(u => u.id),
  2: Object.values(UNIT_DEFS).filter(u => u.tier === 2).map(u => u.id),
  3: Object.values(UNIT_DEFS).filter(u => u.tier === 3).map(u => u.id),
  4: Object.values(UNIT_DEFS).filter(u => u.tier === 4).map(u => u.id),
};

/**
 * Gibt die Einheiten-Definition für eine gegebene ID zurück.
 * Wirft einen Fehler wenn die ID nicht existiert.
 */
export function getUnitDef(id: string): UnitDef {
  const def = UNIT_DEFS[id];
  if (!def) {
    throw new Error(`Unbekannte Einheiten-ID: "${id}"`);
  }
  return def;
}
