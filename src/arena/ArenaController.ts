// Arena-Controller: Hauptsteuerung für den rundenbasierten Arena-Kampfmodus.
// Implementiert das GameController-Interface und orchestriert Teamauswahl, Kampf,
// Encounter-Karte, Laden und Rast.

import * as THREE from 'three';
import { GameController, ModeStats } from '../game/GameController';
import { LevelDef } from '../systems/LevelConfig';
import { RunModifiers } from '../systems/RunManager';
import { ArenaUnit } from './ArenaUnit';
import { ArenaCombatEngine, TurnResult } from './ArenaCombatEngine';
import { ArenaUI, ArenaPhase } from './ArenaUI';
import { ArenaEncounterMap, MapNode, EncounterType } from './ArenaEncounterMap';
import { UNIT_DEFS, getUnitDef, UnitDef, UNIT_TIER_POOLS } from '../units/UnitConfig';
import { UnitMeshFactory } from '../units/UnitMeshFactory';
import { createActiveAbilities } from './ArenaAbility';

export class ArenaController implements GameController {
  onVictory: ((stats: ModeStats) => void) | null = null;
  onDefeat: ((stats: ModeStats) => void) | null = null;

  private declare scene: THREE.Scene;
  private declare camera: THREE.PerspectiveCamera;
  private declare ui: ArenaUI;
  private declare encounterMap: ArenaEncounterMap;
  private combatEngine: ArenaCombatEngine | null = null;

  private playerTeam: ArenaUnit[] = [];
  private enemyTeam: ArenaUnit[] = [];
  private selectedUnitIds: string[] = [];

  private phase: ArenaPhase = 'team_select';
  private totalKills = 0;
  private totalFights = 0;
  private crystalsEarned = 0;
  private difficulty = 1;

  // Kampfanimations-Timing
  private turnDelay = 0;
  private waitingForPlayerInput = false;
  private pendingResult: TurnResult | null = null;
  private animationTimer = 0;

  // Beleuchtung
  private ambientLight: THREE.AmbientLight | null = null;
  private directionalLight: THREE.DirectionalLight | null = null;

  // Arena-Boden
  private groundMesh: THREE.Mesh | null = null;

  // Level-Daten
  private declare level: LevelDef;
  private declare modifiers: RunModifiers;

  // Statisches Instanz-Pattern
  private static instance: ArenaController | null = null;

  // Ausstehende F\u00e4higkeitsauswahl
  private pendingAbilityIndex = -1;

  init(level: LevelDef, modifiers: RunModifiers, scene: THREE.Scene, camera: THREE.PerspectiveCamera): void {
    ArenaController.instance = this;

    this.scene = scene;
    this.camera = camera;
    this.level = level;
    this.modifiers = modifiers;

    // Kamera: Seitenansicht der Arena
    this.camera.position.set(0, 8, 12);
    this.camera.lookAt(0, 2, 0);

    // Szene: Dunkler Hintergrund
    this.scene.background = new THREE.Color(0x0a0a20);
    this.scene.fog = new THREE.FogExp2(0x0a0a20, 0.02);

    // Beleuchtung
    this.ambientLight = new THREE.AmbientLight(0x6644aa, 0.5);
    this.scene.add(this.ambientLight);

    this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    this.directionalLight.position.set(5, 10, 5);
    this.directionalLight.castShadow = true;
    this.scene.add(this.directionalLight);

    // Arena-Boden
    this.createGroundPlane();

    // UI erstellen
    this.ui = new ArenaUI();

    // Encounter-Karte erstellen
    this.encounterMap = new ArenaEncounterMap();
    this.encounterMap.onNodeSelect = (node: MapNode) => {
      ArenaController.instance?.handleNodeSelect(node);
    };

    // Schwierigkeit aus Level ableiten
    this.difficulty = Math.max(1, Math.floor(level.id / 2));

    // UI-Callbacks verbinden
    this.ui.onTeamConfirm = (unitIds: string[]) => {
      ArenaController.instance?.handleTeamConfirm(unitIds);
    };
    this.ui.onAbilitySelect = (abilityIndex: number) => {
      ArenaController.instance?.handleAbilitySelect(abilityIndex);
    };
    this.ui.onTargetSelect = (targetIndex: number) => {
      ArenaController.instance?.handleTargetSelect(targetIndex);
    };
    this.ui.onContinue = () => {
      ArenaController.instance?.handleContinue();
    };
  }

  start(): void {
    this.ui.show();
    this.startTeamSelect();
  }

  stop(): void {
    this.ui.hide();
  }

  update(dt: number): void {
    switch (this.phase) {
      case 'team_select':
        break; // UI-gesteuert
      case 'combat':
        this.updateCombat(dt);
        break;
      case 'map':
        break; // UI-gesteuert
      case 'shop':
        break; // UI-gesteuert
      case 'rest':
        break; // UI-gesteuert
      case 'result':
        break; // UI-gesteuert
    }
  }

  cleanup(): void {
    // Alle Einheiten-Meshes entfernen
    this.clearCombatMeshes();

    // Beleuchtung entfernen
    if (this.ambientLight) {
      this.scene.remove(this.ambientLight);
      this.ambientLight = null;
    }
    if (this.directionalLight) {
      this.scene.remove(this.directionalLight);
      this.directionalLight = null;
    }

    // Boden entfernen
    if (this.groundMesh) {
      this.scene.remove(this.groundMesh);
      if (this.groundMesh.geometry) this.groundMesh.geometry.dispose();
      if (this.groundMesh.material) {
        const mat = this.groundMesh.material;
        if (Array.isArray(mat)) {
          mat.forEach(m => m.dispose());
        } else {
          mat.dispose();
        }
      }
      this.groundMesh = null;
    }

    // Encounter-Karte aufr\u00e4umen
    if (this.encounterMap) {
      this.encounterMap.hide();
    }

    // UI aufr\u00e4umen
    if (this.ui) {
      this.ui.cleanup();
    }

    // Referenzen aufr\u00e4umen
    this.playerTeam = [];
    this.enemyTeam = [];
    this.combatEngine = null;

    if (ArenaController.instance === this) {
      ArenaController.instance = null;
    }
  }

  // ── Arena-Boden ─────────────────────────────────────────

  private createGroundPlane(): void {
    // Prozedurale Textur f\u00fcr dunklen Steinboden
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Basis-Farbe
    ctx.fillStyle = '#1a1525';
    ctx.fillRect(0, 0, 256, 256);

    // Steinmuster
    for (let i = 0; i < 600; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const size = 1 + Math.random() * 3;
      const brightness = 15 + Math.random() * 25;
      ctx.fillStyle = `rgb(${brightness}, ${brightness * 0.8}, ${brightness * 1.2})`;
      ctx.fillRect(x, y, size, size);
    }

    // Risse / Fugen
    ctx.strokeStyle = 'rgba(10,8,18,0.6)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      const startX = Math.random() * 256;
      const startY = Math.random() * 256;
      ctx.moveTo(startX, startY);
      for (let j = 0; j < 4; j++) {
        ctx.lineTo(
          startX + (Math.random() - 0.5) * 80,
          startY + (Math.random() - 0.5) * 80
        );
      }
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 4);

    const groundGeo = new THREE.PlaneGeometry(20, 14);
    const groundMat = new THREE.MeshLambertMaterial({
      map: texture,
      color: 0x221830,
    });
    this.groundMesh = new THREE.Mesh(groundGeo, groundMat);
    this.groundMesh.rotation.x = -Math.PI / 2;
    this.groundMesh.position.y = -0.01;
    this.groundMesh.receiveShadow = true;
    this.scene.add(this.groundMesh);
  }

  // ── Teamauswahl ─────────────────────────────────────────

  private startTeamSelect(): void {
    this.phase = 'team_select';
    const available = Object.values(UNIT_DEFS);
    this.ui.showTeamSelect(available);
  }

  private handleTeamConfirm(unitIds: string[]): void {
    this.selectedUnitIds = unitIds;

    // Spieler-Einheiten erstellen
    this.playerTeam = [];
    for (let i = 0; i < unitIds.length; i++) {
      const def = getUnitDef(unitIds[i]);
      const unit = new ArenaUnit(def, true, i);
      this.playerTeam.push(unit);
    }

    // Encounter-Karte generieren
    this.encounterMap.generate(this.difficulty);

    // Zur Karte wechseln
    this.showMap();
  }

  // ── Kampf ──────────────────────────────────────────────

  private startCombat(encounterType: EncounterType): void {
    this.phase = 'combat';
    this.waitingForPlayerInput = false;
    this.pendingResult = null;
    this.animationTimer = 0;
    this.pendingAbilityIndex = -1;

    // Gegner-Team generieren
    const enemyDefs = this.generateEnemyTeam(encounterType);
    this.enemyTeam = [];
    for (let i = 0; i < enemyDefs.length; i++) {
      const def = enemyDefs[i];
      const unit = new ArenaUnit(def, false, i);

      // Skalierung basierend auf Schwierigkeit
      const statMult = 1 + (this.difficulty - 1) * 0.15;
      const eliteMult = encounterType === 'elite' ? 1.3 : 1.0;
      const bossMult = encounterType === 'boss' ? 1.0 : 1.0; // Boss-Logik unten

      if (encounterType === 'boss' && i === 0) {
        // Erster Gegner im Boss-Kampf ist der Boss
        unit.maxHp = Math.floor(unit.maxHp * statMult * 2.5);
        unit.hp = unit.maxHp;
        unit.baseAttack = Math.floor(unit.baseAttack * statMult * 1.5);
        unit.baseDefense = Math.floor(unit.baseDefense * statMult * 1.3);
      } else {
        unit.maxHp = Math.floor(unit.maxHp * statMult * eliteMult);
        unit.hp = unit.maxHp;
        unit.baseAttack = Math.floor(unit.baseAttack * statMult * eliteMult);
        unit.baseDefense = Math.floor(unit.baseDefense * statMult * eliteMult);
      }

      this.enemyTeam.push(unit);
    }

    // LP der Spieler-Einheiten aktualisieren (nicht zurücksetzen, persistent!)
    // Aber Cooldowns zurücksetzen
    for (const unit of this.playerTeam) {
      for (const ability of unit.abilities) {
        ability.currentCooldown = 0;
      }
      // MP auffüllen
      unit.mp = unit.maxMp;
      // Statuseffekte entfernen
      unit.statusEffects = [];
    }

    // Meshes in Szene platzieren
    this.placeTeamMeshes();

    // Kampfengine erstellen
    this.combatEngine = new ArenaCombatEngine(this.playerTeam, this.enemyTeam);
    this.combatEngine.calculateTurnOrder();

    // Kampfnummer aktualisieren
    this.totalFights++;
    this.ui.setFightInfo(this.totalFights, 7);
    this.ui.setCrystals(this.crystalsEarned);

    // Kampf-UI anzeigen
    this.ui.showCombat(this.playerTeam, this.enemyTeam);
    this.ui.addLogEntry('--- Neuer Kampf ---', '#cc88ff');

    if (encounterType === 'boss') {
      this.ui.addLogEntry('BOSS-KAMPF!', '#ff4444');
    } else if (encounterType === 'elite') {
      this.ui.addLogEntry('Elite-Kampf!', '#ffaa44');
    }
  }

  private updateCombat(dt: number): void {
    if (!this.combatEngine) return;

    // Animationstimer
    if (this.animationTimer > 0) {
      this.animationTimer -= dt;
      return;
    }

    // Auf Spielereingabe warten
    if (this.waitingForPlayerInput) return;

    // Ausstehende Ergebnisse anzeigen
    if (this.pendingResult) {
      this.ui.showTurnResult(this.pendingResult);
      this.ui.updateCombat(this.playerTeam, this.enemyTeam,
        this.combatEngine.getCurrentUnit(), this.combatEngine.isPlayerTurn());
      this.pendingResult = null;
      this.animationTimer = 0.8;
      return;
    }

    // Kampfende prüfen
    const result = this.combatEngine.checkBattleEnd();
    if (result !== 'ongoing') {
      this.endCombat(result === 'player_win');
      return;
    }

    // Rundenende prüfen
    if (this.combatEngine.isRoundOver()) {
      this.combatEngine.newRound();
      this.ui.addLogEntry(
        `--- Runde ${this.combatEngine.getRoundNumber()} ---`,
        '#888'
      );
    }

    const currentUnit = this.combatEngine.getCurrentUnit();
    if (!currentUnit || !currentUnit.alive) {
      this.combatEngine.nextTurn();
      return;
    }

    // Zuganfangseffekte anwenden
    const effects = currentUnit.applyTurnStartEffects();
    for (const eff of effects) {
      if (eff.damage > 0) {
        this.ui.addLogEntry(
          `${currentUnit.def.name}: ${eff.text} (${eff.damage} Schaden)`,
          '#ff8866'
        );
      }
      if (eff.healing > 0) {
        this.ui.addLogEntry(
          `${currentUnit.def.name}: ${eff.text} (+${eff.healing} LP)`,
          '#44dd66'
        );
      }
    }

    // Prüfe ob Einheit nach Zuganfangseffekten noch lebt
    if (!currentUnit.alive) {
      this.ui.addLogEntry(`${currentUnit.def.name} wurde durch Statuseffekte besiegt!`, '#ff4444');
      this.combatEngine.nextTurn();
      this.animationTimer = 0.5;
      return;
    }

    // Betäubung pr\u00fcfen
    if (currentUnit.isStunned()) {
      this.ui.addLogEntry(`${currentUnit.def.name} ist bet\u00e4ubt!`, '#ffcc00');
      this.combatEngine.nextTurn();
      this.animationTimer = 0.5;
      return;
    }

    // MP regenerieren
    currentUnit.regenMp();

    if (this.combatEngine.isPlayerTurn()) {
      // Spielerzug: F\u00e4higkeitenauswahl anzeigen
      this.waitingForPlayerInput = true;
      this.ui.updateCombat(this.playerTeam, this.enemyTeam, currentUnit, true);
      this.ui.showAbilityPanel(currentUnit);
    } else {
      // Gegnerzug: KI w\u00e4hlt Aktion
      const aiResult = this.combatEngine.executeEnemyAI();
      this.pendingResult = aiResult;

      // Kill-Z\u00e4hler
      this.totalKills += aiResult.killedUnits.length;

      this.combatEngine.nextTurn();
      this.animationTimer = 0.3;
    }
  }

  private endCombat(playerWon: boolean): void {
    // Kampf-Meshes aufr\u00e4umen
    this.clearCombatMeshes();
    this.combatEngine = null;

    if (playerWon) {
      // Belohnung: Kristalle
      const reward = 10 + this.difficulty * 2;
      this.crystalsEarned += reward;
      this.ui.setCrystals(this.crystalsEarned);

      // Boss-Sieg pr\u00fcfen
      if (this.encounterMap.isBossReached()) {
        // Arena-Lauf beendet!
        this.phase = 'result';
        this.ui.showBattleResult(true, reward);
        // Finale Statistiken werden bei "Weiter" gesendet
        return;
      }

      this.phase = 'result';
      this.ui.showBattleResult(true, reward);
    } else {
      // Niederlage
      this.phase = 'result';
      this.ui.showBattleResult(false, 0);
    }
  }

  // ── Karte / Laden / Rast ───────────────────────────────

  private showMap(): void {
    this.phase = 'map';
    this.ui.hide();
    this.ui.show();
    this.encounterMap.show();
  }

  private handleNodeSelect(node: MapNode): void {
    this.encounterMap.completeNode(node.id);
    this.encounterMap.hide();

    switch (node.type) {
      case 'kampf':
      case 'elite':
      case 'boss':
        this.startCombat(node.type);
        break;
      case 'laden':
        this.showShop();
        break;
      case 'rast':
        this.showRest();
        break;
    }
  }

  private showShop(): void {
    this.phase = 'shop';
    this.ui.setCrystals(this.crystalsEarned);
    this.ui.showShopScreen(this.playerTeam);
  }

  private showRest(): void {
    this.phase = 'rest';
    // Alle Einheiten um 50% der fehlenden LP heilen
    for (const unit of this.playerTeam) {
      if (unit.alive) {
        const missing = unit.maxHp - unit.hp;
        unit.heal(Math.floor(missing * 0.5));
      }
    }
    this.ui.showRestScreen(this.playerTeam);
  }

  private handleContinue(): void {
    // Je nach aktueller Phase weiter
    if (this.phase === 'result') {
      // Pr\u00fcfe ob Boss besiegt → Sieg
      if (this.encounterMap.isBossReached()) {
        this.onVictory?.({
          kills: this.totalKills,
          wavesCompleted: this.totalFights,
          crystalsEarned: this.crystalsEarned,
          extra: { 'Schwierigkeit': this.difficulty },
        });
        return;
      }

      // Pr\u00fcfe ob Niederlage
      const allDead = this.playerTeam.every(u => !u.alive);
      if (allDead) {
        this.onDefeat?.({
          kills: this.totalKills,
          wavesCompleted: this.totalFights,
          crystalsEarned: this.crystalsEarned,
          extra: { 'Schwierigkeit': this.difficulty },
        });
        return;
      }

      // Weiter zur Karte
      this.showMap();
    } else if (this.phase === 'shop' || this.phase === 'rest') {
      // Kristalle aktualisieren (falls im Laden ausgegeben)
      this.showMap();
    }
  }

  // ── Gegner-Generierung ─────────────────────────────────

  private generateEnemyTeam(encounterType: EncounterType): UnitDef[] {
    const enemies: UnitDef[] = [];

    // Tier-Auswahl basierend auf Schwierigkeit
    const availableTiers: (1 | 2 | 3 | 4)[] = [1, 2];
    if (this.difficulty >= 2) availableTiers.push(3);
    if (this.difficulty >= 4) availableTiers.push(4);

    if (encounterType === 'boss') {
      // Boss: 1 starker Gegner + 2-3 Unterst\u00fctzung
      // Boss aus hoher Stufe
      const bossTier = availableTiers[availableTiers.length - 1];
      const bossPool = UNIT_TIER_POOLS[bossTier];
      const bossId = bossPool[Math.floor(Math.random() * bossPool.length)];
      enemies.push(getUnitDef(bossId));

      // 2-3 Support-Gegner
      const supportCount = 2 + (this.difficulty >= 3 ? 1 : 0);
      for (let i = 0; i < supportCount; i++) {
        const tier = availableTiers[Math.floor(Math.random() * availableTiers.length)];
        const pool = UNIT_TIER_POOLS[tier];
        const unitId = pool[Math.floor(Math.random() * pool.length)];
        enemies.push(getUnitDef(unitId));
      }
    } else if (encounterType === 'elite') {
      // Elite: 3-4 stärkere Gegner, bevorzugt höhere Stufen
      const count = 3 + (this.difficulty >= 3 ? 1 : 0);
      const eliteTiers = availableTiers.slice(-2); // Nur h\u00f6chste Stufen
      for (let i = 0; i < count; i++) {
        const tier = eliteTiers[Math.floor(Math.random() * eliteTiers.length)];
        const pool = UNIT_TIER_POOLS[tier];
        const unitId = pool[Math.floor(Math.random() * pool.length)];
        enemies.push(getUnitDef(unitId));
      }
    } else {
      // Normal: 3-4 zuf\u00e4llige Gegner
      const count = 3 + (Math.random() < 0.4 ? 1 : 0);
      for (let i = 0; i < count; i++) {
        const tier = availableTiers[Math.floor(Math.random() * availableTiers.length)];
        const pool = UNIT_TIER_POOLS[tier];
        const unitId = pool[Math.floor(Math.random() * pool.length)];
        enemies.push(getUnitDef(unitId));
      }
    }

    return enemies;
  }

  // ── Spieler-Eingabe ────────────────────────────────────

  private handleAbilitySelect(abilityIndex: number): void {
    if (!this.combatEngine || !this.waitingForPlayerInput) return;

    const currentUnit = this.combatEngine.getCurrentUnit();
    if (!currentUnit || !currentUnit.isPlayer) return;

    // Pr\u00fcfe ob F\u00e4higkeit nutzbar
    if (abilityIndex < 0 || abilityIndex >= currentUnit.abilities.length) return;
    const active = currentUnit.abilities[abilityIndex];
    if (currentUnit.mp < active.def.mpCost || active.currentCooldown > 0) return;

    this.pendingAbilityIndex = abilityIndex;

    // G\u00fcltige Ziele ermitteln
    const targets = this.combatEngine.getValidTargets(active.def, currentUnit);
    if (targets.length === 0) {
      this.ui.addLogEntry('Keine g\u00fcltigen Ziele!', '#ff6666');
      return;
    }

    // Bei Selbst-Ziel oder Alle-Ziel direkt ausf\u00fchren
    if (active.def.targetType === 'self') {
      this.executePlayerAction(abilityIndex, [currentUnit.position]);
      return;
    }

    if (active.def.targetType === 'all_enemies' || active.def.targetType === 'all_allies') {
      const indices = targets.map(t => t.position);
      this.executePlayerAction(abilityIndex, indices);
      return;
    }

    // Einzelziel: Zielauswahl anzeigen
    this.ui.showTargetSelection(targets, active.def.targetType);
  }

  private handleTargetSelect(targetIndex: number): void {
    if (!this.combatEngine || !this.waitingForPlayerInput) return;
    if (this.pendingAbilityIndex < 0) return;

    this.ui.clearTargetHighlights();
    this.executePlayerAction(this.pendingAbilityIndex, [targetIndex]);
  }

  private executePlayerAction(abilityIndex: number, targetIndices: number[]): void {
    if (!this.combatEngine) return;

    this.waitingForPlayerInput = false;
    this.ui.hideAbilityPanel();
    this.ui.clearTargetHighlights();

    const result = this.combatEngine.executeAction(abilityIndex, targetIndices);

    // Kill-Z\u00e4hler
    this.totalKills += result.killedUnits.length;

    this.pendingResult = result;
    this.combatEngine.nextTurn();
    this.pendingAbilityIndex = -1;
    this.animationTimer = 0.3;
  }

  // ── Einheiten-Mesh-Platzierung ─────────────────────────

  private placeTeamMeshes(): void {
    // Spieler links (x = -6 bis -3), zum Gegner schauend
    for (let i = 0; i < this.playerTeam.length; i++) {
      const unit = this.playerTeam[i];
      const x = -5 + i * 1.2;
      const z = (i % 2 === 0) ? 0 : 0.8;
      unit.mesh.position.set(x, 0, z);
      unit.mesh.rotation.y = Math.PI / 4; // Richtung Gegner schauen
      this.scene.add(unit.mesh);
    }

    // Gegner rechts (x = 3 bis 6), zum Spieler schauend (180\u00b0 gedreht)
    for (let i = 0; i < this.enemyTeam.length; i++) {
      const unit = this.enemyTeam[i];
      const x = 5 - i * 1.2;
      const z = (i % 2 === 0) ? 0 : 0.8;
      unit.mesh.position.set(x, 0, z);
      unit.mesh.rotation.y = -Math.PI / 4 + Math.PI; // Richtung Spieler schauen
      this.scene.add(unit.mesh);
    }
  }

  private clearCombatMeshes(): void {
    // Gegner-Einheiten aufr\u00e4umen
    for (const unit of this.enemyTeam) {
      unit.cleanup(this.scene);
    }
    this.enemyTeam = [];

    // Spieler-Meshes aus der Szene entfernen (aber nicht zerst\u00f6ren, Team bleibt bestehen)
    for (const unit of this.playerTeam) {
      if (unit.mesh.parent === this.scene) {
        this.scene.remove(unit.mesh);
      }
    }
  }
}
