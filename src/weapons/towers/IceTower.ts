import * as THREE from 'three';
import { TowerWeapon, Projectile } from '../Weapon';
import { Enemy } from '../../enemies/Enemy';
import { BALANCE } from '../../systems/BalanceConfig';

export class IceTower extends TowerWeapon {
  private declare floatingCrystals: THREE.Group | null;

  constructor(gridX: number, gridZ: number) {
    super('iceTower', gridX, gridZ);
  }

  createMesh(): THREE.Group {
    const group = new THREE.Group();
    const config = BALANCE.weapons.iceTower;
    const iceMat = new THREE.MeshLambertMaterial({
      color: config.color,
      transparent: true,
      opacity: 0.8,
    });
    const darkIce = new THREE.MeshLambertMaterial({
      color: 0x6699cc,
      transparent: true,
      opacity: 0.85,
    });

    // Frozen stone base
    const baseGeo = new THREE.CylinderGeometry(0.55, 0.7, 0.3, 6);
    const base = new THREE.Mesh(baseGeo, darkIce);
    base.position.y = 0.15;
    base.castShadow = true;
    group.add(base);

    // Main ice crystal body (tall octahedron)
    const crystalGeo = new THREE.OctahedronGeometry(0.45, 0);
    const crystal = new THREE.Mesh(crystalGeo, iceMat);
    crystal.position.y = 1.2;
    crystal.scale.set(1, 2.2, 1);
    crystal.castShadow = true;
    group.add(crystal);

    // Smaller side crystals growing from base
    const smallCrystals = [
      { x: -0.35, z: 0.2, ry: 0.3, s: 0.5, tilt: 0.2 },
      { x: 0.3, z: -0.25, ry: -0.5, s: 0.4, tilt: -0.25 },
      { x: 0.1, z: 0.35, ry: 1.2, s: 0.35, tilt: 0.15 },
    ];
    for (const sc of smallCrystals) {
      const sGeo = new THREE.OctahedronGeometry(0.2, 0);
      const sMesh = new THREE.Mesh(sGeo, iceMat);
      sMesh.position.set(sc.x, 0.5, sc.z);
      sMesh.scale.set(sc.s, sc.s * 2, sc.s);
      sMesh.rotation.set(sc.tilt, sc.ry, 0);
      sMesh.castShadow = true;
      group.add(sMesh);
    }

    // Glowing rotating top crystal
    this.turretHead = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.22, 0),
      new THREE.MeshLambertMaterial({
        color: 0xccffff,
        emissive: 0x44aaff,
        emissiveIntensity: 0.4,
      })
    );
    this.turretHead.position.y = 2.4;
    group.add(this.turretHead);

    // Floating ice crystals orbiting the top
    this.floatingCrystals = new THREE.Group();
    this.floatingCrystals.position.y = 2.4;
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2;
      const fGeo = new THREE.OctahedronGeometry(0.06, 0);
      const fMat = new THREE.MeshBasicMaterial({
        color: 0xaaeeff,
        transparent: true,
        opacity: 0.6,
      });
      const f = new THREE.Mesh(fGeo, fMat);
      f.position.set(Math.cos(angle) * 0.5, 0, Math.sin(angle) * 0.5);
      this.floatingCrystals.add(f);
    }
    group.add(this.floatingCrystals);

    return group;
  }

  protected applyUpgradeVisual(): void {
    super.applyUpgradeVisual();
    const old = this.mesh.getObjectByName('tower-upgrade');
    if (old) this.mesh.remove(old);
    const ug = new THREE.Group();
    ug.name = 'tower-upgrade';

    if (this.level >= 2) {
      // Extra floating crystals
      const crystalMat = new THREE.MeshBasicMaterial({ color: 0xaaeeff, transparent: true, opacity: 0.5 });
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2 + 0.4;
        const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), crystalMat);
        crystal.position.set(Math.cos(angle) * 0.6, 1.8, Math.sin(angle) * 0.6);
        ug.add(crystal);
      }
      // Side crystal growths
      const iceMat = new THREE.MeshLambertMaterial({ color: 0x88ccff, transparent: true, opacity: 0.7 });
      for (let i = 0; i < 2; i++) {
        const sc = new THREE.Mesh(new THREE.OctahedronGeometry(0.15, 0), iceMat);
        sc.position.set(i === 0 ? -0.45 : 0.4, 0.8, i === 0 ? -0.2 : 0.3);
        sc.scale.set(0.6, 1.5, 0.6);
        ug.add(sc);
      }
    }
    if (this.level >= 3) {
      // Frost ring on ground
      const frostMat = new THREE.MeshBasicMaterial({ color: 0x88ddff, transparent: true, opacity: 0.2, side: THREE.DoubleSide });
      const frostRing = new THREE.Mesh(new THREE.RingGeometry(0.6, 1.2, 16), frostMat);
      frostRing.rotation.x = -Math.PI / 2;
      frostRing.position.y = 0.02;
      ug.add(frostRing);
      // Bright emissive main crystal overlay
      const brightMat = new THREE.MeshBasicMaterial({ color: 0xccffff, transparent: true, opacity: 0.15 });
      const overlay = new THREE.Mesh(new THREE.OctahedronGeometry(0.48, 0), brightMat);
      overlay.position.y = 1.2;
      overlay.scale.set(1, 2.2, 1);
      ug.add(overlay);
      // Snowflake particles (static)
      const snowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 });
      for (let i = 0; i < 6; i++) {
        const snow = new THREE.Mesh(new THREE.OctahedronGeometry(0.03, 0), snowMat);
        snow.position.set(
          (Math.random() - 0.5) * 1.2,
          0.5 + Math.random() * 2,
          (Math.random() - 0.5) * 1.2
        );
        ug.add(snow);
      }
    }
    this.mesh.add(ug);
  }

  update(dt: number, enemies: Enemy[], createProjectile: (p: Projectile) => void): void {
    super.update(dt, enemies, createProjectile);
    // Animate floating crystals
    if (this.floatingCrystals) {
      this.floatingCrystals.rotation.y += dt * 1.5;
    }
  }

  protected fire(target: Enemy, createProjectile: (p: Projectile) => void): void {
    const config = BALANCE.weapons.iceTower;
    const projGeo = new THREE.OctahedronGeometry(0.1, 0);
    const projMat = new THREE.MeshBasicMaterial({ color: config.projectileColor });
    const mesh = new THREE.Mesh(projGeo, projMat);
    mesh.position.copy(this.mesh.position);
    mesh.position.y = 2.4;

    createProjectile({
      mesh,
      target,
      speed: config.projectileSpeed,
      damage: this.getEffectiveDamage(),
      slowFactor: config.slowFactor,
      slowDuration: config.slowDuration,
      sourceWeaponKey: this.key,
      sourceWeapon: this,
    });
  }
}
