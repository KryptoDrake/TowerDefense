// Kampfeinheit für den rundenbasierten Arena-Modus

import * as THREE from 'three';
import { UnitDef, UnitElement } from '../units/UnitConfig';
import { ArenaAbilityDef, ActiveAbility, createActiveAbilities } from './ArenaAbility';
import { UnitMeshFactory } from '../units/UnitMeshFactory';

// ─── Statuseffekt ───────────────────────────────────────────────────────────

export interface StatusEffect {
  type: string;        // Entspricht AbilityEffect.type
  duration: number;    // Verbleibende Runden
  value: number;
  source: string;      // Fähigkeitsname für Anzeige
}

// ─── Eindeutige ID-Generierung ──────────────────────────────────────────────

let arenaUnitCounter = 0;

// ─── Positionen für Spieler und Gegner ──────────────────────────────────────

const PLAYER_POSITIONS = [
  new THREE.Vector3(-6, 0, 0),
  new THREE.Vector3(-4, 0, 0),
  new THREE.Vector3(-2, 0, 0),
  new THREE.Vector3(0, 0, 0),
];

const ENEMY_POSITIONS = [
  new THREE.Vector3(6, 0, 0),
  new THREE.Vector3(4, 0, 0),
  new THREE.Vector3(2, 0, 0),
  new THREE.Vector3(0, 0, 0),
];

// ─── Arena-Einheit ──────────────────────────────────────────────────────────

export class ArenaUnit {
  readonly id: string;
  readonly def: UnitDef;
  readonly mesh: THREE.Group;
  readonly isPlayer: boolean;

  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  attack: number;
  baseAttack: number;
  defense: number;
  baseDefense: number;
  speed: number;
  level: number;

  abilities: ActiveAbility[];
  statusEffects: StatusEffect[];
  alive: boolean;

  // Visuelle Position
  position: number;   // Slot-Index (0-3)

  // Ursprüngliche Position für Animationen
  private originalPosition: THREE.Vector3;

  // HP/MP-Balken - declare wegen useDefineForClassFields
  private declare hpBarBg: THREE.Mesh;
  private declare hpBarFill: THREE.Mesh;
  private declare mpBarBg: THREE.Mesh;
  private declare mpBarFill: THREE.Mesh;

  constructor(def: UnitDef, isPlayer: boolean, slotIndex: number, level: number = 1) {
    this.id = `arena_${arenaUnitCounter++}`;
    this.def = def;
    this.isPlayer = isPlayer;
    this.position = slotIndex;
    this.level = level;

    // Statsberechnung mit Level-Bonus (5% pro Level)
    const levelMult = 1 + (level - 1) * 0.05;
    this.maxHp = Math.round(def.hp * levelMult);
    this.hp = this.maxHp;
    this.mp = 0;
    this.maxMp = 10;
    this.baseAttack = Math.round(def.attack * levelMult);
    this.attack = this.baseAttack;
    this.baseDefense = Math.round(def.defense * levelMult);
    this.defense = this.baseDefense;
    this.speed = def.speed;

    this.abilities = createActiveAbilities(def.id);
    this.statusEffects = [];
    this.alive = true;

    // Mesh erstellen
    this.mesh = UnitMeshFactory.createUnitMesh(def);

    // Position setzen
    const positions = isPlayer ? PLAYER_POSITIONS : ENEMY_POSITIONS;
    const pos = positions[Math.min(slotIndex, positions.length - 1)];
    this.mesh.position.copy(pos);
    this.originalPosition = pos.clone();

    // Gegner drehen, damit sie zum Spieler schauen
    if (!isPlayer) {
      this.mesh.rotation.y = Math.PI;
    }

    // HP/MP-Balken erstellen
    this.createBars();
    this.updateBars();
  }

  /** Erstellt HP- und MP-Balken über der Einheit */
  private createBars(): void {
    const barWidth = 0.5;
    const barHeight = 0.05;
    const mpBarHeight = 0.035;

    // HP-Balken Hintergrund
    const hpBgGeo = new THREE.PlaneGeometry(barWidth, barHeight);
    const hpBgMat = new THREE.MeshBasicMaterial({
      color: 0x440000,
      side: THREE.DoubleSide,
      depthTest: false,
    });
    this.hpBarBg = new THREE.Mesh(hpBgGeo, hpBgMat);
    this.hpBarBg.position.y = 1.15;
    this.hpBarBg.renderOrder = 998;
    this.mesh.add(this.hpBarBg);

    // HP-Balken Füllung
    const hpFillGeo = new THREE.PlaneGeometry(barWidth, barHeight);
    const hpFillMat = new THREE.MeshBasicMaterial({
      color: 0x44ff44,
      side: THREE.DoubleSide,
      depthTest: false,
    });
    this.hpBarFill = new THREE.Mesh(hpFillGeo, hpFillMat);
    this.hpBarFill.position.y = 1.15;
    this.hpBarFill.position.z = 0.001;
    this.hpBarFill.renderOrder = 999;
    this.mesh.add(this.hpBarFill);

    // MP-Balken Hintergrund
    const mpBgGeo = new THREE.PlaneGeometry(barWidth, mpBarHeight);
    const mpBgMat = new THREE.MeshBasicMaterial({
      color: 0x000044,
      side: THREE.DoubleSide,
      depthTest: false,
    });
    this.mpBarBg = new THREE.Mesh(mpBgGeo, mpBgMat);
    this.mpBarBg.position.y = 1.08;
    this.mpBarBg.renderOrder = 998;
    this.mesh.add(this.mpBarBg);

    // MP-Balken Füllung
    const mpFillGeo = new THREE.PlaneGeometry(barWidth, mpBarHeight);
    const mpFillMat = new THREE.MeshBasicMaterial({
      color: 0x4488ff,
      side: THREE.DoubleSide,
      depthTest: false,
    });
    this.mpBarFill = new THREE.Mesh(mpFillGeo, mpFillMat);
    this.mpBarFill.position.y = 1.08;
    this.mpBarFill.position.z = 0.001;
    this.mpBarFill.renderOrder = 999;
    this.mesh.add(this.mpBarFill);
  }

  /** Wendet alle Statuseffekte am Rundenstart an */
  applyTurnStartEffects(): { text: string; damage: number; healing: number }[] {
    const results: { text: string; damage: number; healing: number }[] = [];

    for (const effect of this.statusEffects) {
      switch (effect.type) {
        case 'burn': {
          const dmg = effect.value;
          this.hp = Math.max(0, this.hp - dmg);
          results.push({
            text: `${this.def.name} erleidet ${dmg} Brandschaden (${effect.source})`,
            damage: dmg,
            healing: 0,
          });
          if (this.hp <= 0) {
            this.alive = false;
          }
          break;
        }
        case 'poison': {
          const dmg = effect.value;
          this.hp = Math.max(0, this.hp - dmg);
          results.push({
            text: `${this.def.name} erleidet ${dmg} Giftschaden (${effect.source})`,
            damage: dmg,
            healing: 0,
          });
          if (this.hp <= 0) {
            this.alive = false;
          }
          break;
        }
        case 'regen': {
          const healed = this.heal(effect.value);
          if (healed > 0) {
            results.push({
              text: `${this.def.name} regeneriert ${healed} LP (${effect.source})`,
              damage: 0,
              healing: healed,
            });
          }
          break;
        }
        // Stun/Freeze werden in isStunned() geprüft
        // Buffs/Debuffs werden in getEffectiveAttack/Defense() berücksichtigt
      }
    }

    this.updateBars();
    return results;
  }

  /** Gibt den effektiven Angriff (mit Buffs/Debuffs) zurück */
  getEffectiveAttack(): number {
    let mult = 1.0;
    for (const effect of this.statusEffects) {
      if (effect.type === 'buff_atk') {
        mult *= effect.value;
      } else if (effect.type === 'debuff_atk') {
        mult *= effect.value;
      }
    }
    return Math.round(this.baseAttack * mult);
  }

  /** Gibt die effektive Verteidigung (mit Buffs/Debuffs) zurück */
  getEffectiveDefense(): number {
    let mult = 1.0;
    for (const effect of this.statusEffects) {
      if (effect.type === 'buff_def') {
        mult *= effect.value;
      } else if (effect.type === 'debuff_def') {
        mult *= effect.value;
      }
    }
    return Math.round(this.baseDefense * mult);
  }

  /** Nimmt Schaden (unter Berücksichtigung von Verteidigung und Schild) */
  takeDamage(amount: number, ignoreDefense: boolean = false): number {
    if (!this.alive) return 0;

    let finalDamage = amount;

    // Schildabsorption zuerst
    for (const effect of this.statusEffects) {
      if (effect.type === 'shield' && effect.value > 0) {
        const absorbed = Math.min(finalDamage, effect.value);
        effect.value -= absorbed;
        finalDamage -= absorbed;
        if (finalDamage <= 0) {
          this.updateBars();
          return amount - finalDamage;
        }
      }
    }

    // Verteidigung anwenden (wenn nicht ignoriert)
    if (!ignoreDefense) {
      finalDamage = Math.max(1, finalDamage - this.getEffectiveDefense() * 0.3);
    }

    finalDamage = Math.round(Math.max(1, finalDamage));
    this.hp = Math.max(0, this.hp - finalDamage);

    if (this.hp <= 0) {
      this.alive = false;
    }

    this.updateBars();
    return finalDamage;
  }

  /** Heilt LP */
  heal(amount: number): number {
    if (!this.alive) return 0;

    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + Math.round(amount));
    const healed = this.hp - before;

    this.updateBars();
    return healed;
  }

  /** Fügt einen Statuseffekt hinzu */
  addStatus(effect: StatusEffect): void {
    // Gleichen Effekt-Typ erneuern statt stapeln (außer Schild, das sich addiert)
    const existing = this.statusEffects.find(
      e => e.type === effect.type && e.source === effect.source
    );

    if (existing && effect.type !== 'shield') {
      // Erneuere Dauer und Wert
      existing.duration = Math.max(existing.duration, effect.duration);
      existing.value = effect.value;
    } else {
      this.statusEffects.push({ ...effect });
    }
  }

  /** Entfernt abgelaufene Statuseffekte (am Rundenende aufgerufen) */
  tickStatusEffects(): void {
    for (const effect of this.statusEffects) {
      effect.duration--;
    }
    // Abgelaufene entfernen und aufgebrauchte Schilde
    this.statusEffects = this.statusEffects.filter(e => {
      if (e.duration <= 0) return false;
      if (e.type === 'shield' && e.value <= 0) return false;
      return true;
    });
  }

  /** Prüft ob die Einheit betäubt/eingefroren ist */
  isStunned(): boolean {
    return this.statusEffects.some(
      e => e.type === 'stun' || e.type === 'freeze'
    );
  }

  /** Prüft ob die Einheit provoziert (Taunt aktiv) */
  isTaunting(): boolean {
    return this.statusEffects.some(e => e.type === 'taunt');
  }

  /** Regeneriert MP am Rundenende */
  regenMp(): void {
    this.mp = Math.min(this.maxMp, this.mp + 2);
    this.updateBars();
  }

  /** Belebt die Einheit mit gegebenen LP wieder */
  revive(hp: number): void {
    if (this.alive) return;

    this.alive = true;
    this.hp = Math.min(this.maxHp, Math.round(hp));
    this.statusEffects = [];

    // Mesh wieder sichtbar machen
    this.mesh.visible = true;
    this.mesh.position.copy(this.originalPosition);

    // Skalierung zurücksetzen (falls Todesanimation sie verändert hat)
    const children = this.mesh.children;
    for (const child of children) {
      if (child instanceof THREE.Mesh) {
        const mat = child.material as THREE.MeshLambertMaterial | THREE.MeshBasicMaterial;
        if (mat.transparent) {
          mat.opacity = mat.userData?.originalOpacity ?? 1.0;
        }
      }
    }

    this.updateBars();
  }

  /** Aktualisiert die visuellen Balken */
  updateBars(): void {
    const barWidth = 0.5;

    // HP-Balken
    const hpRatio = Math.max(0, Math.min(1, this.hp / this.maxHp));
    this.hpBarFill.scale.x = Math.max(0.001, hpRatio);
    this.hpBarFill.position.x = -(barWidth * (1 - hpRatio)) / 2;

    // HP-Farbe
    const hpMat = this.hpBarFill.material as THREE.MeshBasicMaterial;
    if (hpRatio > 0.6) {
      hpMat.color.setHex(0x44ff44);
    } else if (hpRatio > 0.3) {
      hpMat.color.setHex(0xffcc00);
    } else {
      hpMat.color.setHex(0xff2222);
    }

    // MP-Balken
    const mpRatio = Math.max(0, Math.min(1, this.mp / this.maxMp));
    this.mpBarFill.scale.x = Math.max(0.001, mpRatio);
    this.mpBarFill.position.x = -(barWidth * (1 - mpRatio)) / 2;
  }

  /** Angriffsanimation (Ausfallschritt nach vorne) */
  playAttackAnimation(): void {
    const direction = this.isPlayer ? 1 : -1;
    const startX = this.mesh.position.x;
    const targetX = startX + direction * 1.5;
    const duration = 300;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);

      if (t < 0.5) {
        // Vorwärts
        const ease = t * 2;
        this.mesh.position.x = startX + (targetX - startX) * ease;
      } else {
        // Zurück
        const ease = (t - 0.5) * 2;
        this.mesh.position.x = targetX + (startX - targetX) * ease;
      }

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        this.mesh.position.x = startX;
      }
    };

    requestAnimationFrame(animate);
  }

  /** Trefferanimation (rot aufblitzen) */
  playHitAnimation(): void {
    const meshes: THREE.Mesh[] = [];
    this.mesh.traverse(child => {
      if (child instanceof THREE.Mesh && child !== this.hpBarBg && child !== this.hpBarFill
        && child !== this.mpBarBg && child !== this.mpBarFill) {
        meshes.push(child);
      }
    });

    // Originalfarben speichern
    const originalColors: Map<THREE.Mesh, THREE.Color> = new Map();
    for (const m of meshes) {
      const mat = m.material as THREE.MeshLambertMaterial | THREE.MeshBasicMaterial;
      if ('color' in mat) {
        originalColors.set(m, mat.color.clone());
        mat.color.setHex(0xff0000);
      }
    }

    // Nach 200ms zurücksetzen
    setTimeout(() => {
      for (const m of meshes) {
        const original = originalColors.get(m);
        if (original) {
          const mat = m.material as THREE.MeshLambertMaterial | THREE.MeshBasicMaterial;
          mat.color.copy(original);
        }
      }
    }, 200);
  }

  /** Todesanimation */
  playDeathAnimation(): void {
    const duration = 600;
    const startTime = performance.now();
    const startY = this.mesh.position.y;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);

      // Nach unten sinken und ausblenden
      this.mesh.position.y = startY - t * 0.5;

      // Transparenz für alle Materialien
      this.mesh.traverse(child => {
        if (child instanceof THREE.Mesh) {
          const mat = child.material as THREE.MeshLambertMaterial | THREE.MeshBasicMaterial;
          if (!mat.transparent) {
            mat.userData.originalOpacity = mat.opacity;
            mat.transparent = true;
          }
          mat.opacity = 1 - t;
        }
      });

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        this.mesh.visible = false;
      }
    };

    requestAnimationFrame(animate);
  }

  /** Aufräumen */
  cleanup(scene: THREE.Scene): void {
    scene.remove(this.mesh);

    // Geometrien und Materialien freigeben
    this.mesh.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        const mat = child.material;
        if (Array.isArray(mat)) {
          for (const m of mat) m.dispose();
        } else {
          mat.dispose();
        }
      }
    });
  }
}
