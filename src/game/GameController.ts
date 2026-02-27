import * as THREE from 'three';
import { LevelDef } from '../systems/LevelConfig';
import { RunModifiers } from '../systems/RunManager';

/**
 * Gemeinsames Interface für alle Spielmodi-Controller.
 * Jeder Modus (TD, Auto-Kampf, Arena) implementiert dieses Interface.
 */
export interface GameController {
  /** Initialisiert den Modus mit Level-Definition und Run-Modifikatoren */
  init(level: LevelDef, modifiers: RunModifiers, scene: THREE.Scene, camera: THREE.PerspectiveCamera): void;

  /** Startet den Modus (beginnt Game-Loop) */
  start(): void;

  /** Stoppt den Modus (pausiert Game-Loop) */
  stop(): void;

  /** Haupt-Update pro Frame */
  update(dt: number): void;

  /** Räumt alle Ressourcen auf (Scene-Objekte, UI, Event-Listener) */
  cleanup(): void;

  /** Callback: Spieler hat gewonnen */
  onVictory: ((stats: ModeStats) => void) | null;

  /** Callback: Spieler hat verloren */
  onDefeat: ((stats: ModeStats) => void) | null;
}

/** Statistiken die jeder Modus nach Ende zurückgibt */
export interface ModeStats {
  kills: number;
  wavesCompleted: number;
  crystalsEarned: number;
  /** Zusätzliche modusspezifische Stats */
  extra?: Record<string, string | number>;
}
