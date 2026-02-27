// Rundenbasierte Kampf-Engine für den Arena-Modus

import { ArenaUnit, StatusEffect } from './ArenaUnit';
import { ArenaAbilityDef, ActiveAbility } from './ArenaAbility';
import { getElementMultiplier, UnitElement } from '../units/UnitConfig';

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface TurnAction {
  unit: ArenaUnit;
  ability: ArenaAbilityDef;
  targets: ArenaUnit[];
}

export interface TurnResult {
  action: TurnAction;
  damageDealt: number[];       // Pro Ziel
  healingDone: number[];       // Pro Ziel
  statusApplied: StatusEffect[][];  // Pro Ziel
  killedUnits: ArenaUnit[];
  text: string;                // Deutscher Kampflog-Text
}

// ─── Kampf-Engine ───────────────────────────────────────────────────────────

export class ArenaCombatEngine {
  private playerTeam: ArenaUnit[];
  private enemyTeam: ArenaUnit[];
  private turnOrder: ArenaUnit[] = [];
  private currentTurnIndex = 0;
  private roundNumber = 0;

  constructor(playerTeam: ArenaUnit[], enemyTeam: ArenaUnit[]) {
    this.playerTeam = playerTeam;
    this.enemyTeam = enemyTeam;
    this.newRound();
  }

  /** Berechnet die Zugreihenfolge basierend auf Geschwindigkeit (absteigend) */
  calculateTurnOrder(): void {
    const allUnits = [...this.playerTeam, ...this.enemyTeam].filter(u => u.alive);

    // Nach Speed sortieren, bei Gleichstand zufällig
    allUnits.sort((a, b) => {
      const diff = b.speed - a.speed;
      if (Math.abs(diff) < 0.001) {
        return Math.random() - 0.5;
      }
      return diff;
    });

    this.turnOrder = allUnits;
    this.currentTurnIndex = 0;
  }

  /** Gibt die aktuelle Einheit zurück, die am Zug ist */
  getCurrentUnit(): ArenaUnit {
    // Überspringe tote Einheiten
    while (
      this.currentTurnIndex < this.turnOrder.length &&
      !this.turnOrder[this.currentTurnIndex].alive
    ) {
      this.currentTurnIndex++;
    }
    return this.turnOrder[this.currentTurnIndex];
  }

  /** Ist der aktuelle Zug eine Spieler-Einheit? */
  isPlayerTurn(): boolean {
    const unit = this.getCurrentUnit();
    return unit ? unit.isPlayer : false;
  }

  /** Führt eine Spieleraktion aus (gewählte Fähigkeit + Ziele) */
  executeAction(abilityIndex: number, targetIndices: number[]): TurnResult {
    const unit = this.getCurrentUnit();

    if (!unit || !unit.alive) {
      return this.createEmptyResult(unit);
    }

    // Betäubungsprüfung
    if (unit.isStunned()) {
      const stunEffect = unit.statusEffects.find(
        e => e.type === 'stun' || e.type === 'freeze'
      );
      const stunType = stunEffect?.type === 'freeze' ? 'eingefroren' : 'betäubt';
      return {
        action: {
          unit,
          ability: unit.abilities[0].def,
          targets: [],
        },
        damageDealt: [],
        healingDone: [],
        statusApplied: [],
        killedUnits: [],
        text: `${unit.def.name} ist ${stunType} und kann nicht handeln!`,
      };
    }

    const activeAbility = unit.abilities[abilityIndex];
    if (!activeAbility) {
      return this.createEmptyResult(unit);
    }

    const ability = activeAbility.def;

    // MP-Prüfung
    if (unit.mp < ability.mpCost) {
      return this.createEmptyResult(unit);
    }

    // Cooldown-Prüfung
    if (activeAbility.currentCooldown > 0) {
      return this.createEmptyResult(unit);
    }

    // Ziele auflösen
    const targets = this.resolveTargets(ability, unit, targetIndices);

    // Fähigkeit anwenden
    const result = this.applyAbility(unit, ability, targets);

    // MP abziehen
    unit.mp -= ability.mpCost;

    // Cooldown setzen
    if (ability.cooldown > 0) {
      activeAbility.currentCooldown = ability.cooldown;
    }

    // Selbstzerstörung
    if (ability.selfDestruct) {
      unit.hp = 0;
      unit.alive = false;
      unit.playDeathAnimation();
      result.text += ` ${unit.def.name} opfert sich!`;
    }

    return result;
  }

  /** Führt den KI-Zug eines Gegners aus */
  executeEnemyAI(): TurnResult {
    const unit = this.getCurrentUnit();

    if (!unit || !unit.alive) {
      return this.createEmptyResult(unit);
    }

    // Betäubungsprüfung
    if (unit.isStunned()) {
      const stunEffect = unit.statusEffects.find(
        e => e.type === 'stun' || e.type === 'freeze'
      );
      const stunType = stunEffect?.type === 'freeze' ? 'eingefroren' : 'betäubt';
      return {
        action: {
          unit,
          ability: unit.abilities[0].def,
          targets: [],
        },
        damageDealt: [],
        healingDone: [],
        statusApplied: [],
        killedUnits: [],
        text: `${unit.def.name} ist ${stunType} und kann nicht handeln!`,
      };
    }

    const choice = this.chooseEnemyAction(unit);
    const activeAbility = unit.abilities[choice.abilityIndex];
    const ability = activeAbility.def;

    // Fähigkeit anwenden
    const result = this.applyAbility(unit, ability, choice.targets);

    // MP abziehen
    unit.mp -= ability.mpCost;

    // Cooldown setzen
    if (ability.cooldown > 0) {
      activeAbility.currentCooldown = ability.cooldown;
    }

    // Selbstzerstörung
    if (ability.selfDestruct) {
      unit.hp = 0;
      unit.alive = false;
      unit.playDeathAnimation();
      result.text += ` ${unit.def.name} opfert sich!`;
    }

    return result;
  }

  /** Zum nächsten Zug weitergehen */
  nextTurn(): void {
    this.currentTurnIndex++;

    // Überspringe tote Einheiten
    while (
      this.currentTurnIndex < this.turnOrder.length &&
      !this.turnOrder[this.currentTurnIndex].alive
    ) {
      this.currentTurnIndex++;
    }
  }

  /** Prüft ob die Runde vorbei ist (alle Einheiten haben gehandelt) */
  isRoundOver(): boolean {
    return this.currentTurnIndex >= this.turnOrder.length;
  }

  /** Startet eine neue Runde */
  newRound(): void {
    this.roundNumber++;

    // Statuseffekte ticken für alle lebenden Einheiten
    const allLiving = [...this.playerTeam, ...this.enemyTeam].filter(u => u.alive);
    for (const unit of allLiving) {
      unit.tickStatusEffects();
      unit.regenMp();

      // Cooldowns reduzieren
      for (const ability of unit.abilities) {
        if (ability.currentCooldown > 0) {
          ability.currentCooldown--;
        }
      }
    }

    this.calculateTurnOrder();
  }

  /** Prüft ob der Kampf vorbei ist */
  checkBattleEnd(): 'player_win' | 'enemy_win' | 'ongoing' {
    const playerAlive = this.playerTeam.some(u => u.alive);
    const enemyAlive = this.enemyTeam.some(u => u.alive);

    if (!enemyAlive) return 'player_win';
    if (!playerAlive) return 'enemy_win';
    return 'ongoing';
  }

  /** Gibt gültige Ziele für eine Fähigkeit zurück */
  getValidTargets(ability: ArenaAbilityDef, user: ArenaUnit): ArenaUnit[] {
    const isPlayerUnit = user.isPlayer;
    const allies = isPlayerUnit ? this.playerTeam : this.enemyTeam;
    const enemies = isPlayerUnit ? this.enemyTeam : this.playerTeam;

    switch (ability.targetType) {
      case 'single_enemy':
      case 'all_enemies': {
        let validEnemies = enemies.filter(u => u.alive);

        // Taunt-Mechanik: wenn ein Gegner provoziert, müssen Angriffe ihn treffen
        if (ability.targetType === 'single_enemy' && ability.baseDamage > 0) {
          const tauntingUnits = validEnemies.filter(u => u.isTaunting());
          if (tauntingUnits.length > 0) {
            validEnemies = tauntingUnits;
          }
        }

        return validEnemies;
      }

      case 'single_ally':
      case 'all_allies': {
        // Wiederbelebung kann tote Verbündete als Ziel haben
        if (ability.revive) {
          return allies.filter(u => !u.alive);
        }
        return allies.filter(u => u.alive);
      }

      case 'self':
        return [user];

      default:
        return [];
    }
  }

  /** Berechnet Schaden mit Elementmultiplikator */
  private calcDamage(
    baseDamage: number,
    attackerElement: UnitElement,
    defenderElement: UnitElement,
    attacker: ArenaUnit,
    defender: ArenaUnit
  ): number {
    const elementMult = getElementMultiplier(attackerElement, defenderElement);
    const attackBonus = 1 + attacker.getEffectiveAttack() * 0.01;
    const defReduction = defender.getEffectiveDefense() * 0.3;

    const rawDamage = baseDamage * attackBonus * elementMult - defReduction;
    return Math.max(1, Math.round(rawDamage));
  }

  /** Gegner-KI: wählt die beste Fähigkeit und Ziele */
  private chooseEnemyAction(unit: ArenaUnit): { abilityIndex: number; targets: ArenaUnit[] } {
    const livingEnemies = this.getLivingPlayerUnits(); // Aus Sicht des Gegners sind Spieler die Feinde
    const livingAllies = this.getLivingEnemyUnits();    // Verbündete des Gegners
    const hpRatio = unit.hp / unit.maxHp;

    // Verfügbare Fähigkeiten (genug MP, nicht auf Cooldown)
    const availableAbilities: { index: number; ability: ActiveAbility }[] = [];
    for (let i = 0; i < unit.abilities.length; i++) {
      const ab = unit.abilities[i];
      if (ab.currentCooldown <= 0 && unit.mp >= ab.def.mpCost) {
        // Selbstzerstörung nur bei wenig HP verwenden
        if (ab.def.selfDestruct && hpRatio > 0.3) continue;
        availableAbilities.push({ index: i, ability: ab });
      }
    }

    // 1. Eigene LP < 30%: Versuch sich selbst zu heilen
    if (hpRatio < 0.3) {
      const selfHeal = availableAbilities.find(
        a => a.ability.def.baseHealing > 0 &&
             (a.ability.def.targetType === 'self' || a.ability.def.targetType === 'single_ally')
      );
      if (selfHeal) {
        const targets = selfHeal.ability.def.targetType === 'self'
          ? [unit]
          : [unit];
        return { abilityIndex: selfHeal.index, targets };
      }
    }

    // 2. Verbündeter LP < 40% und hat Heilfähigkeit
    const woundedAlly = livingAllies
      .filter(a => a.hp / a.maxHp < 0.4 && a.alive)
      .sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];

    if (woundedAlly) {
      const healAbility = availableAbilities.find(
        a => a.ability.def.baseHealing > 0 &&
             (a.ability.def.targetType === 'single_ally' || a.ability.def.targetType === 'all_allies')
      );
      if (healAbility) {
        if (healAbility.ability.def.targetType === 'all_allies') {
          return { abilityIndex: healAbility.index, targets: livingAllies };
        }
        return { abilityIndex: healAbility.index, targets: [woundedAlly] };
      }
    }

    // 3. MP >= 4: Stärkste Schadensfähigkeit verwenden
    if (unit.mp >= 4) {
      const damageAbilities = availableAbilities
        .filter(a => a.ability.def.baseDamage > 0 && a.ability.def.mpCost >= 1)
        .sort((a, b) => b.ability.def.baseDamage - a.ability.def.baseDamage);

      if (damageAbilities.length > 0) {
        const best = damageAbilities[0];
        const targets = this.resolveAITargets(best.ability.def, unit, livingEnemies);
        return { abilityIndex: best.index, targets };
      }
    }

    // 4. AoE verwenden wenn >= 3 Gegner leben
    if (livingEnemies.length >= 3) {
      const aoeAbility = availableAbilities.find(
        a => a.ability.def.targetType === 'all_enemies' &&
             a.ability.def.baseDamage > 0
      );
      if (aoeAbility) {
        return { abilityIndex: aoeAbility.index, targets: livingEnemies };
      }
    }

    // 5. Standard: Basisangriff (Fähigkeit 0) auf Gegner mit niedrigsten LP
    const basicAttack = availableAbilities.find(a => a.index === 0) || availableAbilities[0];
    if (!basicAttack) {
      // Sollte nie passieren, aber Sicherheitsfall
      return {
        abilityIndex: 0,
        targets: livingEnemies.length > 0 ? [livingEnemies[0]] : [],
      };
    }

    const targets = this.resolveAITargets(basicAttack.ability.def, unit, livingEnemies);
    return { abilityIndex: basicAttack.index, targets };
  }

  /** Löst Ziele für die KI auf */
  private resolveAITargets(
    ability: ArenaAbilityDef,
    user: ArenaUnit,
    enemies: ArenaUnit[]
  ): ArenaUnit[] {
    const allies = user.isPlayer ? this.playerTeam : this.enemyTeam;
    const livingAllies = allies.filter(u => u.alive);

    switch (ability.targetType) {
      case 'all_enemies':
        return enemies;

      case 'all_allies':
        return livingAllies;

      case 'self':
        return [user];

      case 'single_enemy': {
        // Taunt-Mechanik
        let validTargets = enemies;
        if (ability.baseDamage > 0) {
          const tauntingUnits = enemies.filter(u => u.isTaunting());
          if (tauntingUnits.length > 0) {
            validTargets = tauntingUnits;
          }
        }
        // Schwächsten Gegner angreifen
        const lowestHp = validTargets.reduce(
          (lowest, u) => (u.hp < lowest.hp ? u : lowest),
          validTargets[0]
        );
        return lowestHp ? [lowestHp] : [];
      }

      case 'single_ally': {
        // Verbündeten mit wenigsten LP heilen
        const lowestAlly = livingAllies.reduce(
          (lowest, u) => ((u.hp / u.maxHp) < (lowest.hp / lowest.maxHp) ? u : lowest),
          livingAllies[0]
        );
        return lowestAlly ? [lowestAlly] : [];
      }

      default:
        return [];
    }
  }

  /** Löst Zielindizes für Spieleraktionen auf */
  private resolveTargets(
    ability: ArenaAbilityDef,
    user: ArenaUnit,
    targetIndices: number[]
  ): ArenaUnit[] {
    const validTargets = this.getValidTargets(ability, user);

    switch (ability.targetType) {
      case 'all_enemies':
      case 'all_allies':
        return validTargets;

      case 'self':
        return [user];

      case 'single_enemy':
      case 'single_ally': {
        if (targetIndices.length === 0) {
          return validTargets.length > 0 ? [validTargets[0]] : [];
        }
        // Index bezieht sich auf die gültigen Ziele
        const idx = targetIndices[0];
        if (idx >= 0 && idx < validTargets.length) {
          return [validTargets[idx]];
        }
        return validTargets.length > 0 ? [validTargets[0]] : [];
      }

      default:
        return [];
    }
  }

  /** Wendet eine Fähigkeit auf Ziele an */
  private applyAbility(user: ArenaUnit, ability: ArenaAbilityDef, targets: ArenaUnit[]): TurnResult {
    const damageDealt: number[] = [];
    const healingDone: number[] = [];
    const statusApplied: StatusEffect[][] = [];
    const killedUnits: ArenaUnit[] = [];
    const textParts: string[] = [];

    // Angriffsanimation
    if (ability.baseDamage > 0) {
      user.playAttackAnimation();
    }

    textParts.push(`${user.def.name} setzt "${ability.name}" ein!`);

    for (const target of targets) {
      let dmg = 0;
      let heal = 0;
      const appliedStatuses: StatusEffect[] = [];

      // Schaden berechnen und anwenden
      if (ability.baseDamage > 0 && target.alive) {
        dmg = this.calcDamage(
          ability.baseDamage,
          ability.element,
          target.def.element,
          user,
          target
        );
        const actualDmg = target.takeDamage(dmg);
        dmg = actualDmg;

        // Trefferanimation
        target.playHitAnimation();

        textParts.push(`  ${target.def.name} erleidet ${dmg} Schaden.`);

        // Lebensentzug (Drain)
        if (ability.drainHealing && dmg > 0) {
          const drainHeal = user.heal(dmg);
          textParts.push(`  ${user.def.name} heilt sich um ${drainHeal} LP.`);
        }

        // Tod prüfen
        if (!target.alive) {
          killedUnits.push(target);
          target.playDeathAnimation();
          textParts.push(`  ${target.def.name} wurde besiegt!`);
        }
      }

      // Heilung anwenden
      if (ability.baseHealing > 0) {
        if (ability.revive && !target.alive) {
          target.revive(ability.baseHealing);
          heal = ability.baseHealing;
          textParts.push(`  ${target.def.name} wurde wiederbelebt mit ${heal} LP!`);
        } else if (target.alive) {
          heal = target.heal(ability.baseHealing);
          if (heal > 0) {
            textParts.push(`  ${target.def.name} wird um ${heal} LP geheilt.`);
          }
        }

        // Dunkle Ernte: Heilt alle Verbündeten bei Schaden an Gegnern
        if (ability.id === 'necromancer_4' && ability.baseDamage > 0) {
          const allies = user.isPlayer
            ? this.playerTeam.filter(u => u.alive)
            : this.enemyTeam.filter(u => u.alive);
          for (const ally of allies) {
            const allyHeal = ally.heal(ability.baseHealing);
            if (allyHeal > 0) {
              textParts.push(`  ${ally.def.name} wird um ${allyHeal} LP geheilt.`);
            }
          }
        }
      }

      // Statuseffekt anwenden
      if (ability.effect && target.alive) {
        const status: StatusEffect = {
          type: ability.effect.type,
          duration: ability.effect.duration,
          value: ability.effect.value,
          source: ability.name,
        };
        target.addStatus(status);
        appliedStatuses.push(status);

        const effectName = this.getEffectDisplayName(ability.effect.type);
        textParts.push(`  ${target.def.name} erhält "${effectName}" für ${ability.effect.duration} Runde(n).`);

        // Provokation hat auch buff_def (Schildträger Fähigkeit 3)
        if (ability.id === 'guardian_3') {
          const defBuff: StatusEffect = {
            type: 'buff_def',
            duration: 3,
            value: 2.0,
            source: ability.name,
          };
          target.addStatus(defBuff);
          appliedStatuses.push(defBuff);
          textParts.push(`  ${target.def.name} erhält erhöhte Verteidigung.`);
        }

        // Fluch hat auch debuff_def (Nekromant Fähigkeit 3)
        if (ability.id === 'necromancer_3') {
          const defDebuff: StatusEffect = {
            type: 'debuff_def',
            duration: 3,
            value: 0.5,
            source: ability.name,
          };
          target.addStatus(defDebuff);
          appliedStatuses.push(defDebuff);
          textParts.push(`  ${target.def.name} wird auch in der Verteidigung geschwächt.`);
        }
      }

      damageDealt.push(dmg);
      healingDone.push(heal);
      statusApplied.push(appliedStatuses);
    }

    return {
      action: { unit: user, ability, targets },
      damageDealt,
      healingDone,
      statusApplied,
      killedUnits,
      text: textParts.join('\n'),
    };
  }

  /** Gibt den deutschen Anzeigenamen eines Effekttyps zurück */
  private getEffectDisplayName(type: string): string {
    const names: Record<string, string> = {
      burn: 'Verbrennung',
      freeze: 'Einfrieren',
      slow: 'Verlangsamung',
      poison: 'Vergiftung',
      stun: 'Betäubung',
      shield: 'Schild',
      taunt: 'Provokation',
      regen: 'Regeneration',
      buff_atk: 'Angriffsstärke',
      buff_def: 'Verteidigungsstärke',
      debuff_atk: 'Angriffsschwäche',
      debuff_def: 'Verteidigungsschwäche',
    };
    return names[type] || type;
  }

  /** Erstellt ein leeres Ergebnis für ungültige Aktionen */
  private createEmptyResult(unit: ArenaUnit | undefined): TurnResult {
    const fallbackUnit = unit || this.turnOrder[0];
    return {
      action: {
        unit: fallbackUnit,
        ability: fallbackUnit?.abilities[0]?.def || {} as ArenaAbilityDef,
        targets: [],
      },
      damageDealt: [],
      healingDone: [],
      statusApplied: [],
      killedUnits: [],
      text: unit ? `${unit.def.name} kann nicht handeln.` : 'Ungültige Aktion.',
    };
  }

  /** Gibt alle lebenden Spieler-Einheiten zurück */
  getLivingPlayerUnits(): ArenaUnit[] {
    return this.playerTeam.filter(u => u.alive);
  }

  /** Gibt alle lebenden Gegner-Einheiten zurück */
  getLivingEnemyUnits(): ArenaUnit[] {
    return this.enemyTeam.filter(u => u.alive);
  }

  /** Gibt die aktuelle Rundennummer zurück */
  getRoundNumber(): number {
    return this.roundNumber;
  }

  /** Gibt die Zugreihenfolge zurück */
  getTurnOrder(): ArenaUnit[] {
    return this.turnOrder;
  }
}
