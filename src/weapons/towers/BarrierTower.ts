import * as THREE from 'three';
import { TowerWeapon, Projectile } from '../Weapon';
import { Enemy } from '../../enemies/Enemy';
import { BALANCE } from '../../systems/BalanceConfig';

export class BarrierTower extends TowerWeapon {
  private slowCooldown = 0;
  private declare barrierField: THREE.Mesh | null;
  private fieldPulseTimer = 0;

  constructor(gridX: number, gridZ: number) {
    super('barrierTower', gridX, gridZ);
  }

  createMesh(): THREE.Group {
    const group = new THREE.Group();
    const config = BALANCE.weapons.barrierTower;
    const crystalMat = new THREE.MeshLambertMaterial({
      color: config.color,
      emissive: 0x224488,
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.85,
    });
    const stoneMat = new THREE.MeshLambertMaterial({ color: 0x666655 });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x334466 });

    // Stone base
    const baseGeo = new THREE.CylinderGeometry(0.6, 0.75, 0.35, 8);
    const base = new THREE.Mesh(baseGeo, stoneMat);
    base.position.y = 0.18;
    base.castShadow = true;
    group.add(base);

    // Central pedestal
    const pedestalGeo = new THREE.CylinderGeometry(0.25, 0.35, 0.5, 6);
    const pedestal = new THREE.Mesh(pedestalGeo, darkMat);
    pedestal.position.y = 0.6;
    pedestal.castShadow = true;
    group.add(pedestal);

    // Tall blue crystal body
    const crystalGeo = new THREE.OctahedronGeometry(0.35, 0);
    const crystal = new THREE.Mesh(crystalGeo, crystalMat);
    crystal.position.y = 1.5;
    crystal.scale.set(1, 2.8, 1);
    crystal.castShadow = true;
    group.add(crystal);

    // Smaller side crystals
    const sideCrystals = [
      { x: -0.35, z: 0.15, s: 0.4, tilt: 0.2 },
      { x: 0.3, z: -0.2, s: 0.35, tilt: -0.25 },
      { x: 0.15, z: 0.35, s: 0.3, tilt: 0.15 },
    ];
    for (const sc of sideCrystals) {
      const sGeo = new THREE.OctahedronGeometry(0.18, 0);
      const sMesh = new THREE.Mesh(sGeo, crystalMat);
      sMesh.position.set(sc.x, 0.7, sc.z);
      sMesh.scale.set(sc.s, sc.s * 2.2, sc.s);
      sMesh.rotation.z = sc.tilt;
      sMesh.castShadow = true;
      group.add(sMesh);
    }

    // Glow sphere at crystal tip
    const glowGeo = new THREE.SphereGeometry(0.15, 8, 6);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x66aaff,
      transparent: true,
      opacity: 0.5,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.y = 2.3;
    group.add(glow);

    // Barrier field visual - ring at base
    const ringGeo = new THREE.TorusGeometry(1.0, 0.05, 8, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x4488ff,
      transparent: true,
      opacity: 0.3,
    });
    this.barrierField = new THREE.Mesh(ringGeo, ringMat);
    this.barrierField.rotation.x = -Math.PI / 2;
    this.barrierField.position.y = 0.1;
    group.add(this.barrierField);

    // Inner barrier disc
    const discGeo = new THREE.RingGeometry(0.3, 1.0, 16);
    const discMat = new THREE.MeshBasicMaterial({
      color: 0x4488ff,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
    });
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.1;
    group.add(disc);

    return group;
  }

  protected applyUpgradeVisual(): void {
    super.applyUpgradeVisual();
    const old = this.mesh.getObjectByName('tower-upgrade');
    if (old) this.mesh.remove(old);
    const ug = new THREE.Group();
    ug.name = 'tower-upgrade';

    if (this.level >= 2) {
      // Additional smaller crystal formations
      const crystalMat = new THREE.MeshLambertMaterial({ color: 0x4488ff, emissive: 0x224488, emissiveIntensity: 0.2, transparent: true, opacity: 0.8 });
      const positions = [
        { x: 0.4, z: 0.3, s: 0.25 },
        { x: -0.3, z: -0.35, s: 0.2 },
        { x: 0.35, z: -0.25, s: 0.22 },
      ];
      for (const p of positions) {
        const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), crystalMat);
        crystal.position.set(p.x, 0.5, p.z);
        crystal.scale.set(p.s, p.s * 2, p.s);
        crystal.rotation.z = (Math.random() - 0.5) * 0.4;
        ug.add(crystal);
      }
    }
    if (this.level >= 3) {
      // Concentric second barrier ring
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x66bbff, transparent: true, opacity: 0.2 });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.04, 6, 20), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.1;
      ug.add(ring);
      // Golden crystal tip
      const goldMat = new THREE.MeshLambertMaterial({ color: 0xffcc00, emissive: 0x886600, emissiveIntensity: 0.4 });
      const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), goldMat);
      tip.position.y = 2.5;
      tip.scale.set(0.8, 1.5, 0.8);
      ug.add(tip);
    }
    this.mesh.add(ug);
  }

  update(dt: number, enemies: Enemy[], createProjectile: (p: Projectile) => void): void {
    // Placement animation
    this.updatePlacementAnim(dt);

    // Animate barrier field pulse
    if (this.barrierField) {
      this.fieldPulseTimer += dt * 2;
      const scale = 1 + Math.sin(this.fieldPulseTimer) * 0.08;
      this.barrierField.scale.set(scale, scale, 1);
      const mat = this.barrierField.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.25 + Math.sin(this.fieldPulseTimer * 1.5) * 0.1;
    }

    // Apply slow to all enemies in range every 0.5s
    this.slowCooldown -= dt;
    if (this.slowCooldown <= 0) {
      this.slowCooldown = 0.5;
      const range = this.getEffectiveRange();
      for (const enemy of enemies) {
        if (!enemy.alive) continue;
        const dist = this.mesh.position.distanceTo(enemy.getPosition());
        if (dist < range) {
          enemy.applySlow(0.2, 3.0);
        }
      }
    }
  }

  protected fire(_target: Enemy, _createProjectile: (p: Projectile) => void): void {
    // BarrierTower does not fire projectiles; slow is applied in update()
  }
}
