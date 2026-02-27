import * as THREE from 'three';
import { TowerWeapon, Projectile } from '../Weapon';
import { Enemy } from '../../enemies/Enemy';
import { BALANCE } from '../../systems/BalanceConfig';

export class FireTower extends TowerWeapon {
  private declare flame: THREE.Mesh | null;
  private flameTimer = 0;

  constructor(gridX: number, gridZ: number) {
    super('fireTower', gridX, gridZ);
  }

  createMesh(): THREE.Group {
    const group = new THREE.Group();
    const config = BALANCE.weapons.fireTower;
    const brickMat = new THREE.MeshLambertMaterial({ color: 0x884422 });
    const darkBrick = new THREE.MeshLambertMaterial({ color: 0x663311 });
    const metalMat = new THREE.MeshLambertMaterial({ color: 0x555555 });

    // Stone foundation
    const baseGeo = new THREE.CylinderGeometry(0.6, 0.7, 0.35, 8);
    const base = new THREE.Mesh(baseGeo, new THREE.MeshLambertMaterial({ color: 0x666655 }));
    base.position.y = 0.18;
    base.castShadow = true;
    group.add(base);

    // Brick chimney body
    const bodyGeo = new THREE.CylinderGeometry(0.3, 0.45, 1.3, 8);
    const body = new THREE.Mesh(bodyGeo, brickMat);
    body.position.y = 1.05;
    body.castShadow = true;
    group.add(body);

    // Brick band details
    for (const bandY of [0.6, 0.9, 1.2]) {
      const bandGeo = new THREE.TorusGeometry(0.36, 0.02, 4, 8);
      const band = new THREE.Mesh(bandGeo, darkBrick);
      band.position.y = bandY;
      band.rotation.x = Math.PI / 2;
      group.add(band);
    }

    // Fire bowl at top (rotates to aim)
    this.turretHead = new THREE.Mesh(
      new THREE.CylinderGeometry(0.38, 0.28, 0.25, 8),
      new THREE.MeshLambertMaterial({
        color: 0xff3300,
        emissive: 0xff4400,
        emissiveIntensity: 0.4,
      })
    );
    this.turretHead.position.y = 1.85;
    group.add(this.turretHead);

    // Metal grating on bowl
    const grateGeo = new THREE.BoxGeometry(0.65, 0.02, 0.04);
    for (let i = 0; i < 3; i++) {
      const grate = new THREE.Mesh(grateGeo, metalMat);
      grate.position.y = 0.13;
      grate.rotation.y = (i / 3) * Math.PI;
      this.turretHead.add(grate);
    }

    // Animated flame cone
    const flameGeo = new THREE.ConeGeometry(0.18, 0.5, 6);
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0xff8800,
      transparent: true,
      opacity: 0.75,
    });
    this.flame = new THREE.Mesh(flameGeo, flameMat);
    this.flame.position.y = 0.4;
    this.turretHead.add(this.flame);

    // Inner flame (brighter, smaller)
    const innerFlameGeo = new THREE.ConeGeometry(0.1, 0.35, 5);
    const innerFlameMat = new THREE.MeshBasicMaterial({
      color: 0xffcc44,
      transparent: true,
      opacity: 0.8,
    });
    const innerFlame = new THREE.Mesh(innerFlameGeo, innerFlameMat);
    innerFlame.position.y = 0.32;
    this.turretHead.add(innerFlame);

    // Embers / glow particles at base
    const emberMat = new THREE.MeshBasicMaterial({
      color: 0xff4400,
      transparent: true,
      opacity: 0.5,
    });
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const ember = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 3), emberMat);
      ember.position.set(Math.cos(angle) * 0.25, 0.15, Math.sin(angle) * 0.25);
      this.turretHead.add(ember);
    }

    return group;
  }

  protected applyUpgradeVisual(): void {
    super.applyUpgradeVisual();
    const old = this.mesh.getObjectByName('tower-upgrade');
    if (old) this.mesh.remove(old);
    const ug = new THREE.Group();
    ug.name = 'tower-upgrade';

    if (this.level >= 2) {
      // Extra ember particles around base
      const emberMat = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.6 });
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const ember = new THREE.Mesh(new THREE.SphereGeometry(0.05, 4, 3), emberMat);
        ember.position.set(Math.cos(angle) * 0.5, 0.4 + Math.random() * 0.5, Math.sin(angle) * 0.5);
        ug.add(ember);
      }
      // Wider fire bowl rim
      const rimMat = new THREE.MeshLambertMaterial({ color: 0x666655 });
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 6, 12), rimMat);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 1.85;
      ug.add(rim);
    }
    if (this.level >= 3) {
      // Lava cracks on body
      const lavaMat = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.5 });
      for (let i = 0; i < 3; i++) {
        const crack = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.4 + Math.random() * 0.3, 0.02), lavaMat);
        const angle = (i / 3) * Math.PI * 2;
        crack.position.set(Math.cos(angle) * 0.32, 0.8 + i * 0.2, Math.sin(angle) * 0.32);
        crack.rotation.y = angle;
        crack.rotation.z = (Math.random() - 0.5) * 0.3;
        ug.add(crack);
      }
      // Heat haze effect ring
      const hazeMat = new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.1, side: THREE.DoubleSide });
      const haze = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.8, 12), hazeMat);
      haze.rotation.x = -Math.PI / 2;
      haze.position.y = 2.3;
      ug.add(haze);
      // Smoke wisps
      const smokeMat = new THREE.MeshBasicMaterial({ color: 0x444444, transparent: true, opacity: 0.15 });
      for (let i = 0; i < 3; i++) {
        const wisp = new THREE.Mesh(new THREE.SphereGeometry(0.08 + Math.random() * 0.05, 5, 4), smokeMat);
        wisp.position.set((Math.random() - 0.5) * 0.4, 2.3 + i * 0.2, (Math.random() - 0.5) * 0.4);
        ug.add(wisp);
      }
    }
    this.mesh.add(ug);
  }

  update(dt: number, enemies: Enemy[], createProjectile: (p: Projectile) => void): void {
    super.update(dt, enemies, createProjectile);

    // Animate flame flickering
    if (this.flame) {
      this.flameTimer += dt * 6;
      const scaleVar = 1 + Math.sin(this.flameTimer) * 0.15 + Math.sin(this.flameTimer * 2.3) * 0.1;
      this.flame.scale.set(scaleVar, 0.9 + Math.sin(this.flameTimer * 1.7) * 0.2, scaleVar);
    }
  }

  protected fire(target: Enemy, createProjectile: (p: Projectile) => void): void {
    const config = BALANCE.weapons.fireTower;
    const projGeo = new THREE.SphereGeometry(0.1, 6, 6);
    const projMat = new THREE.MeshBasicMaterial({
      color: config.projectileColor,
    });
    const mesh = new THREE.Mesh(projGeo, projMat);
    mesh.position.copy(this.mesh.position);
    mesh.position.y = 2.1;

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
