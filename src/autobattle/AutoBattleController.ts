// Auto-Battle Controller: Haupt-Controller für den TFT-artigen Auto-Kampf-Modus.
// Orchestriert Grid, Einheiten, Laden, Kampf und UI.

import * as THREE from 'three';
import { GameController, ModeStats } from '../game/GameController';
import { LevelDef } from '../systems/LevelConfig';
import { RunModifiers } from '../systems/RunManager';
import { AutoBattleGrid } from './AutoBattleGrid';
import { AutoBattleUnit } from './AutoBattleUnit';
import { AutoBattleCombat } from './AutoBattleCombat';
import { AutoBattleShop } from './AutoBattleShop';
import { AutoBattleUI, ABPhase } from './AutoBattleUI';
import { AutoBattleWaves } from './AutoBattleWaves';
import { UNIT_DEFS } from '../units/UnitConfig';

export class AutoBattleController implements GameController {
  onVictory: ((stats: ModeStats) => void) | null = null;
  onDefeat: ((stats: ModeStats) => void) | null = null;

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private grid!: AutoBattleGrid;
  private shop!: AutoBattleShop;
  private ui!: AutoBattleUI;

  private playerUnits: AutoBattleUnit[] = [];
  private enemyUnits: AutoBattleUnit[] = [];
  private phase: ABPhase = 'planning';
  private round = 0;
  private playerHP = 100;
  private totalKills = 0;
  private crystalsEarned = 0;
  private active = false;

  // Zeitsteuerung
  private planTimer = 30;
  private resultTimer = 3;
  private winStreak = 0;
  private loseStreak = 0;

  // UI-Dirty-Flag: nur bei Datenänderung voll updaten
  private uiDirty = true;

  // Beleuchtung
  private ambientLight: THREE.AmbientLight | null = null;
  private directionalLight: THREE.DirectionalLight | null = null;

  // Maus-Interaktion
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private selectedBenchUnitId: string | null = null;

  // Statisches Instanz-Pattern gegen Event-Listener-Stacking
  private static instance: AutoBattleController | null = null;
  private static listenersAttached = false;

  // Maximale Einheiten auf dem Brett basierend auf Spielerlevel
  private get maxBoardUnits(): number {
    // Level 1: 1, Level 2: 2, ..., Level 8: 8
    return this.shop ? this.shop.playerLevel : 1;
  }

  init(
    _level: LevelDef,
    _modifiers: RunModifiers,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera
  ): void {
    AutoBattleController.instance = this;

    this.scene = scene;
    this.camera = camera;

    // Szene einrichten
    this.scene.background = new THREE.Color(0x0a0a1a);
    this.scene.fog = null;

    // Kamera positionieren (schräge Draufsicht)
    this.camera.position.set(0, 22, 14);
    this.camera.lookAt(0, 0, 0);

    // Beleuchtung
    this.ambientLight = new THREE.AmbientLight(0x6666aa, 0.4);
    this.scene.add(this.ambientLight);

    this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
    this.directionalLight.position.set(8, 15, 5);
    this.directionalLight.castShadow = false;
    this.scene.add(this.directionalLight);

    // Grid erstellen
    this.grid = new AutoBattleGrid(this.scene);

    // Shop erstellen
    this.shop = new AutoBattleShop();

    // UI erstellen
    this.ui = new AutoBattleUI();
    this.setupUICallbacks();
    this.setupInputHandlers();

    // Zustand zurücksetzen
    this.playerUnits = [];
    this.enemyUnits = [];
    this.phase = 'planning';
    this.round = 0;
    this.playerHP = 100;
    this.totalKills = 0;
    this.crystalsEarned = 0;
    this.winStreak = 0;
    this.loseStreak = 0;
    this.active = false;
  }

  start(): void {
    this.active = true;
    this.ui.show();
    this.startPlanningPhase();
  }

  stop(): void {
    this.active = false;
  }

  update(dt: number): void {
    if (!this.active) return;

    switch (this.phase) {
      case 'planning':
        this.updatePlanning(dt);
        break;
      case 'combat':
        this.updateCombat(dt);
        break;
      case 'result':
        this.updateResult(dt);
        break;
    }
  }

  cleanup(): void {
    this.active = false;

    // Alle Einheiten entfernen
    for (const u of this.playerUnits) {
      u.cleanup(this.scene);
    }
    for (const u of this.enemyUnits) {
      u.cleanup(this.scene);
    }
    // Bank-Einheiten aufräumen (haben kein Mesh in der Szene, aber sicherheitshalber)
    if (this.shop) {
      for (const u of this.shop.bench) {
        u.cleanup(this.scene);
      }
    }

    this.playerUnits = [];
    this.enemyUnits = [];

    // Grid aufräumen
    if (this.grid) {
      this.grid.cleanup(this.scene);
    }

    // Beleuchtung entfernen
    if (this.ambientLight) {
      this.scene.remove(this.ambientLight);
      this.ambientLight = null;
    }
    if (this.directionalLight) {
      this.scene.remove(this.directionalLight);
      this.directionalLight = null;
    }

    // UI aufräumen
    if (this.ui) {
      this.ui.cleanup();
    }

    if (AutoBattleController.instance === this) {
      AutoBattleController.instance = null;
      AutoBattleController.listenersAttached = false;
    }
  }

  // ── Planungsphase ──────────────────────────────────────────

  private startPlanningPhase(): void {
    this.round++;
    this.phase = 'planning';
    this.planTimer = 30;

    // Tote Einheiten vom letzten Kampf aufräumen
    this.clearEnemyUnits();

    // Spieler-Einheiten heilen
    for (const u of this.playerUnits) {
      u.hp = u.maxHp;
      u.state = 'idle';
      u.target = null;
    }

    // Einkommen berechnen und Gold hinzufügen
    if (this.round > 1) {
      const income = this.shop.calculateIncome(this.winStreak, this.loseStreak);
      this.shop.addGold(income);
    }

    // Laden auffüllen
    this.shop.refreshShop();

    // XP pro Runde (1 XP gratis)
    if (this.round > 1) {
      this.shop.xp += 1;
      // Level-Up prüfen via buyXP-Trick (0 Gold, nur XP prüfen)
      // Stattdessen: manuell prüfen
      while (this.shop.playerLevel < 8) {
        const needed = AutoBattleShop.XP_PER_LEVEL[this.shop.playerLevel] ?? 999;
        if (this.shop.xp >= needed) {
          this.shop.xp -= needed;
          this.shop.playerLevel++;
          this.shop.xpToLevel = AutoBattleShop.XP_PER_LEVEL[this.shop.playerLevel] ?? 999;
        } else {
          break;
        }
      }
    }

    // Stern-Upgrades prüfen
    this.performStarUpgrades();

    // UI aktualisieren
    this.ui.showPhaseBanner('planning', `Runde ${this.round}`);
    this.uiDirty = true;
  }

  private updatePlanning(dt: number): void {
    this.planTimer -= dt;

    // Timer abgelaufen → Kampf starten
    if (this.planTimer <= 0) {
      this.startCombatPhase();
      return;
    }

    // Nur vollen UI-Rebuild wenn sich Daten geändert haben
    if (this.uiDirty) {
      this.uiDirty = false;
      this.updateAllUI();
    } else {
      // Nur Timer-Anzeige aktualisieren (kein DOM-Rebuild)
      this.ui.updateTimer(this.planTimer);
    }
  }

  // ── Kampfphase ─────────────────────────────────────────────

  private startCombatPhase(): void {
    this.phase = 'combat';
    this.selectedBenchUnitId = null;

    // Gegner für diese Runde generieren
    const waveDef = AutoBattleWaves.generate(this.round);

    // Gegner-Einheiten spawnen
    for (const entry of waveDef.units) {
      const def = UNIT_DEFS[entry.unitId];
      if (!def) continue;

      this.spawnEnemyUnit(entry.unitId, entry.starLevel as 1 | 2 | 3, entry.col, entry.row);
    }

    // Spieler-Einheiten auf Kampfmodus setzen
    for (const u of this.playerUnits) {
      u.state = 'idle';
      u.target = null;
    }

    // UI aktualisieren
    this.ui.showPhaseBanner('combat');
    this.updateAllUI();
  }

  private updateCombat(dt: number): void {
    // Kampf-Update durchführen
    AutoBattleCombat.updateCombat(this.playerUnits, this.enemyUnits, this.grid, dt);

    // Einheiten-Meshes aktualisieren
    for (const u of [...this.playerUnits, ...this.enemyUnits]) {
      u.update(dt);
    }

    // Tote Einheiten entfernen
    this.removeDeadUnits();

    // Kampfende prüfen
    const result = AutoBattleCombat.isCombatOver(this.playerUnits, this.enemyUnits);
    if (result !== 'ongoing') {
      this.startResultPhase(result);
    }

    this.updateAllUI();
  }

  // ── Ergebnisphase ──────────────────────────────────────────

  private startResultPhase(result: 'player_win' | 'enemy_win'): void {
    this.phase = 'result';
    this.resultTimer = 3;

    const won = result === 'player_win';
    let goldEarned = 0;
    let damage = 0;

    if (won) {
      // Sieg-Streak
      this.winStreak++;
      this.loseStreak = 0;

      // Bonus-Gold für Sieg (1 + Runde/5, abgerundet)
      goldEarned = 1 + Math.floor(this.round / 5);
      this.shop.addGold(goldEarned);

      // Kills zählen (alle Gegner dieser Runde)
      this.totalKills += this.enemyUnits.length;

      // Kristalle
      const crystalChance = 0.3 + this.round * 0.02;
      if (Math.random() < crystalChance) {
        this.crystalsEarned += 1;
      }
    } else {
      // Niederlagen-Streak
      this.loseStreak++;
      this.winStreak = 0;

      // Schaden = Anzahl überlebender Gegner (mindestens 1)
      const surviving = this.enemyUnits.filter(u => u.hp > 0);
      damage = Math.max(1, surviving.length);
      this.playerHP -= damage;

      // Auch bei Niederlage etwas Gold
      goldEarned = 1;
      this.shop.addGold(goldEarned);
    }

    // Stern-Upgrades prüfen
    this.performStarUpgrades();

    // UI Ergebnis anzeigen
    this.ui.showResult(won, goldEarned, damage);
    this.ui.showPhaseBanner('result', won ? 'Sieg!' : `${damage} Schaden!`);
    this.updateAllUI();

    // Spiel verloren?
    if (this.playerHP <= 0) {
      this.playerHP = 0;
      this.resultTimer = 2; // Kurz zeigen, dann Game Over
    }
  }

  private updateResult(dt: number): void {
    this.resultTimer -= dt;

    if (this.resultTimer <= 0) {
      this.ui.hideResult();

      // Game Over prüfen
      if (this.playerHP <= 0) {
        this.active = false;
        this.onDefeat?.({
          kills: this.totalKills,
          wavesCompleted: this.round,
          crystalsEarned: this.crystalsEarned,
          extra: {
            überlebteRunden: this.round,
            höchsterLevel: this.shop.playerLevel,
          },
        });
        return;
      }

      // Runde 30+ → Sieg möglich (aber Spiel geht weiter)
      if (this.round >= 30 && this.winStreak > 0) {
        // Optionaler Sieg: könnte hier ein Popup anzeigen
        // Für jetzt: weiter spielen bis man verliert
      }

      // Nächste Planungsphase
      this.startPlanningPhase();
    }
  }

  // ── UI-Callbacks ───────────────────────────────────────────

  private setupUICallbacks(): void {
    this.ui.onBuyUnit = (slotIndex: number) => {
      if (this.phase !== 'planning') return;

      const unit = this.shop.buyUnit(slotIndex);
      if (unit) {
        // Automatisch auf Brett platzieren wenn Platz frei
        if (this.playerUnits.length < this.maxBoardUnits) {
          this.placeBenchUnitOnBoard(unit);
        }
        this.performStarUpgrades();
        this.uiDirty = true;
      }
    };

    this.ui.onSellUnit = (unitId: string) => {
      if (this.phase !== 'planning') return;

      // In Bank suchen
      const benchUnit = this.shop.bench.find(u => u.id === unitId);
      if (benchUnit) {
        this.shop.sellUnit(benchUnit);
        benchUnit.cleanup(this.scene);
        this.uiDirty = true;
        return;
      }

      // Auf Brett suchen
      const boardUnit = this.playerUnits.find(u => u.id === unitId);
      if (boardUnit) {
        this.shop.sellUnit(boardUnit);
        this.grid.removeUnit(boardUnit.gridCol, boardUnit.gridRow);
        boardUnit.cleanup(this.scene);
        const idx = this.playerUnits.indexOf(boardUnit);
        if (idx !== -1) this.playerUnits.splice(idx, 1);
        this.uiDirty = true;
      }
    };

    this.ui.onRefreshShop = () => {
      if (this.phase !== 'planning') return;
      if (this.shop.gold < this.shop.REFRESH_COST) return;

      this.shop.gold -= this.shop.REFRESH_COST;
      this.shop.refreshShop();
      this.uiDirty = true;
    };

    this.ui.onBuyXP = () => {
      if (this.phase !== 'planning') return;

      if (this.shop.buyXP()) {
        this.uiDirty = true;
      }
    };

    this.ui.onStartCombat = () => {
      if (this.phase !== 'planning') return;
      this.startCombatPhase();
    };

    this.ui.onBenchToBoard = (unitId: string) => {
      if (this.phase !== 'planning') return;

      const unit = this.shop.bench.find(u => u.id === unitId);
      if (!unit) return;

      if (this.playerUnits.length >= this.maxBoardUnits) return;

      this.placeBenchUnitOnBoard(unit);
      this.performStarUpgrades();
      this.uiDirty = true;
    };
  }

  // ── Eingabe-Behandlung ─────────────────────────────────────

  private setupInputHandlers(): void {
    if (AutoBattleController.listenersAttached) return;
    AutoBattleController.listenersAttached = true;

    // Klick auf Brett: Einheit platzieren oder auswählen
    document.addEventListener('click', (event: MouseEvent) => {
      AutoBattleController.instance?.handleClick(event);
    });

    // Rechtsklick: Einheit verkaufen
    document.addEventListener('contextmenu', (event: MouseEvent) => {
      AutoBattleController.instance?.handleRightClick(event);
    });
  }

  private handleClick(event: MouseEvent): void {
    if (!this.active || this.phase !== 'planning') return;

    // Mausposition normalisieren
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Boden-Ebene für Schnitt (y=0)
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersection = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(groundPlane, intersection);

    if (!intersection) return;

    // Welt- zu Grid-Koordinaten
    const gridPos = this.grid.worldToGrid(intersection);
    if (!gridPos) return;

    const { col, row } = gridPos;

    // Nur Spielerhälfte (untere Hälfte: Reihe 0-3)
    if (row > 3) return;

    // Prüfen ob eine Einheit auf dieser Zelle steht
    const existingUnit = this.playerUnits.find(
      u => u.gridCol === col && u.gridRow === row
    );

    if (existingUnit) {
      // Einheit zurück auf Bank
      this.moveUnitToBench(existingUnit);
      this.uiDirty = true;
    }
    // Sonst: Zelle ist leer, nichts tun (Platzierung geht über Bank-Klick → onBenchToBoard)
  }

  private handleRightClick(event: MouseEvent): void {
    if (!this.active || this.phase !== 'planning') return;

    // Mausposition normalisieren
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Meshes der Spieler-Einheiten prüfen
    const meshes = this.playerUnits.map(u => u.mesh).filter(Boolean) as THREE.Object3D[];
    const hits = this.raycaster.intersectObjects(meshes, true);

    if (hits.length > 0) {
      event.preventDefault();
      // Oberste getroffene Einheit finden
      const hitObj = hits[0].object;
      const unit = this.playerUnits.find(u => {
        if (!u.mesh) return false;
        let obj: THREE.Object3D | null = hitObj;
        while (obj) {
          if (obj === u.mesh) return true;
          obj = obj.parent;
        }
        return false;
      });

      if (unit) {
        // Verkaufen
        this.grid.removeUnit(unit.gridCol, unit.gridRow);
        const idx = this.playerUnits.indexOf(unit);
        if (idx !== -1) this.playerUnits.splice(idx, 1);
        this.shop.sellUnit(unit);
        unit.cleanup(this.scene);
        this.uiDirty = true;
      }
    }
  }

  // ── Einheiten-Verwaltung ───────────────────────────────────

  private placeBenchUnitOnBoard(unit: AutoBattleUnit): void {
    // Von Bank entfernen
    const benchIdx = this.shop.bench.indexOf(unit);
    if (benchIdx !== -1) {
      this.shop.bench.splice(benchIdx, 1);
    }

    // Freie Zelle auf Spielerhälfte finden (Reihe 0-3)
    const cell = this.grid.findEmptyPlayerCell();
    if (!cell) {
      // Zurück auf Bank wenn kein Platz
      this.shop.bench.push(unit);
      return;
    }

    // Auf Brett platzieren
    unit.gridCol = cell.col;
    unit.gridRow = cell.row;

    const worldPos = this.grid.gridToWorld(cell.col, cell.row);
    unit.mesh.position.set(worldPos.x, 0.5, worldPos.z);

    this.scene.add(unit.mesh);
    this.grid.placeUnit(cell.col, cell.row, unit.id);
    this.playerUnits.push(unit);
  }

  private moveUnitToBench(unit: AutoBattleUnit): void {
    if (this.shop.bench.length >= this.shop.MAX_BENCH) return;

    // Vom Brett entfernen
    this.grid.removeUnit(unit.gridCol, unit.gridRow);
    const idx = this.playerUnits.indexOf(unit);
    if (idx !== -1) this.playerUnits.splice(idx, 1);

    // Mesh aus Szene entfernen
    this.scene.remove(unit.mesh);

    // Auf Bank
    unit.gridCol = -1;
    unit.gridRow = -1;
    this.shop.bench.push(unit);
  }

  private spawnPlayerUnit(
    unitId: string,
    starLevel: 1 | 2 | 3,
    col: number,
    row: number
  ): AutoBattleUnit {
    const def = UNIT_DEFS[unitId];
    if (!def) throw new Error(`Unbekannte Einheit: ${unitId}`);

    const unit = new AutoBattleUnit(def, starLevel, true, col, row);
    const worldPos = this.grid.gridToWorld(col, row);
    unit.mesh.position.set(worldPos.x, 0.5, worldPos.z);

    this.scene.add(unit.mesh);
    this.grid.placeUnit(col, row, unit.id);
    this.playerUnits.push(unit);

    return unit;
  }

  private spawnEnemyUnit(
    unitId: string,
    starLevel: 1 | 2 | 3,
    col: number,
    row: number
  ): AutoBattleUnit {
    const def = UNIT_DEFS[unitId];
    if (!def) throw new Error(`Unbekannte Einheit: ${unitId}`);

    // Skalierung für die aktuelle Runde anwenden
    const scaling = AutoBattleWaves.getRoundScaling(this.round);
    const unit = new AutoBattleUnit(def, starLevel, false, col, row);

    // Stats mit Rundenskalierung multiplizieren
    unit.maxHp = Math.round(unit.maxHp * scaling.hpMult);
    unit.hp = unit.maxHp;
    unit.attack = Math.round(unit.attack * scaling.atkMult);
    unit.defense = Math.round(unit.defense * scaling.defMult);

    const worldPos = this.grid.gridToWorld(col, row);
    unit.mesh.position.set(worldPos.x, 0.5, worldPos.z);

    this.scene.add(unit.mesh);
    this.grid.placeUnit(col, row, unit.id);
    this.enemyUnits.push(unit);

    return unit;
  }

  private removeDeadUnits(): void {
    // Tote Spieler-Einheiten
    const deadPlayers = this.playerUnits.filter(u => u.state === 'dead' || u.hp <= 0);
    for (const u of deadPlayers) {
      this.grid.removeUnit(u.gridCol, u.gridRow);
      u.cleanup(this.scene);
      const idx = this.playerUnits.indexOf(u);
      if (idx !== -1) this.playerUnits.splice(idx, 1);
    }

    // Tote Gegner
    const deadEnemies = this.enemyUnits.filter(u => u.state === 'dead' || u.hp <= 0);
    for (const u of deadEnemies) {
      this.totalKills++;
      this.grid.removeUnit(u.gridCol, u.gridRow);
      u.cleanup(this.scene);
      const idx = this.enemyUnits.indexOf(u);
      if (idx !== -1) this.enemyUnits.splice(idx, 1);
    }
  }

  private clearEnemyUnits(): void {
    for (const u of this.enemyUnits) {
      this.grid.removeUnit(u.gridCol, u.gridRow);
      u.cleanup(this.scene);
    }
    this.enemyUnits = [];
  }

  // ── Stern-Upgrade ──────────────────────────────────────────

  private performStarUpgrades(): void {
    const upgrades = this.shop.checkStarUpgrades(this.playerUnits);
    for (const { upgraded, consumed } of upgrades) {
      // Konsumierte Einheiten vom Brett entfernen
      for (const c of consumed) {
        const boardIdx = this.playerUnits.indexOf(c);
        if (boardIdx !== -1) {
          this.grid.removeUnit(c.gridCol, c.gridRow);
          c.cleanup(this.scene);
          this.playerUnits.splice(boardIdx, 1);
        } else {
          // Bereits aus Bank entfernt durch Shop
          c.cleanup(this.scene);
        }
      }

      // Upgrade-Mesh aktualisieren (Farbe/Größe ändern für höheres Sternlevel)
      if (upgraded.mesh) {
        const scaleFactor = 1 + (upgraded.starLevel - 1) * 0.15;
        upgraded.mesh.scale.setScalar(scaleFactor);
      }
    }
  }

  // ── UI-Hilfsfunktionen ─────────────────────────────────────

  private updateAllUI(): void {
    this.ui.updateUI(
      this.shop,
      this.phase,
      this.round,
      this.playerHP,
      this.playerUnits.length,
      this.maxBoardUnits,
      this.phase === 'planning' ? this.planTimer : undefined
    );
  }
}
