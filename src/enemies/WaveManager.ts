import * as THREE from 'three';
import { Enemy } from './Enemy';
import { ZombieFactory } from './ZombieFactory';
import { BossAbilities } from './BossAbilities';
import { BALANCE, ZombieType } from '../systems/BalanceConfig';
import { EconomySystem } from '../systems/EconomySystem';
import { WaveDef } from '../systems/LevelConfig';
import { RunModifiers } from '../systems/RunManager';

export class WaveManager {
  private scene: THREE.Scene;
  private factory: ZombieFactory;
  private economy: EconomySystem;
  private enemies: Enemy[] = [];
  private currentWave = 0;
  private spawnQueue: ZombieType[] = [];
  private spawnTimer = 0;
  private waveActive = false;
  private allWavesComplete = false;
  private waveEnemyTotal = 0;
  private waveEnemiesKilled = 0;
  private waveAllSpawned = false;

  private waveDefs: WaveDef[][];
  private totalWaves: number;
  private modifiers: RunModifiers;
  private bossAbilities: BossAbilities;

  // UI references
  private waveDisplay: HTMLElement;
  private startWaveBtn: HTMLButtonElement;

  // Challenge flags
  noGoldPerKill = false;
  bossRush = false;

  // Callbacks
  onEnemyReachEnd: ((damage: number) => void) | null = null;
  onAllWavesComplete: (() => void) | null = null;
  onEnemyKilled: ((enemy: Enemy, goldReward: number) => void) | null = null;
  onWaveStart: (() => void) | null = null;
  onWaveEnd: (() => void) | null = null;

  private static listenerAttached = false;
  private static instance: WaveManager | null = null;

  constructor(
    scene: THREE.Scene,
    factory: ZombieFactory,
    economy: EconomySystem,
    waveDefs?: WaveDef[][],
    modifiers?: RunModifiers
  ) {
    this.scene = scene;
    this.factory = factory;
    this.economy = economy;
    this.waveDefs = waveDefs || BALANCE.waves as any;
    this.totalWaves = this.waveDefs.length;
    this.modifiers = modifiers || {
      damageMult: 1, fireRateMult: 1, rangeMult: 1, goldMult: 1,
      hpMult: 1, costMult: 1, enemySpeedMult: 1, enemyHpMult: 1,
      splashRadiusMult: 1, dotMult: 1, slowMult: 1,
    };

    // Boss abilities system
    this.bossAbilities = new BossAbilities(scene);
    this.bossAbilities.onSpawnMinions = (pos, count, hpMult) => {
      this.spawnBossMinions(pos, count, hpMult);
    };

    this.waveDisplay = document.getElementById('wave-display')!;
    this.startWaveBtn = document.getElementById('start-wave-btn') as HTMLButtonElement;

    // Only attach listener once to prevent stacking
    WaveManager.instance = this;
    if (!WaveManager.listenerAttached) {
      this.startWaveBtn.addEventListener('click', () => {
        WaveManager.instance?.startNextWave();
      });
      WaveManager.listenerAttached = true;
    }
    this.updateWaveDisplay();
  }

  startNextWave(): void {
    if (this.waveActive || this.allWavesComplete) return;
    if (this.currentWave >= this.totalWaves) return;

    this.waveActive = true;
    this.startWaveBtn.disabled = true;

    const waveDef = this.waveDefs[this.currentWave];
    this.spawnQueue = [];
    for (const group of waveDef) {
      for (let i = 0; i < group.count; i++) {
        this.spawnQueue.push(group.type as ZombieType);
      }
    }
    // Boss-Rush: add extra boss every 3rd wave
    if (this.bossRush && this.currentWave % 3 === 0) {
      this.spawnQueue.push('boss');
    }
    // Shuffle
    for (let i = this.spawnQueue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.spawnQueue[i], this.spawnQueue[j]] = [this.spawnQueue[j], this.spawnQueue[i]];
    }

    this.waveEnemyTotal = this.spawnQueue.length;
    this.waveEnemiesKilled = 0;
    this.waveAllSpawned = false;
    this.spawnTimer = 0;
    this.currentWave++;
    this.updateWaveDisplay();
    this.onWaveStart?.();
  }

  update(dt: number): void {
    // Spawn enemies from queue
    if (this.spawnQueue.length > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        const type = this.spawnQueue.shift()!;
        const enemy = this.factory.create(type);

        // Apply run modifiers to enemy
        enemy.hp = Math.floor(enemy.hp * this.modifiers.enemyHpMult);
        enemy.maxHp = Math.floor(enemy.maxHp * this.modifiers.enemyHpMult);
        enemy.speed *= this.modifiers.enemySpeedMult;
        enemy.baseSpeed *= this.modifiers.enemySpeedMult;

        this.enemies.push(enemy);
        this.scene.add(enemy.mesh);
        // Spawn ground crack at emergence point
        enemy.spawnGroundCrack(this.scene);

        // Assign boss abilities to boss-type enemies
        if (type === 'boss') {
          this.bossAbilities.assignAbilities(enemy);
        }

        this.spawnTimer = BALANCE.timeBetweenSpawns;
        if (this.spawnQueue.length === 0) {
          this.waveAllSpawned = true;
        }
      }
    }

    // Collect newly spawned splitter children to add after iteration
    const newEnemies: Enemy[] = [];

    // Update all enemies
    for (const enemy of this.enemies) {
      if (enemy.alive) {
        enemy.update(dt);

        // Healer: heal nearby allies
        if (enemy.healRate > 0) {
          enemy.healNearby(this.enemies, dt);
        }
      }

      if (!enemy.alive && !enemy.goldGiven) {
        enemy.goldGiven = true;
        if (enemy.reachedEnd) {
          this.waveEnemiesKilled++;
          this.onEnemyReachEnd?.(enemy.damage);
          enemy.deathDone = true;
        } else {
          let goldReward = 0;
          if (!this.noGoldPerKill) {
            const baseGold = BALANCE.goldPerKill[enemy.type as keyof typeof BALANCE.goldPerKill] || 10;
            goldReward = Math.floor(baseGold * this.modifiers.goldMult);
            this.economy.earn(goldReward);
          }
          this.waveEnemiesKilled++;
          this.createDeathEffect(enemy.getPosition());
          // Spawn body fragments + ground splat
          enemy.spawnDeathEffects(this.scene);
          this.onEnemyKilled?.(enemy, goldReward);

          // Splitter: spawn mini-splitters on death
          if (enemy.splitsOnDeath && enemy.splitType) {
            const parentPos = enemy.getPosition();
            const parentDist = enemy.getDistanceTraveled();
            for (let i = 0; i < enemy.splitCount; i++) {
              const mini = this.factory.create(enemy.splitType);
              // Apply run modifiers
              mini.hp = Math.floor(mini.hp * this.modifiers.enemyHpMult);
              mini.maxHp = Math.floor(mini.maxHp * this.modifiers.enemyHpMult);
              mini.speed *= this.modifiers.enemySpeedMult;
              mini.baseSpeed *= this.modifiers.enemySpeedMult;
              // Position at parent's location with slight offset
              const offsetX = (Math.random() - 0.5) * 1.0;
              const offsetZ = (Math.random() - 0.5) * 1.0;
              mini.mesh.position.set(parentPos.x + offsetX, 0, parentPos.z + offsetZ);
              mini.skipSpawnAnimation();
              mini.setDistanceTraveled(parentDist);
              newEnemies.push(mini);
              this.scene.add(mini.mesh);
            }
          }
        }
      }

      if (enemy.dying && !enemy.deathDone) {
        enemy.updateDeath(dt);
      }
    }

    // Add any newly spawned mini-splitters
    if (newEnemies.length > 0) {
      this.enemies.push(...newEnemies);
    }

    // Update boss abilities
    this.bossAbilities.update(dt, this.enemies);

    // Clean up
    this.enemies = this.enemies.filter(e => {
      if (e.deathDone) {
        this.scene.remove(e.mesh);
        return false;
      }
      return true;
    });

    // Check wave completion
    if (this.waveActive && this.spawnQueue.length === 0 && this.enemies.length === 0) {
      this.waveActive = false;
      this.startWaveBtn.disabled = false;
      const waveGold = Math.floor(BALANCE.goldPerWave * this.modifiers.goldMult);
      this.economy.earn(waveGold);
      this.onWaveEnd?.();

      if (this.currentWave >= this.totalWaves) {
        this.allWavesComplete = true;
        this.startWaveBtn.textContent = 'Gewonnen!';
        this.startWaveBtn.disabled = true;
        this.onAllWavesComplete?.();
      } else {
        this.startWaveBtn.textContent = `Welle ${this.currentWave + 1} Starten`;
        // Flash the button to indicate ready
        this.startWaveBtn.style.animation = 'none';
        void this.startWaveBtn.offsetHeight; // trigger reflow
        this.startWaveBtn.style.animation = '';
      }
    }
  }

  private createDeathEffect(pos: THREE.Vector3): void {
    const particleCount = 6;
    const mat = new THREE.MeshBasicMaterial({ color: 0x44ff44 });

    for (let i = 0; i < particleCount; i++) {
      const geo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
      const p = new THREE.Mesh(geo, mat);
      p.position.copy(pos);
      p.position.y = 0.5 + Math.random();
      this.scene.add(p);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 3,
        2 + Math.random() * 2,
        (Math.random() - 0.5) * 3
      );

      const animate = () => {
        vel.y -= 9.8 * 0.016;
        p.position.add(vel.clone().multiplyScalar(0.016));
        p.rotation.x += 0.1;
        p.rotation.z += 0.1;
        p.scale.multiplyScalar(0.96);
        if (p.scale.x > 0.01) {
          requestAnimationFrame(animate);
        } else {
          this.scene.remove(p);
          geo.dispose();
        }
      };
      requestAnimationFrame(animate);
    }
  }

  /** Spawn minions at a position (used by boss summon ability) */
  private spawnBossMinions(pos: THREE.Vector3, count: number, hpMult: number): void {
    for (let i = 0; i < count; i++) {
      const minion = this.factory.create('normal');
      // Apply run modifiers + boss summon HP multiplier
      minion.hp = Math.floor(minion.hp * this.modifiers.enemyHpMult * hpMult);
      minion.maxHp = Math.floor(minion.maxHp * this.modifiers.enemyHpMult * hpMult);
      minion.speed *= this.modifiers.enemySpeedMult;
      minion.baseSpeed *= this.modifiers.enemySpeedMult;
      // Position near boss with offset
      const offsetX = (Math.random() - 0.5) * 2;
      const offsetZ = (Math.random() - 0.5) * 2;
      minion.mesh.position.set(pos.x + offsetX, 0, pos.z + offsetZ);
      minion.skipSpawnAnimation();
      // Estimate distance traveled from boss position
      minion.setDistanceTraveled(0);
      this.enemies.push(minion);
      this.scene.add(minion.mesh);
    }
  }

  /** Update run modifiers at runtime (used by endless mode scaling) */
  setModifiers(mods: RunModifiers): void {
    this.modifiers = mods;
  }

  getBossAbilities(): BossAbilities {
    return this.bossAbilities;
  }

  getEnemies(): Enemy[] {
    return this.enemies;
  }

  isWaveActive(): boolean {
    return this.waveActive;
  }

  getCurrentWave(): number {
    return this.currentWave;
  }

  getTotalWaves(): number {
    return this.totalWaves;
  }

  getWaveDefs(): WaveDef[][] {
    return this.waveDefs;
  }

  getWaveEnemyTotal(): number {
    return this.waveEnemyTotal;
  }

  getWaveEnemiesKilled(): number {
    return this.waveEnemiesKilled;
  }

  isWaveAllSpawned(): boolean {
    return this.waveAllSpawned;
  }

  private updateWaveDisplay(): void {
    this.waveDisplay.textContent = `${this.currentWave} / ${this.totalWaves}`;
  }

  reset(): void {
    this.bossAbilities.clear();
    for (const enemy of this.enemies) {
      this.scene.remove(enemy.mesh);
    }
    this.enemies = [];
    this.currentWave = 0;
    this.spawnQueue = [];
    this.waveActive = false;
    this.allWavesComplete = false;
    this.waveEnemyTotal = 0;
    this.waveEnemiesKilled = 0;
    this.waveAllSpawned = false;
    this.startWaveBtn.disabled = false;
    this.startWaveBtn.textContent = 'Welle Starten';
    this.updateWaveDisplay();
  }
}
