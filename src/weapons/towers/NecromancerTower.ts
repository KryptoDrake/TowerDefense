import * as THREE from 'three';
import { TowerWeapon, Projectile } from '../Weapon';
import { Enemy } from '../../enemies/Enemy';
import { BALANCE } from '../../systems/BalanceConfig';

export class NecromancerTower extends TowerWeapon {
  constructor(gridX: number, gridZ: number) {
    super('necromancerTower', gridX, gridZ);
  }

  createMesh(): THREE.Group {
    const group = new THREE.Group();
    const config = BALANCE.weapons.necromancerTower;
    const mainMat = new THREE.MeshLambertMaterial({ color: config.color });
    const boneMat = new THREE.MeshLambertMaterial({ color: 0xddddcc });
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xaa66ff, transparent: true, opacity: 0.6 });

    // Dark stone base
    const baseGeo = new THREE.CylinderGeometry(0.6, 0.75, 0.35, 6);
    const base = new THREE.Mesh(baseGeo, new THREE.MeshLambertMaterial({ color: 0x222222 }));
    base.position.y = 0.175;
    base.castShadow = true;
    group.add(base);

    // Tower body - dark pillar
    const bodyGeo = new THREE.CylinderGeometry(0.28, 0.4, 1.6, 6);
    const body = new THREE.Mesh(bodyGeo, mainMat);
    body.position.y = 1.15;
    body.castShadow = true;
    group.add(body);

    // Skull on top
    const skullGeo = new THREE.SphereGeometry(0.25, 8, 6);
    const skull = new THREE.Mesh(skullGeo, boneMat);
    skull.position.y = 2.15;
    skull.scale.set(1, 0.9, 0.85);
    skull.castShadow = true;
    group.add(skull);

    // Eye sockets (glow)
    for (const xOff of [-0.08, 0.08]) {
      const eyeGeo = new THREE.SphereGeometry(0.05, 6, 4);
      const eye = new THREE.Mesh(eyeGeo, glowMat);
      eye.position.set(xOff, 2.18, 0.2);
      group.add(eye);
    }

    // Floating bone particles
    for (let i = 0; i < 3; i++) {
      const boneGeo = new THREE.BoxGeometry(0.04, 0.15, 0.04);
      const bone = new THREE.Mesh(boneGeo, boneMat);
      const angle = (i / 3) * Math.PI * 2;
      bone.position.set(Math.cos(angle) * 0.5, 1.8 + i * 0.15, Math.sin(angle) * 0.5);
      bone.rotation.z = Math.random() * Math.PI;
      group.add(bone);
    }

    // Purple aura ring
    const auraGeo = new THREE.TorusGeometry(0.5, 0.04, 8, 16);
    const aura = new THREE.Mesh(auraGeo, glowMat);
    aura.rotation.x = -Math.PI / 2;
    aura.position.y = 0.5;
    group.add(aura);

    // Turret head for rotation
    this.turretHead = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01), mainMat);
    this.turretHead.visible = false;
    this.turretHead.position.y = 2.15;
    group.add(this.turretHead);

    return group;
  }

  protected applyUpgradeVisual(): void {
    super.applyUpgradeVisual();
    const old = this.mesh.getObjectByName('tower-upgrade');
    if (old) this.mesh.remove(old);
    const ug = new THREE.Group();
    ug.name = 'tower-upgrade';

    if (this.level >= 2) {
      // Orbiting mini skulls
      const skullMat = new THREE.MeshLambertMaterial({ color: 0xddddcc });
      for (let i = 0; i < 3; i++) {
        const skull = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), skullMat);
        const angle = (i / 3) * Math.PI * 2;
        skull.position.set(Math.cos(angle) * 0.7, 1.4, Math.sin(angle) * 0.7);
        skull.scale.set(1, 0.85, 0.8);
        ug.add(skull);
      }
      // Dark energy ring at mid height
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x6622aa, transparent: true, opacity: 0.4 });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.03, 6, 16), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 1.4;
      ug.add(ring);
    }
    if (this.level >= 3) {
      // Ghostly soul wisps
      const wispMat = new THREE.MeshBasicMaterial({ color: 0xcc88ff, transparent: true, opacity: 0.5 });
      for (let i = 0; i < 4; i++) {
        const wisp = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), wispMat);
        const angle = (i / 4) * Math.PI * 2 + 0.4;
        wisp.position.set(Math.cos(angle) * 0.9, 1.8 + Math.sin(i) * 0.2, Math.sin(angle) * 0.9);
        ug.add(wisp);
      }
      // Large purple aura sphere
      const auraMat = new THREE.MeshBasicMaterial({ color: 0x9944ff, transparent: true, opacity: 0.08 });
      const aura = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 8), auraMat);
      aura.position.y = 1.3;
      ug.add(aura);
      // Bone spike crown
      const boneMat = new THREE.MeshLambertMaterial({ color: 0xccccaa });
      for (let i = 0; i < 5; i++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.2, 4), boneMat);
        const angle = (i / 5) * Math.PI * 2;
        spike.position.set(Math.cos(angle) * 0.35, 2.35, Math.sin(angle) * 0.35);
        ug.add(spike);
      }
    }
    this.mesh.add(ug);
  }

  protected fire(target: Enemy, createProjectile: (p: Projectile) => void): void {
    const config = BALANCE.weapons.necromancerTower as any;
    // Skull projectile
    const projGeo = new THREE.SphereGeometry(0.15, 6, 4);
    const projMat = new THREE.MeshBasicMaterial({ color: config.projectileColor });
    const proj = new THREE.Mesh(projGeo, projMat);
    proj.position.copy(this.mesh.position);
    proj.position.y = 2.15;

    createProjectile({
      mesh: proj,
      target,
      speed: config.projectileSpeed,
      damage: this.getEffectiveDamage(),
      sourceWeaponKey: this.key,
      sourceWeapon: this,
    });
  }
}
