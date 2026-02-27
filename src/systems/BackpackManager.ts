import { WeaponKey, BALANCE } from './BalanceConfig';

const STORAGE_KEY = 'td_backpack_save';

// ─── Permanent Upgrades ───────────────────────────
export interface PermanentUpgrade {
  id: string;
  name: string;
  description: string;
  icon: string;
  maxLevel: number;
  costPerLevel: number[];
  currentLevel: number;
}

const PERMANENT_UPGRADE_DEFS: Omit<PermanentUpgrade, 'currentLevel'>[] = [
  {
    id: 'towerDamage',
    name: 'Turmstärke',
    description: '+5% Turmschaden pro Stufe',
    icon: '\u2694\uFE0F',
    maxLevel: 10,
    costPerLevel: [30, 50, 80, 120, 160, 200, 250, 300, 400, 500],
  },
  {
    id: 'goldBonus',
    name: 'Goldbonus',
    description: '+8% Goldeinkommen pro Stufe',
    icon: '\uD83E\uDE99',
    maxLevel: 8,
    costPerLevel: [40, 70, 110, 160, 220, 290, 370, 500],
  },
  {
    id: 'baseHP',
    name: 'Basisfestung',
    description: '+100 Basis-HP pro Stufe',
    icon: '\uD83C\uDFE0',
    maxLevel: 10,
    costPerLevel: [25, 40, 60, 90, 130, 180, 240, 310, 400, 500],
  },
  {
    id: 'startGold',
    name: 'Startkapital',
    description: '+15 Startgold pro Stufe',
    icon: '\uD83D\uDCB0',
    maxLevel: 8,
    costPerLevel: [35, 60, 100, 150, 210, 280, 360, 500],
  },
  {
    id: 'fireRate',
    name: 'Schnellfeuer',
    description: '+3% Feuerrate pro Stufe',
    icon: '\uD83D\uDD25',
    maxLevel: 8,
    costPerLevel: [40, 70, 120, 180, 250, 330, 420, 550],
  },
  {
    id: 'range',
    name: 'Reichweite',
    description: '+3% Reichweite pro Stufe',
    icon: '\uD83C\uDFAF',
    maxLevel: 6,
    costPerLevel: [50, 90, 150, 230, 330, 500],
  },
  {
    id: 'crystalFind',
    name: 'Kristallfinder',
    description: '+10% Kristalle pro Stufe',
    icon: '\uD83D\uDC8E',
    maxLevel: 5,
    costPerLevel: [60, 120, 200, 300, 500],
  },
];

export interface MerchantItem {
  weapon: WeaponKey;
  cost: number;
}

export type ChestTier = 'bronze' | 'silver' | 'gold';

export interface ChestReward {
  tier: ChestTier;
  weapons: WeaponKey[];
  crystals: number;
  slotUpgrade: number; // 0 or 1
}

export interface SlotUpgrade {
  label: string;
  cost: number;
  slots: number; // how many slots to add
  maxAfter: number; // maxSlotsCapacity after buying
}

const MERCHANT_PRICES: Partial<Record<WeaponKey, number>> = {
  cannonTower: 50,
  iceTower: 40,
  fireTower: 60,
  sniperTower: 80,
  teslaTower: 100,
  mortarTower: 90,
  poisonTower: 70,
  laserTower: 110,
  windTower: 55,
  mageTower: 75,
  flamethrowerTower: 65,
  barrierTower: 90,
  necromancerTower: 120,
  earthquakeTower: 100,
  healTower: 80,
  frostMine: 25,
  goldMine: 35,
};

const SLOT_UPGRADES: SlotUpgrade[] = [
  { label: '+1 Platz', cost: 50, slots: 1, maxAfter: 11 },
  { label: '+2 Plätze', cost: 120, slots: 2, maxAfter: 13 },
  { label: 'Großer Rucksack', cost: 200, slots: 2, maxAfter: 15 },
];

const CHEST_CONFIG: Record<ChestTier, { color: string; weaponCount: number; crystals: number; slotChance: number }> = {
  bronze: { color: '#cd7f32', weaponCount: 1, crystals: 10, slotChance: 0 },
  silver: { color: '#c0c0c0', weaponCount: 1, crystals: 30, slotChance: 1 },
  gold:   { color: '#ffd700', weaponCount: 2, crystals: 50, slotChance: 1 },
};

// Weapons that are free/unlocked from the start
const STARTER_WEAPONS: WeaponKey[] = ['arrowTower', 'landmine', 'spikeTrap'];

export class BackpackManager {
  // Permanent state (persists across runs via localStorage)
  private unlockedWeapons: Set<WeaponKey>;
  private crystals: number;
  private maxSlotsCapacity: number;
  private slotUpgradeLevel: number; // 0-3 (index into SLOT_UPGRADES that were bought)
  private pendingChest: ChestReward | null = null;
  private permanentUpgradeLevels: Record<string, number> = {};

  // Per-run state
  private equippedWeapons: WeaponKey[] = [];
  private maxSlots = 5;

  private static readonly START_CRYSTALS = 100;

  constructor() {
    this.unlockedWeapons = new Set(STARTER_WEAPONS);
    this.crystals = BackpackManager.START_CRYSTALS;
    this.maxSlotsCapacity = 10;
    this.slotUpgradeLevel = 0;
    this.load();
  }

  // ─── Persistence ──────────────────────────────────
  private save(): void {
    const data = {
      unlocked: Array.from(this.unlockedWeapons),
      crystals: this.crystals,
      maxSlotsCapacity: this.maxSlotsCapacity,
      slotUpgradeLevel: this.slotUpgradeLevel,
      permanentUpgrades: this.permanentUpgradeLevels,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (_) { /* ignore */ }
  }

  private load(): void {
    const validWeapons = new Set(Object.keys(BALANCE.weapons));
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.unlocked) {
          const loaded = (data.unlocked as string[]).filter(w => validWeapons.has(w));
          this.unlockedWeapons = new Set(loaded as WeaponKey[]);
          for (const w of STARTER_WEAPONS) this.unlockedWeapons.add(w);
        }
        if (typeof data.crystals === 'number') {
          this.crystals = data.crystals;
        }
        if (typeof data.maxSlotsCapacity === 'number') {
          this.maxSlotsCapacity = data.maxSlotsCapacity;
        }
        if (typeof data.slotUpgradeLevel === 'number') {
          this.slotUpgradeLevel = data.slotUpgradeLevel;
        }
        if (data.permanentUpgrades && typeof data.permanentUpgrades === 'object') {
          this.permanentUpgradeLevels = { ...data.permanentUpgrades };
        }
      }
    } catch (_) { /* ignore */ }
  }

  // ─── Crystals ─────────────────────────────────────
  getCrystals(): number {
    return this.crystals;
  }

  earnCrystals(amount: number): void {
    this.crystals += amount;
    this.save();
  }

  // ─── Merchant ─────────────────────────────────────
  getMerchantItems(): MerchantItem[] {
    const items: MerchantItem[] = [];
    for (const [weapon, cost] of Object.entries(MERCHANT_PRICES)) {
      if (!this.unlockedWeapons.has(weapon as WeaponKey)) {
        items.push({ weapon: weapon as WeaponKey, cost });
      }
    }
    // Sort by cost
    items.sort((a, b) => a.cost - b.cost);
    return items;
  }

  canBuy(weapon: WeaponKey): boolean {
    const price = MERCHANT_PRICES[weapon];
    if (!price) return false;
    return this.crystals >= price && !this.unlockedWeapons.has(weapon);
  }

  buyWeapon(weapon: WeaponKey): boolean {
    const price = MERCHANT_PRICES[weapon];
    if (!price || this.crystals < price || this.unlockedWeapons.has(weapon)) return false;
    this.crystals -= price;
    this.unlockedWeapons.add(weapon);
    this.save();
    return true;
  }

  isUnlocked(weapon: WeaponKey): boolean {
    return this.unlockedWeapons.has(weapon);
  }

  getUnlockedWeapons(): WeaponKey[] {
    return Array.from(this.unlockedWeapons);
  }

  // ─── Backpack (per-run) ───────────────────────────
  getEquipped(): WeaponKey[] {
    return [...this.equippedWeapons];
  }

  getMaxSlots(): number {
    return this.maxSlots;
  }

  equipWeapon(weapon: WeaponKey): boolean {
    if (!this.unlockedWeapons.has(weapon)) return false;
    if (this.equippedWeapons.includes(weapon)) return false;
    if (this.equippedWeapons.length >= this.maxSlots) return false;
    this.equippedWeapons.push(weapon);
    return true;
  }

  unequipWeapon(weapon: WeaponKey): boolean {
    const idx = this.equippedWeapons.indexOf(weapon);
    if (idx === -1) return false;
    this.equippedWeapons.splice(idx, 1);
    return true;
  }

  isEquipped(weapon: WeaponKey): boolean {
    return this.equippedWeapons.includes(weapon);
  }

  /** Add a random drop to the backpack during expedition */
  addDrop(weapon: WeaponKey): boolean {
    if (!this.unlockedWeapons.has(weapon)) return false;
    if (this.equippedWeapons.includes(weapon)) return false;
    if (this.equippedWeapons.length >= this.maxSlots) return false;
    this.equippedWeapons.push(weapon);
    return true;
  }

  /** Expand backpack slots (expedition reward) */
  expandSlots(amount = 1): void {
    this.maxSlots = Math.min(this.maxSlots + amount, this.maxSlotsCapacity);
  }

  /** Get a random weapon that's unlocked but not equipped */
  getRandomUnequippedWeapon(): WeaponKey | null {
    const available = Array.from(this.unlockedWeapons).filter(
      w => !this.equippedWeapons.includes(w)
    );
    if (available.length === 0) return null;
    return available[Math.floor(Math.random() * available.length)];
  }

  /** Auto-fill backpack with default loadout */
  autoFillBackpack(): void {
    this.equippedWeapons = [];
    this.maxSlots = 5;

    const unlocked = Array.from(this.unlockedWeapons);
    // Prioritize towers over traps
    const towers = unlocked.filter(w => !BALANCE.weapons[w].isPath);
    const traps = unlocked.filter(w => BALANCE.weapons[w].isPath);

    // Sort towers by cost (cheapest first for starter-friendly loadout)
    towers.sort((a, b) => BALANCE.weapons[a].cost - BALANCE.weapons[b].cost);

    // Fill: up to 3 towers + all traps (up to max slots)
    let filled = 0;
    for (const t of towers) {
      if (filled >= 3) break;
      this.equippedWeapons.push(t);
      filled++;
    }
    for (const t of traps) {
      if (this.equippedWeapons.length >= this.maxSlots) break;
      this.equippedWeapons.push(t);
    }
  }

  /** Reset per-run state */
  resetRun(): void {
    this.equippedWeapons = [];
    this.maxSlots = 5;
  }

  /** Full reset (debug / new game) */
  fullReset(): void {
    this.unlockedWeapons = new Set(STARTER_WEAPONS);
    this.crystals = BackpackManager.START_CRYSTALS;
    this.equippedWeapons = [];
    this.maxSlots = 5;
    this.maxSlotsCapacity = 10;
    this.slotUpgradeLevel = 0;
    this.pendingChest = null;
    this.permanentUpgradeLevels = {};
    this.save();
  }

  // ─── Slot Upgrades (Permanent, Merchant) ────────
  getSlotUpgradeLevel(): number {
    return this.slotUpgradeLevel;
  }

  getMaxSlotsCapacity(): number {
    return this.maxSlotsCapacity;
  }

  getAvailableSlotUpgrades(): SlotUpgrade[] {
    return SLOT_UPGRADES.slice(this.slotUpgradeLevel);
  }

  getNextSlotUpgrade(): SlotUpgrade | null {
    if (this.slotUpgradeLevel >= SLOT_UPGRADES.length) return null;
    return SLOT_UPGRADES[this.slotUpgradeLevel];
  }

  canBuySlotUpgrade(): boolean {
    const upgrade = this.getNextSlotUpgrade();
    if (!upgrade) return false;
    return this.crystals >= upgrade.cost;
  }

  buySlotUpgrade(): boolean {
    const upgrade = this.getNextSlotUpgrade();
    if (!upgrade || this.crystals < upgrade.cost) return false;
    this.crystals -= upgrade.cost;
    this.maxSlotsCapacity = upgrade.maxAfter;
    this.slotUpgradeLevel++;
    this.save();
    return true;
  }

  /** Expand max capacity permanently (e.g. from chest reward) */
  expandSlotsPermanent(amount: number): void {
    this.maxSlotsCapacity = Math.min(this.maxSlotsCapacity + amount, 15);
    this.save();
  }

  // ─── Chest System ───────────────────────────────
  /** Roll a chest drop (40% chance). Returns null if no drop. */
  rollChestDrop(): ChestReward | null {
    if (Math.random() > 0.4) return null;

    // Determine tier: 60% bronze, 30% silver, 10% gold
    const roll = Math.random();
    let tier: ChestTier;
    if (roll < 0.6) tier = 'bronze';
    else if (roll < 0.9) tier = 'silver';
    else tier = 'gold';

    return this.generateChestReward(tier);
  }

  private generateChestReward(tier: ChestTier): ChestReward {
    const config = CHEST_CONFIG[tier];
    const weapons: WeaponKey[] = [];

    // Pick random weapons from all available (not just unlocked)
    const allWeapons = Object.keys(BALANCE.weapons) as WeaponKey[];
    const lockedWeapons = allWeapons.filter(w => !this.unlockedWeapons.has(w));
    const pool = lockedWeapons.length > 0 ? lockedWeapons : allWeapons;

    for (let i = 0; i < config.weaponCount && pool.length > 0; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      weapons.push(pool[idx]);
      pool.splice(idx, 1); // no duplicates
    }

    return {
      tier,
      weapons,
      crystals: config.crystals,
      slotUpgrade: config.slotChance,
    };
  }

  /** Apply a chest reward */
  applyChestReward(reward: ChestReward): void {
    // Unlock weapons
    for (const w of reward.weapons) {
      this.unlockedWeapons.add(w);
    }
    // Add crystals
    this.crystals += reward.crystals;
    // Slot upgrade
    if (reward.slotUpgrade > 0) {
      this.expandSlotsPermanent(reward.slotUpgrade);
    }
    this.save();
  }

  /** Store a pending chest for the hub to show */
  setPendingChest(reward: ChestReward): void {
    this.pendingChest = reward;
  }

  /** Get and clear pending chest */
  consumePendingChest(): ChestReward | null {
    const chest = this.pendingChest;
    this.pendingChest = null;
    return chest;
  }

  hasPendingChest(): boolean {
    return this.pendingChest !== null;
  }

  /** Get chest config for UI display */
  static getChestConfig(tier: ChestTier): { color: string; weaponCount: number; crystals: number; slotChance: number } {
    return CHEST_CONFIG[tier];
  }

  // ─── Permanent Upgrades ─────────────────────────
  getPermanentUpgrades(): PermanentUpgrade[] {
    return PERMANENT_UPGRADE_DEFS.map(def => ({
      ...def,
      currentLevel: this.permanentUpgradeLevels[def.id] || 0,
    }));
  }

  buyPermanentUpgrade(id: string): boolean {
    const def = PERMANENT_UPGRADE_DEFS.find(d => d.id === id);
    if (!def) return false;
    const currentLevel = this.permanentUpgradeLevels[id] || 0;
    if (currentLevel >= def.maxLevel) return false;
    const cost = def.costPerLevel[currentLevel];
    if (this.crystals < cost) return false;
    this.crystals -= cost;
    this.permanentUpgradeLevels[id] = currentLevel + 1;
    this.save();
    return true;
  }

  /** Returns the bonus value for a permanent upgrade.
   *  - towerDamage: multiplier (e.g. 1.25 for level 5 = +25%)
   *  - goldBonus: multiplier (e.g. 1.16 for level 2 = +16%)
   *  - baseHP: flat HP to add (e.g. 300 for level 3)
   *  - startGold: flat gold to add (e.g. 45 for level 3)
   *  - fireRate: multiplier (e.g. 1.09 for level 3 = +9%)
   *  - range: multiplier (e.g. 1.06 for level 2 = +6%)
   *  - crystalFind: multiplier (e.g. 1.30 for level 3 = +30%)
   */
  getPermanentBonus(id: string): number {
    const level = this.permanentUpgradeLevels[id] || 0;
    if (level === 0) {
      // Return identity values
      switch (id) {
        case 'baseHP':
        case 'startGold':
          return 0;
        default:
          return 1;
      }
    }
    switch (id) {
      case 'towerDamage': return 1 + level * 0.05;
      case 'goldBonus':   return 1 + level * 0.08;
      case 'baseHP':      return level * 100;
      case 'startGold':   return level * 15;
      case 'fireRate':    return 1 + level * 0.03;
      case 'range':       return 1 + level * 0.03;
      case 'crystalFind': return 1 + level * 0.10;
      default: return 1;
    }
  }

  // ─── Stats for UI ───────────────────────────────
  getStats(): {
    totalUnlocked: number;
    totalWeapons: number;
    towersUnlocked: number;
    trapsUnlocked: number;
    crystals: number;
    maxCapacity: number;
    upgradeLevel: number;
  } {
    const unlocked = Array.from(this.unlockedWeapons);
    const allWeapons = Object.keys(BALANCE.weapons) as WeaponKey[];
    return {
      totalUnlocked: unlocked.length,
      totalWeapons: allWeapons.length,
      towersUnlocked: unlocked.filter(w => !BALANCE.weapons[w].isPath).length,
      trapsUnlocked: unlocked.filter(w => BALANCE.weapons[w].isPath).length,
      crystals: this.crystals,
      maxCapacity: this.maxSlotsCapacity,
      upgradeLevel: this.slotUpgradeLevel,
    };
  }
}
