import * as THREE from 'three';
import { TowerWeapon, Projectile } from '../Weapon';
import { Enemy } from '../../enemies/Enemy';
import { BALANCE } from '../../systems/BalanceConfig';

export class MageTower extends TowerWeapon {
  private declare floatingCrystal: THREE.Mesh | null;
  private crystalBobTimer = 0;

  constructor(gridX: number, gridZ: number) {
    super('mageTower', gridX, gridZ);
  }

  createMesh(): THREE.Group {
    const group = new THREE.Group();
    const config = BALANCE.weapons.mageTower;
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x554488 });
    const stoneMat = new THREE.MeshLambertMaterial({ color: 0x666655 });
    const roofMat = new THREE.MeshLambertMaterial({ color: config.color });

    // Stone base
    const baseGeo = new THREE.CylinderGeometry(0.6, 0.75, 0.35, 8);
    const base = new THREE.Mesh(baseGeo, stoneMat);
    base.position.y = 0.18;
    base.castShadow = true;
    group.add(base);

    // Tower body - cylindrical stone structure
    const bodyGeo = new THREE.CylinderGeometry(0.35, 0.45, 1.3, 8);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 1.0;
    body.castShadow = true;
    group.add(body);

    // Window detail (small dark inset)
    const windowMat = new THREE.MeshBasicMaterial({ color: 0x220044 });
    const windowGeo = new THREE.BoxGeometry(0.1, 0.2, 0.02);
    for (let i = 0; i < 2; i++) {
      const angle = (i / 2) * Math.PI;
      const win = new THREE.Mesh(windowGeo, windowMat);
      win.position.set(
        Math.cos(angle) * 0.36,
        1.0,
        Math.sin(angle) * 0.36
      );
      win.rotation.y = angle + Math.PI / 2;
      group.add(win);
    }

    // Stone rim below roof
    const rimGeo = new THREE.CylinderGeometry(0.42, 0.38, 0.1, 8);
    const rim = new THREE.Mesh(rimGeo, stoneMat);
    rim.position.y = 1.72;
    group.add(rim);

    // Pointed wizard hat roof (cone)
    const roofGeo = new THREE.ConeGeometry(0.5, 0.8, 8);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 2.15;
    roof.castShadow = true;
    group.add(roof);

    // Turret head - the roof acts as aiming reference
    this.turretHead = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.15, 0.08, 6),
      bodyMat
    );
    this.turretHead.position.y = 1.75;
    this.turretHead.castShadow = true;
    group.add(this.turretHead);

    // Aiming staff/wand extending from turret head
    const staffGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.6, 4);
    const staffMat = new THREE.MeshLambertMaterial({ color: 0x3a2266 });
    const staff = new THREE.Mesh(staffGeo, staffMat);
    staff.rotation.x = Math.PI / 2;
    staff.position.set(0, 0.05, 0.3);
    this.turretHead.add(staff);

    // Staff tip glow
    const tipGlow = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 6, 4),
      new THREE.MeshBasicMaterial({ color: 0xaa66ff })
    );
    tipGlow.position.set(0, 0.05, 0.6);
    this.turretHead.add(tipGlow);

    // Floating purple crystal above the roof
    this.floatingCrystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.15, 0),
      new THREE.MeshBasicMaterial({
        color: 0xaa66ff,
        transparent: true,
        opacity: 0.7,
      })
    );
    this.floatingCrystal.position.y = 2.8;
    group.add(this.floatingCrystal);

    // Glow aura around floating crystal
    const auraGeo = new THREE.SphereGeometry(0.22, 8, 6);
    const auraMat = new THREE.MeshBasicMaterial({
      color: 0x8844cc,
      transparent: true,
      opacity: 0.2,
    });
    const aura = new THREE.Mesh(auraGeo, auraMat);
    aura.position.y = 2.8;
    group.add(aura);

    return group;
  }

  protected applyUpgradeVisual(): void {
    super.applyUpgradeVisual();
    const old = this.mesh.getObjectByName('tower-upgrade');
    if (old) this.mesh.remove(old);
    const ug = new THREE.Group();
    ug.name = 'tower-upgrade';

    if (this.level >= 2) {
      // Arcane rune ring on the ground
      const runeMat = new THREE.MeshBasicMaterial({ color: 0xaa66ff, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
      const rune = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.65, 16), runeMat);
      rune.rotation.x = -Math.PI / 2;
      rune.position.y = 0.02;
      ug.add(rune);
      // Glowing windows
      const winGlowMat = new THREE.MeshBasicMaterial({ color: 0xcc88ff, transparent: true, opacity: 0.6 });
      for (let i = 0; i < 2; i++) {
        const angle = (i / 2) * Math.PI;
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.02), winGlowMat);
        win.position.set(Math.cos(angle) * 0.37, 1.0, Math.sin(angle) * 0.37);
        win.rotation.y = angle + Math.PI / 2;
        ug.add(win);
      }
    }
    if (this.level >= 3) {
      // 3 orbiting crystals
      const orbCrystalMat = new THREE.MeshBasicMaterial({ color: 0xbb77ff, transparent: true, opacity: 0.7 });
      for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * Math.PI * 2;
        const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), orbCrystalMat);
        crystal.position.set(Math.cos(angle) * 0.6, 2.5, Math.sin(angle) * 0.6);
        ug.add(crystal);
      }
      // Enchanted roof overlay (gold transparent)
      const roofMat = new THREE.MeshBasicMaterial({ color: 0xffcc44, transparent: true, opacity: 0.15 });
      const overlay = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.85, 8), roofMat);
      overlay.position.y = 2.15;
      ug.add(overlay);
    }
    this.mesh.add(ug);
  }

  update(dt: number, enemies: Enemy[], createProjectile: (p: Projectile) => void): void {
    super.update(dt, enemies, createProjectile);

    // Animate floating crystal bobbing
    if (this.floatingCrystal) {
      this.crystalBobTimer += dt * 2;
      this.floatingCrystal.position.y = 2.8 + Math.sin(this.crystalBobTimer) * 0.1;
      this.floatingCrystal.rotation.y += dt * 1.5;
    }
  }

  protected fire(target: Enemy, createProjectile: (p: Projectile) => void): void {
    const config = BALANCE.weapons.mageTower;
    const projGeo = new THREE.SphereGeometry(0.12, 8, 6);
    const projMat = new THREE.MeshBasicMaterial({
      color: config.projectileColor,
      transparent: true,
      opacity: 0.85,
    });
    const mesh = new THREE.Mesh(projGeo, projMat);
    mesh.position.copy(this.mesh.position);
    mesh.position.y = 2.8;

    createProjectile({
      mesh,
      target,
      speed: config.projectileSpeed,
      damage: this.getEffectiveDamage(),
      sourceWeaponKey: this.key,
      sourceWeapon: this,
    });
  }
}
