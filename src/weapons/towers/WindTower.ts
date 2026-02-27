import * as THREE from 'three';
import { TowerWeapon, Projectile } from '../Weapon';
import { Enemy } from '../../enemies/Enemy';
import { BALANCE } from '../../systems/BalanceConfig';

export class WindTower extends TowerWeapon {
  private declare fanBlades: THREE.Group | null;
  private fanRotation = 0;

  constructor(gridX: number, gridZ: number) {
    super('windTower', gridX, gridZ);
  }

  createMesh(): THREE.Group {
    const group = new THREE.Group();
    const config = BALANCE.weapons.windTower;
    const bodyMat = new THREE.MeshLambertMaterial({ color: config.color });
    const stoneMat = new THREE.MeshLambertMaterial({ color: 0x666655 });
    const metalMat = new THREE.MeshLambertMaterial({ color: 0x999999 });

    // Stone base
    const baseGeo = new THREE.CylinderGeometry(0.55, 0.7, 0.35, 8);
    const base = new THREE.Mesh(baseGeo, stoneMat);
    base.position.y = 0.18;
    base.castShadow = true;
    group.add(base);

    // Spiral column body - stacked segments with slight twist effect
    const bodyGeo = new THREE.CylinderGeometry(0.25, 0.4, 1.4, 6);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 1.05;
    body.castShadow = true;
    group.add(body);

    // Spiral ridges around the column
    for (let i = 0; i < 5; i++) {
      const t = i / 5;
      const angle = t * Math.PI * 2;
      const ridgeGeo = new THREE.BoxGeometry(0.08, 0.18, 0.08);
      const ridge = new THREE.Mesh(ridgeGeo, bodyMat);
      const radius = 0.38 - t * 0.1;
      ridge.position.set(
        Math.cos(angle) * radius,
        0.5 + t * 1.0,
        Math.sin(angle) * radius
      );
      ridge.rotation.y = angle;
      ridge.castShadow = true;
      group.add(ridge);
    }

    // Turret head - hub for the fan
    this.turretHead = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.25, 0.2, 8),
      metalMat
    );
    this.turretHead.position.y = 1.9;
    this.turretHead.castShadow = true;
    group.add(this.turretHead);

    // Fan hub center
    const hubGeo = new THREE.SphereGeometry(0.12, 6, 6);
    const hub = new THREE.Mesh(hubGeo, metalMat);
    hub.position.y = 0.2;
    this.turretHead.add(hub);

    // Fan blades (3 blades rotated 120 degrees apart)
    this.fanBlades = new THREE.Group();
    this.fanBlades.position.y = 0.2;
    const bladeMat = new THREE.MeshLambertMaterial({
      color: 0xaaeedd,
      transparent: true,
      opacity: 0.85,
    });
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2;
      const bladeGeo = new THREE.BoxGeometry(0.6, 0.02, 0.18);
      const blade = new THREE.Mesh(bladeGeo, bladeMat);
      blade.position.set(Math.cos(angle) * 0.3, 0, Math.sin(angle) * 0.3);
      blade.rotation.y = angle;
      blade.castShadow = true;
      this.fanBlades.add(blade);
    }
    this.turretHead.add(this.fanBlades);

    return group;
  }

  protected applyUpgradeVisual(): void {
    super.applyUpgradeVisual();
    const old = this.mesh.getObjectByName('tower-upgrade');
    if (old) this.mesh.remove(old);
    const ug = new THREE.Group();
    ug.name = 'tower-upgrade';

    if (this.level >= 2) {
      // Reinforced thicker rotor blades (extra layer)
      const bladeMat = new THREE.MeshLambertMaterial({ color: 0x88ccbb, transparent: true, opacity: 0.7 });
      for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * Math.PI * 2 + Math.PI / 6;
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.03, 0.08), bladeMat);
        blade.position.set(Math.cos(angle) * 0.35, 2.12, Math.sin(angle) * 0.35);
        blade.rotation.y = angle;
        ug.add(blade);
      }
      // Extra spiral elements on column
      const spiralMat = new THREE.MeshLambertMaterial({ color: 0x66bbaa });
      for (let i = 0; i < 3; i++) {
        const t = i / 3;
        const angle = t * Math.PI * 2 + Math.PI;
        const spiral = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.06), spiralMat);
        spiral.position.set(Math.cos(angle) * 0.32, 0.7 + t * 0.8, Math.sin(angle) * 0.32);
        ug.add(spiral);
      }
    }
    if (this.level >= 3) {
      // Whirlwind trail ring
      const trailMat = new THREE.MeshBasicMaterial({ color: 0x88ffee, transparent: true, opacity: 0.2, side: THREE.DoubleSide });
      const trail = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.06, 6, 16), trailMat);
      trail.rotation.x = -Math.PI / 2;
      trail.position.y = 0.15;
      ug.add(trail);
      // Golden hub accent
      const goldMat = new THREE.MeshLambertMaterial({ color: 0xffcc00, emissive: 0x886600, emissiveIntensity: 0.3 });
      const accent = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 6), goldMat);
      accent.position.y = 2.1;
      ug.add(accent);
    }
    this.mesh.add(ug);
  }

  update(dt: number, enemies: Enemy[], createProjectile: (p: Projectile) => void): void {
    super.update(dt, enemies, createProjectile);

    // Animate fan blade spinning
    if (this.fanBlades) {
      this.fanRotation += dt * 6;
      this.fanBlades.rotation.y = this.fanRotation;
    }
  }

  protected fire(target: Enemy, createProjectile: (p: Projectile) => void): void {
    const config = BALANCE.weapons.windTower;
    const projGeo = new THREE.SphereGeometry(0.12, 6, 4);
    const projMat = new THREE.MeshBasicMaterial({ color: config.projectileColor });
    const mesh = new THREE.Mesh(projGeo, projMat);
    mesh.position.copy(this.mesh.position);
    mesh.position.y = 2.1;

    createProjectile({
      mesh,
      target,
      speed: config.projectileSpeed,
      damage: this.getEffectiveDamage(),
      slowFactor: 0.1,
      slowDuration: 1.0,
      sourceWeaponKey: this.key,
      sourceWeapon: this,
    });
  }
}
