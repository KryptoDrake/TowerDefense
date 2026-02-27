import * as THREE from 'three';
import { TowerWeapon, Projectile } from '../Weapon';
import { Enemy } from '../../enemies/Enemy';
import { BALANCE } from '../../systems/BalanceConfig';

export class FlamethrowerTower extends TowerWeapon {
  constructor(gridX: number, gridZ: number) {
    super('flamethrowerTower', gridX, gridZ);
  }

  createMesh(): THREE.Group {
    const group = new THREE.Group();
    const config = BALANCE.weapons.flamethrowerTower;
    const metalMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
    const darkMetal = new THREE.MeshLambertMaterial({ color: 0x333333 });
    const orangeMat = new THREE.MeshLambertMaterial({ color: config.color });
    const stoneMat = new THREE.MeshLambertMaterial({ color: 0x666655 });

    // Heavy stone/metal base
    const baseGeo = new THREE.CylinderGeometry(0.6, 0.75, 0.4, 8);
    const base = new THREE.Mesh(baseGeo, stoneMat);
    base.position.y = 0.2;
    base.castShadow = true;
    group.add(base);

    // Industrial body - boxy metal structure
    const bodyGeo = new THREE.CylinderGeometry(0.35, 0.45, 1.2, 8);
    const body = new THREE.Mesh(bodyGeo, metalMat);
    body.position.y = 1.0;
    body.castShadow = true;
    group.add(body);

    // Metal bands
    for (const bandY of [0.6, 1.0, 1.4]) {
      const bandGeo = new THREE.TorusGeometry(0.38, 0.025, 4, 8);
      const band = new THREE.Mesh(bandGeo, darkMetal);
      band.position.y = bandY;
      band.rotation.x = Math.PI / 2;
      group.add(band);
    }

    // Orange accent panel on body
    const panelGeo = new THREE.BoxGeometry(0.3, 0.4, 0.02);
    const panel = new THREE.Mesh(panelGeo, orangeMat);
    panel.position.set(0, 1.1, 0.37);
    group.add(panel);

    // Turret head - rotating gun platform
    this.turretHead = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.35, 0.2, 8),
      metalMat
    );
    this.turretHead.position.y = 1.7;
    this.turretHead.castShadow = true;
    group.add(this.turretHead);

    // Main barrel - thick flamethrower nozzle
    const barrelGeo = new THREE.CylinderGeometry(0.08, 0.12, 0.8, 8);
    const barrel = new THREE.Mesh(barrelGeo, darkMetal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.06, 0.45);
    barrel.castShadow = true;
    this.turretHead.add(barrel);

    // Muzzle ring - red/orange heat indicator
    const muzzleGeo = new THREE.TorusGeometry(0.1, 0.025, 6, 8);
    const muzzleMat = new THREE.MeshLambertMaterial({
      color: 0xff4400,
      emissive: 0xff2200,
      emissiveIntensity: 0.3,
    });
    const muzzle = new THREE.Mesh(muzzleGeo, muzzleMat);
    muzzle.position.set(0, 0.06, 0.85);
    this.turretHead.add(muzzle);

    // Fuel tank on the back of turret
    const tankGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.35, 6);
    const tank = new THREE.Mesh(tankGeo, orangeMat);
    tank.position.set(0, 0.06, -0.25);
    tank.rotation.x = Math.PI / 2;
    tank.castShadow = true;
    this.turretHead.add(tank);

    // Pilot light glow at muzzle
    const pilotGeo = new THREE.SphereGeometry(0.04, 4, 4);
    const pilotMat = new THREE.MeshBasicMaterial({
      color: 0xff8800,
      transparent: true,
      opacity: 0.7,
    });
    const pilot = new THREE.Mesh(pilotGeo, pilotMat);
    pilot.position.set(0, 0.06, 0.88);
    this.turretHead.add(pilot);

    return group;
  }

  protected applyUpgradeVisual(): void {
    super.applyUpgradeVisual();
    const old = this.mesh.getObjectByName('tower-upgrade');
    if (old) this.mesh.remove(old);
    const ug = new THREE.Group();
    ug.name = 'tower-upgrade';

    if (this.level >= 2) {
      // Second fuel tank
      const tankMat = new THREE.MeshLambertMaterial({ color: 0xff6600 });
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.3, 6), tankMat);
      tank.position.set(-0.3, 1.3, -0.15);
      tank.rotation.z = 0.15;
      ug.add(tank);
      // Scorch ring on the ground
      const scorchMat = new THREE.MeshBasicMaterial({ color: 0x331100, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
      const scorch = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.8, 16), scorchMat);
      scorch.rotation.x = -Math.PI / 2;
      scorch.position.y = 0.02;
      ug.add(scorch);
    }
    if (this.level >= 3) {
      // Second smaller barrel
      const darkMetal = new THREE.MeshLambertMaterial({ color: 0x333333 });
      const barrel2 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.6, 6), darkMetal);
      barrel2.rotation.x = Math.PI / 2;
      barrel2.position.set(0.15, 1.8, 0.35);
      ug.add(barrel2);
      // Heat glow at muzzle
      const heatMat = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.3 });
      const heat = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 4), heatMat);
      heat.position.set(0, 1.76, 0.9);
      ug.add(heat);
    }
    this.mesh.add(ug);
  }

  protected fire(target: Enemy, createProjectile: (p: Projectile) => void): void {
    const config = BALANCE.weapons.flamethrowerTower as any;
    const projGeo = new THREE.SphereGeometry(0.08, 5, 4);
    const projMat = new THREE.MeshBasicMaterial({
      color: config.projectileColor,
      transparent: true,
      opacity: 0.8,
    });
    const mesh = new THREE.Mesh(projGeo, projMat);
    mesh.position.copy(this.mesh.position);
    mesh.position.y = 1.76;

    createProjectile({
      mesh,
      target,
      speed: config.projectileSpeed,
      damage: this.getEffectiveDamage(),
      dotDamage: config.dotDamage,
      dotDuration: config.dotDuration,
      sourceWeaponKey: this.key,
      sourceWeapon: this,
    });
  }
}
