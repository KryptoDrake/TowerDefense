export interface RunModifiers {
  damageMult: number;
  fireRateMult: number;
  rangeMult: number;
  goldMult: number;
  hpMult: number;
  costMult: number;
  enemySpeedMult: number;
  enemyHpMult: number;
  splashRadiusMult: number;
  dotMult: number;
  slowMult: number;
}

export interface RewardChoice {
  id: string;
  name: string;
  description: string;
  type: 'buff' | 'curse';
  bonus?: string; // Extra benefit shown for curses
  apply: (mods: RunModifiers) => void;
}

const BUFF_POOL: RewardChoice[] = [
  {
    id: 'sharp_blades',
    name: 'Schärfere Klingen',
    description: 'Alle Türme verursachen 15% mehr Schaden.',
    type: 'buff',
    apply: (m) => { m.damageMult *= 1.15; },
  },
  {
    id: 'heal_potion',
    name: 'Heiltrank',
    description: 'Die Basis startet mit 25% mehr HP.',
    type: 'buff',
    apply: (m) => { m.hpMult *= 1.25; },
  },
  {
    id: 'gold_fever',
    name: 'Goldfieber',
    description: '30% mehr Gold pro Kill und pro Welle.',
    type: 'buff',
    apply: (m) => { m.goldMult *= 1.3; },
  },
  {
    id: 'rapid_fire',
    name: 'Schnellfeuer',
    description: 'Alle Türme feuern 20% schneller.',
    type: 'buff',
    apply: (m) => { m.fireRateMult *= 1.2; },
  },
  {
    id: 'icy_winds',
    name: 'Eisige Winde',
    description: 'Alle Verlangsamungen sind 30% stärker.',
    type: 'buff',
    apply: (m) => { m.slowMult *= 1.3; },
  },
  {
    id: 'chain_reaction',
    name: 'Kettenreaktion',
    description: 'Explosionen haben 25% größeren Radius.',
    type: 'buff',
    apply: (m) => { m.splashRadiusMult *= 1.25; },
  },
  {
    id: 'eagle_eye',
    name: 'Adlerblick',
    description: 'Alle Türme haben 15% mehr Reichweite.',
    type: 'buff',
    apply: (m) => { m.rangeMult *= 1.15; },
  },
  {
    id: 'burning_touch',
    name: 'Brennende Berührung',
    description: 'DoT-Schaden ist 40% stärker.',
    type: 'buff',
    apply: (m) => { m.dotMult *= 1.4; },
  },
];

const CURSE_POOL: RewardChoice[] = [
  {
    id: 'zombie_rush',
    name: 'Zombie-Rush',
    description: 'Gegner bewegen sich 20% schneller.',
    type: 'curse',
    bonus: 'Bonus: +50% Gold pro Kill',
    apply: (m) => { m.enemySpeedMult *= 1.2; m.goldMult *= 1.5; },
  },
  {
    id: 'thick_skin',
    name: 'Dicke Haut',
    description: 'Gegner haben 30% mehr HP.',
    type: 'curse',
    bonus: 'Bonus: Basis +30% HP',
    apply: (m) => { m.enemyHpMult *= 1.3; m.hpMult *= 1.3; },
  },
  {
    id: 'inflation',
    name: 'Inflation',
    description: 'Turmkosten steigen um 25%.',
    type: 'curse',
    bonus: 'Bonus: +40% Startgold',
    apply: (m) => { m.costMult *= 1.25; m.goldMult *= 1.4; },
  },
  {
    id: 'fog_of_war',
    name: 'Nebel des Krieges',
    description: 'Turmreichweite sinkt um 15%.',
    type: 'curse',
    bonus: 'Bonus: +40% DoT-Schaden',
    apply: (m) => { m.rangeMult *= 0.85; m.dotMult *= 1.4; },
  },
];

export class RunManager {
  private modifiers: RunModifiers;
  private chosenRewards: RewardChoice[] = [];

  constructor() {
    this.modifiers = this.defaultModifiers();
  }

  private defaultModifiers(): RunModifiers {
    return {
      damageMult: 1,
      fireRateMult: 1,
      rangeMult: 1,
      goldMult: 1,
      hpMult: 1,
      costMult: 1,
      enemySpeedMult: 1,
      enemyHpMult: 1,
      splashRadiusMult: 1,
      dotMult: 1,
      slowMult: 1,
    };
  }

  getModifiers(): RunModifiers {
    return { ...this.modifiers };
  }

  /** Apply external modifiers (e.g. from daily challenge) on top of current ones */
  applyExternalModifiers(mods: Partial<RunModifiers>): void {
    for (const key of Object.keys(mods) as (keyof RunModifiers)[]) {
      if (mods[key] !== undefined) {
        this.modifiers[key] *= mods[key]!;
      }
    }
  }

  getChosenRewards(): RewardChoice[] {
    return [...this.chosenRewards];
  }

  /** Get N random unique choices (mix of buffs and curses) */
  getRandomChoices(count: number): RewardChoice[] {
    // Get available choices (not already chosen)
    const chosenIds = new Set(this.chosenRewards.map(r => r.id));
    const availableBuffs = BUFF_POOL.filter(b => !chosenIds.has(b.id));
    const availableCurses = CURSE_POOL.filter(c => !chosenIds.has(c.id));

    const all = [...availableBuffs, ...availableCurses];

    // Shuffle and pick
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }

    // Ensure at least 1 buff and 1 curse if possible
    const result: RewardChoice[] = [];
    const buff = all.find(c => c.type === 'buff');
    const curse = all.find(c => c.type === 'curse');

    if (buff) result.push(buff);
    if (curse) result.push(curse);

    // Fill remaining slots
    for (const choice of all) {
      if (result.length >= count) break;
      if (!result.includes(choice)) result.push(choice);
    }

    // Shuffle result
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }

    return result.slice(0, count);
  }

  applyChoice(choice: RewardChoice): void {
    this.chosenRewards.push(choice);
    choice.apply(this.modifiers);
  }

  reset(): void {
    this.modifiers = this.defaultModifiers();
    this.chosenRewards = [];
  }
}
