// Prozedurale 3D-Mesh-Fabrik für Einheiten
// Erstellt Low-Poly humanoidale Meshes basierend auf Rolle und Element

import * as THREE from 'three';
import { UnitDef } from './UnitConfig';

// ─── Farbhilfen ─────────────────────────────────────────────────────────────

function lightenColor(color: number, amount: number): number {
  const r = Math.min(255, ((color >> 16) & 0xff) + Math.round(amount * 255));
  const g = Math.min(255, ((color >> 8) & 0xff) + Math.round(amount * 255));
  const b = Math.min(255, (color & 0xff) + Math.round(amount * 255));
  return (r << 16) | (g << 8) | b;
}

function darkenColor(color: number, amount: number): number {
  const r = Math.max(0, ((color >> 16) & 0xff) - Math.round(amount * 255));
  const g = Math.max(0, ((color >> 8) & 0xff) - Math.round(amount * 255));
  const b = Math.max(0, (color & 0xff) - Math.round(amount * 255));
  return (r << 16) | (g << 8) | b;
}

// ─── HP-Balken ──────────────────────────────────────────────────────────────

export interface HpBarComponents {
  container: THREE.Group;
  bar: THREE.Mesh;
  update: (ratio: number) => void;
}

// ─── Mesh-Fabrik ────────────────────────────────────────────────────────────

export class UnitMeshFactory {
  /**
   * Erstellt das vollständige 3D-Mesh einer Einheit.
   * Enthält Körper, Kopf, Waffe/Accessoire basierend auf Rolle,
   * HP-Balken und Stern-Dekorationen.
   */
  static createUnitMesh(def: UnitDef, starLevel: 1 | 2 | 3 = 1): THREE.Group {
    const group = new THREE.Group();
    group.name = `unit_${def.id}`;

    const bodyColor = def.color;
    const headColor = lightenColor(bodyColor, 0.15);
    const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
    const headMat = new THREE.MeshLambertMaterial({ color: headColor });
    const darkMat = new THREE.MeshLambertMaterial({ color: darkenColor(bodyColor, 0.2) });

    // ─── Körper ─────────────────────────────────────
    const bodyWidth = def.role === 'tank' ? 0.45 : 0.3;
    const bodyHeight = 0.5;
    const bodyDepth = def.role === 'tank' ? 0.35 : 0.2;
    const bodyGeo = new THREE.BoxGeometry(bodyWidth, bodyHeight, bodyDepth);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.4;
    body.castShadow = true;
    group.add(body);

    // ─── Kopf ───────────────────────────────────────
    const headRadius = def.role === 'tank' ? 0.14 : 0.12;
    const headGeo = new THREE.SphereGeometry(headRadius, 6, 5);
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 0.8;
    head.castShadow = true;
    group.add(head);

    // ─── Beine ──────────────────────────────────────
    const legGeo = new THREE.BoxGeometry(0.08, 0.25, 0.1);
    const leftLeg = new THREE.Mesh(legGeo, darkMat);
    leftLeg.position.set(-0.08, 0.12, 0);
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, darkMat);
    rightLeg.position.set(0.08, 0.12, 0);
    group.add(rightLeg);

    // ─── Waffe / Accessoire basierend auf Rolle ─────
    UnitMeshFactory.addRoleAccessory(group, def, bodyMat, darkMat);

    // ─── HP-Balken ──────────────────────────────────
    const hpBar = UnitMeshFactory.createHpBar();
    hpBar.container.position.y = 1.05;
    group.add(hpBar.container);

    // ─── Stern-Dekorationen ─────────────────────────
    if (starLevel === 2 || starLevel === 3) {
      UnitMeshFactory.addStarRing(group, starLevel);
    }

    // ─── Stern-Skalierung ───────────────────────────
    switch (starLevel) {
      case 2:
        group.scale.setScalar(1.15);
        break;
      case 3:
        group.scale.setScalar(1.3);
        break;
    }

    return group;
  }

  /**
   * Fügt rollenspezifische Waffen und Accessoires hinzu.
   */
  private static addRoleAccessory(
    group: THREE.Group,
    def: UnitDef,
    bodyMat: THREE.MeshLambertMaterial,
    darkMat: THREE.MeshLambertMaterial
  ): void {
    switch (def.role) {
      case 'dps_ranged':
        UnitMeshFactory.addRangedWeapon(group, def, darkMat);
        break;
      case 'dps_melee':
        UnitMeshFactory.addMeleeWeapon(group, def);
        break;
      case 'tank':
        UnitMeshFactory.addTankShield(group, def);
        break;
      case 'support':
        UnitMeshFactory.addSupportStaff(group, def);
        break;
      case 'specialist':
        UnitMeshFactory.addSpecialistAccessory(group, def, bodyMat);
        break;
    }
  }

  /**
   * Fernkampf-Waffen: Bogen, Stab, Gewehr je nach Einheit.
   */
  private static addRangedWeapon(
    group: THREE.Group,
    def: UnitDef,
    darkMat: THREE.MeshLambertMaterial
  ): void {
    const weaponColor = lightenColor(def.color, 0.1);
    const weaponMat = new THREE.MeshLambertMaterial({ color: weaponColor });

    if (def.id === 'archer') {
      // Bogen
      const bowGeo = new THREE.TorusGeometry(0.15, 0.015, 4, 8, Math.PI);
      const bow = new THREE.Mesh(bowGeo, darkMat);
      bow.position.set(-0.25, 0.5, 0);
      bow.rotation.z = Math.PI / 2;
      group.add(bow);
      // Bogensehne
      const stringGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.3, 3);
      const stringMat = new THREE.MeshLambertMaterial({ color: 0xccccaa });
      const bowString = new THREE.Mesh(stringGeo, stringMat);
      bowString.position.set(-0.25, 0.5, 0);
      group.add(bowString);
    } else if (def.id === 'sniper') {
      // Scharfschützengewehr
      const barrelGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6);
      const barrel = new THREE.Mesh(barrelGeo, darkMat);
      barrel.position.set(0.2, 0.45, 0.15);
      barrel.rotation.x = Math.PI / 6;
      group.add(barrel);
      // Zielfernrohr
      const scopeGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.12, 6);
      const scope = new THREE.Mesh(scopeGeo, weaponMat);
      scope.position.set(0.2, 0.52, 0.08);
      scope.rotation.x = Math.PI / 6;
      group.add(scope);
    } else if (def.id === 'cannoneer') {
      // Kanone
      const cannonGeo = new THREE.CylinderGeometry(0.04, 0.06, 0.35, 6);
      const cannon = new THREE.Mesh(cannonGeo, darkMat);
      cannon.position.set(0.22, 0.4, 0.1);
      cannon.rotation.x = Math.PI / 8;
      cannon.rotation.z = -Math.PI / 12;
      group.add(cannon);
    } else if (def.id === 'mortar') {
      // Mörserrohr auf dem Rücken
      const tubeGeo = new THREE.CylinderGeometry(0.05, 0.07, 0.3, 6);
      const tube = new THREE.Mesh(tubeGeo, darkMat);
      tube.position.set(0, 0.55, -0.15);
      tube.rotation.x = -Math.PI / 4;
      group.add(tube);
    } else {
      // Standard-Stab für Magier-Typen
      const staffGeo = new THREE.CylinderGeometry(0.015, 0.02, 0.6, 5);
      const staff = new THREE.Mesh(staffGeo, darkMat);
      staff.position.set(0.22, 0.5, 0);
      group.add(staff);
      // Leuchtende Spitze
      const orbGeo = new THREE.SphereGeometry(0.05, 5, 4);
      const orbMat = new THREE.MeshLambertMaterial({
        color: def.color,
        emissive: def.color,
        emissiveIntensity: 0.5,
      });
      const orb = new THREE.Mesh(orbGeo, orbMat);
      orb.position.set(0.22, 0.82, 0);
      group.add(orb);
    }
  }

  /**
   * Nahkampf-Waffen: Schwert/Axt für melee DPS.
   */
  private static addMeleeWeapon(group: THREE.Group, def: UnitDef): void {
    if (def.id === 'pyro') {
      // Flammenwerfer-Düse
      const nozzleGeo = new THREE.CylinderGeometry(0.03, 0.05, 0.3, 6);
      const nozzleMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
      const nozzle = new THREE.Mesh(nozzleGeo, nozzleMat);
      nozzle.position.set(0.22, 0.4, 0.15);
      nozzle.rotation.x = Math.PI / 4;
      group.add(nozzle);
      // Flammen-Partikel (statisch, kleine Kugeln)
      const flameMat = new THREE.MeshLambertMaterial({
        color: 0xff4400,
        emissive: 0xff2200,
        emissiveIntensity: 0.6,
      });
      for (let i = 0; i < 3; i++) {
        const flameGeo = new THREE.SphereGeometry(0.03 - i * 0.005, 4, 3);
        const flame = new THREE.Mesh(flameGeo, flameMat);
        flame.position.set(0.22, 0.4 + i * 0.04, 0.3 + i * 0.06);
        group.add(flame);
      }
    } else if (def.id === 'earth_shaker') {
      // Großer Hammer
      const handleGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.5, 5);
      const handleMat = new THREE.MeshLambertMaterial({ color: 0x664422 });
      const handle = new THREE.Mesh(handleGeo, handleMat);
      handle.position.set(0.25, 0.45, 0);
      handle.rotation.z = -Math.PI / 6;
      group.add(handle);
      // Hammerkopf
      const hammerHeadGeo = new THREE.BoxGeometry(0.12, 0.08, 0.12);
      const hammerHeadMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
      const hammerHead = new THREE.Mesh(hammerHeadGeo, hammerHeadMat);
      hammerHead.position.set(0.35, 0.7, 0);
      group.add(hammerHead);
    } else {
      // Standard-Schwert
      const bladeGeo = new THREE.BoxGeometry(0.04, 0.35, 0.015);
      const bladeMat = new THREE.MeshLambertMaterial({ color: 0xcccccc });
      const blade = new THREE.Mesh(bladeGeo, bladeMat);
      blade.position.set(0.22, 0.55, 0.05);
      blade.rotation.z = -Math.PI / 8;
      group.add(blade);
      // Griff
      const hiltGeo = new THREE.BoxGeometry(0.06, 0.03, 0.03);
      const hiltMat = new THREE.MeshLambertMaterial({ color: 0x884422 });
      const hilt = new THREE.Mesh(hiltGeo, hiltMat);
      hilt.position.set(0.22, 0.38, 0.05);
      group.add(hilt);
    }
  }

  /**
   * Tank-Schild: Breiter Körper + Schild.
   */
  private static addTankShield(group: THREE.Group, def: UnitDef): void {
    // Großer Schild vor dem Körper
    const shieldGeo = new THREE.BoxGeometry(0.35, 0.4, 0.04);
    const shieldMat = new THREE.MeshLambertMaterial({
      color: lightenColor(def.color, 0.1),
    });
    const shield = new THREE.Mesh(shieldGeo, shieldMat);
    shield.position.set(-0.2, 0.4, 0.15);
    shield.castShadow = true;
    group.add(shield);
    // Schildbuckel
    const bossGeo = new THREE.SphereGeometry(0.04, 5, 4);
    const bossMat = new THREE.MeshLambertMaterial({ color: 0xcccccc });
    const boss = new THREE.Mesh(bossGeo, bossMat);
    boss.position.set(-0.2, 0.4, 0.18);
    group.add(boss);
  }

  /**
   * Support-Stab: Stab mit leuchtender Spitze.
   */
  private static addSupportStaff(group: THREE.Group, def: UnitDef): void {
    const staffColor = darkenColor(def.color, 0.15);
    const staffMat = new THREE.MeshLambertMaterial({ color: staffColor });

    // Stab
    const staffGeo = new THREE.CylinderGeometry(0.015, 0.02, 0.7, 5);
    const staff = new THREE.Mesh(staffGeo, staffMat);
    staff.position.set(0.22, 0.5, 0);
    group.add(staff);

    // Leuchtender Kristall an der Spitze
    const crystalGeo = new THREE.OctahedronGeometry(0.06, 0);
    const crystalMat = new THREE.MeshLambertMaterial({
      color: def.color,
      emissive: def.color,
      emissiveIntensity: 0.7,
      transparent: true,
      opacity: 0.85,
    });
    const crystal = new THREE.Mesh(crystalGeo, crystalMat);
    crystal.position.set(0.22, 0.88, 0);
    crystal.rotation.y = Math.PI / 4;
    group.add(crystal);

    // Sanfter Leuchteffekt um den Kristall
    const glowGeo = new THREE.SphereGeometry(0.09, 6, 5);
    const glowMat = new THREE.MeshLambertMaterial({
      color: def.color,
      emissive: def.color,
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.25,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.set(0.22, 0.88, 0);
    group.add(glow);
  }

  /**
   * Spezialisten-Accessoires: Bomben, Fallen, etc.
   */
  private static addSpecialistAccessory(
    group: THREE.Group,
    def: UnitDef,
    bodyMat: THREE.MeshLambertMaterial
  ): void {
    if (def.id === 'bomber' || def.id === 'frost_bomber') {
      // Bombe in der Hand
      const bombGeo = new THREE.SphereGeometry(0.08, 6, 5);
      const bombColor = def.id === 'frost_bomber' ? 0x88ccff : 0x222222;
      const bombMat = new THREE.MeshLambertMaterial({ color: bombColor });
      const bomb = new THREE.Mesh(bombGeo, bombMat);
      bomb.position.set(0.2, 0.55, 0.1);
      group.add(bomb);
      // Lunte
      const fuseMat = new THREE.MeshLambertMaterial({ color: 0xff8800 });
      const fuseGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.1, 4);
      const fuse = new THREE.Mesh(fuseGeo, fuseMat);
      fuse.position.set(0.2, 0.65, 0.1);
      fuse.rotation.z = Math.PI / 6;
      group.add(fuse);
    } else if (def.id === 'trapper') {
      // Falle am Gürtel
      const trapGeo = new THREE.BoxGeometry(0.15, 0.04, 0.1);
      const trapMat = new THREE.MeshLambertMaterial({ color: 0x666666 });
      const trap = new THREE.Mesh(trapGeo, trapMat);
      trap.position.set(-0.15, 0.25, 0.12);
      group.add(trap);
      // Stacheln
      const spikeMat = new THREE.MeshLambertMaterial({ color: 0xaaaaaa });
      for (let i = 0; i < 3; i++) {
        const spikeGeo = new THREE.ConeGeometry(0.015, 0.06, 4);
        const spike = new THREE.Mesh(spikeGeo, spikeMat);
        spike.position.set(-0.15 + (i - 1) * 0.05, 0.3, 0.12);
        group.add(spike);
      }
    } else if (def.id === 'alchemist') {
      // Gifttrank
      const flaskGeo = new THREE.CylinderGeometry(0.03, 0.04, 0.12, 6);
      const flaskMat = new THREE.MeshLambertMaterial({
        color: 0x44ff44,
        emissive: 0x22aa22,
        emissiveIntensity: 0.3,
        transparent: true,
        opacity: 0.7,
      });
      const flask = new THREE.Mesh(flaskGeo, flaskMat);
      flask.position.set(0.2, 0.5, 0.08);
      group.add(flask);
      // Korken
      const corkGeo = new THREE.CylinderGeometry(0.02, 0.025, 0.03, 5);
      const corkMat = new THREE.MeshLambertMaterial({ color: 0x886644 });
      const cork = new THREE.Mesh(corkGeo, corkMat);
      cork.position.set(0.2, 0.57, 0.08);
      group.add(cork);
    } else if (def.id === 'necromancer') {
      // Dunkler Stab mit Totenkopf
      const staffGeo = new THREE.CylinderGeometry(0.015, 0.02, 0.65, 5);
      const staffMat = new THREE.MeshLambertMaterial({ color: 0x332244 });
      const staff = new THREE.Mesh(staffGeo, staffMat);
      staff.position.set(0.22, 0.5, 0);
      group.add(staff);
      // Totenkopf
      const skullGeo = new THREE.SphereGeometry(0.05, 5, 4);
      const skullMat = new THREE.MeshLambertMaterial({
        color: 0xddddbb,
        emissive: 0x553388,
        emissiveIntensity: 0.4,
      });
      const skull = new THREE.Mesh(skullGeo, skullMat);
      skull.position.set(0.22, 0.85, 0);
      group.add(skull);
      // Augen
      const eyeMat = new THREE.MeshLambertMaterial({
        color: 0x00ff00,
        emissive: 0x00ff00,
        emissiveIntensity: 0.8,
      });
      const eyeGeo = new THREE.SphereGeometry(0.012, 4, 3);
      const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
      leftEye.position.set(0.205, 0.86, 0.04);
      group.add(leftEye);
      const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
      rightEye.position.set(0.235, 0.86, 0.04);
      group.add(rightEye);
    } else {
      // Standard: Werkzeuggürtel
      const beltGeo = new THREE.BoxGeometry(0.35, 0.04, 0.25);
      const belt = new THREE.Mesh(beltGeo, bodyMat);
      belt.position.set(0, 0.2, 0);
      group.add(belt);
    }
  }

  /**
   * Erstellt einen HP-Balken über der Einheit.
   * Gibt Container, Balken-Mesh und Update-Funktion zurück.
   */
  static createHpBar(): HpBarComponents {
    const container = new THREE.Group();
    container.name = 'hp_bar';

    const barWidth = 0.4;
    const barHeight = 0.04;

    // Hintergrund (rot/dunkel)
    const bgGeo = new THREE.PlaneGeometry(barWidth, barHeight);
    const bgMat = new THREE.MeshBasicMaterial({
      color: 0x440000,
      side: THREE.DoubleSide,
      depthTest: false,
    });
    const bg = new THREE.Mesh(bgGeo, bgMat);
    bg.renderOrder = 998;
    container.add(bg);

    // Vordergrund (grün → gelb → rot)
    const fgGeo = new THREE.PlaneGeometry(barWidth, barHeight);
    const fgMat = new THREE.MeshBasicMaterial({
      color: 0x44ff44,
      side: THREE.DoubleSide,
      depthTest: false,
    });
    const bar = new THREE.Mesh(fgGeo, fgMat);
    bar.renderOrder = 999;
    bar.position.z = 0.001; // Leicht vor dem Hintergrund
    container.add(bar);

    const update = (ratio: number): void => {
      const clamped = Math.max(0, Math.min(1, ratio));

      // Balken-Breite skalieren
      bar.scale.x = clamped;
      // Balken links ausrichten
      bar.position.x = -(barWidth * (1 - clamped)) / 2;

      // Farbe basierend auf LP-Verhältnis
      if (clamped > 0.6) {
        (bar.material as THREE.MeshBasicMaterial).color.setHex(0x44ff44); // Grün
      } else if (clamped > 0.3) {
        (bar.material as THREE.MeshBasicMaterial).color.setHex(0xffcc00); // Gelb
      } else {
        (bar.material as THREE.MeshBasicMaterial).color.setHex(0xff2222); // Rot
      }
    };

    return { container, bar, update };
  }

  /**
   * Fügt einen Sternring an der Basis der Einheit hinzu.
   * Stern 2 = Silberring, Stern 3 = Goldring + Leuchten.
   */
  private static addStarRing(group: THREE.Group, starLevel: 2 | 3): void {
    const ringColor = starLevel === 2 ? 0xcccccc : 0xffd700;
    const emissiveColor = starLevel === 2 ? 0x888888 : 0xffaa00;
    const emissiveIntensity = starLevel === 2 ? 0.2 : 0.5;

    // Ring an der Basis
    const ringGeo = new THREE.TorusGeometry(0.22, 0.02, 6, 16);
    const ringMat = new THREE.MeshLambertMaterial({
      color: ringColor,
      emissive: emissiveColor,
      emissiveIntensity,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.02;
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    // Stern 3: Zusätzlicher Leuchteffekt
    if (starLevel === 3) {
      const glowRingGeo = new THREE.TorusGeometry(0.26, 0.03, 6, 16);
      const glowRingMat = new THREE.MeshLambertMaterial({
        color: 0xffd700,
        emissive: 0xffaa00,
        emissiveIntensity: 0.3,
        transparent: true,
        opacity: 0.4,
      });
      const glowRing = new THREE.Mesh(glowRingGeo, glowRingMat);
      glowRing.position.y = 0.02;
      glowRing.rotation.x = Math.PI / 2;
      group.add(glowRing);

      // Sternmarkierungen (3 kleine Sterne um den Ring)
      const starMarkerMat = new THREE.MeshLambertMaterial({
        color: 0xffd700,
        emissive: 0xffcc00,
        emissiveIntensity: 0.6,
      });
      for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * Math.PI * 2;
        const starMarkerGeo = new THREE.OctahedronGeometry(0.03, 0);
        const starMarker = new THREE.Mesh(starMarkerGeo, starMarkerMat);
        starMarker.position.set(
          Math.cos(angle) * 0.26,
          0.05,
          Math.sin(angle) * 0.26
        );
        group.add(starMarker);
      }
    }
  }
}
