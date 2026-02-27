import * as THREE from 'three';
import { TowerWeapon, Projectile } from '../Weapon';
import { Enemy } from '../../enemies/Enemy';
import { BALANCE } from '../../systems/BalanceConfig';

export class PoisonTower extends TowerWeapon {
  private bubbleTimer = 0;
  private bubbles: THREE.Mesh[] = [];

  constructor(gridX: number, gridZ: number) {
    super('poisonTower', gridX, gridZ);
  }

  createMesh(): THREE.Group {
    const group = new THREE.Group();
    const config = BALANCE.weapons.poisonTower;
    const mat = new THREE.MeshLambertMaterial({ color: config.color });
    const glassMat = new THREE.MeshLambertMaterial({
      color: 0x22cc44,
      transparent: true,
      opacity: 0.6,
    });

    // Stone base
    const baseGeo = new THREE.CylinderGeometry(0.55, 0.65, 0.35, 8);
    const base = new THREE.Mesh(baseGeo, new THREE.MeshLambertMaterial({ color: 0x666655 }));
    base.position.y = 0.18;
    base.castShadow = true;
    group.add(base);

    // Wooden frame holding the vial
    const frameMat = new THREE.MeshLambertMaterial({ color: 0x664422 });
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2;
      const strutGeo = new THREE.BoxGeometry(0.06, 1.6, 0.06);
      const strut = new THREE.Mesh(strutGeo, frameMat);
      strut.position.set(Math.sin(angle) * 0.35, 1.15, Math.cos(angle) * 0.35);
      strut.castShadow = true;
      group.add(strut);
    }

    // Glass vial body (transparent green)
    const bodyGeo = new THREE.CylinderGeometry(0.22, 0.35, 1.2, 8);
    const body = new THREE.Mesh(bodyGeo, glassMat);
    body.position.y = 1.0;
    group.add(body);

    // Liquid inside (slightly smaller, darker)
    const liquidGeo = new THREE.CylinderGeometry(0.2, 0.33, 0.9, 8);
    const liquidMat = new THREE.MeshLambertMaterial({
      color: 0x33ff33,
      transparent: true,
      opacity: 0.5,
      emissive: 0x22aa22,
      emissiveIntensity: 0.2,
    });
    const liquid = new THREE.Mesh(liquidGeo, liquidMat);
    liquid.position.y = 0.85;
    group.add(liquid);

    // Bubbling top (turret - rotates to aim)
    this.turretHead = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 8, 6),
      new THREE.MeshLambertMaterial({
        color: 0x44ff44,
        emissive: 0x22aa22,
        emissiveIntensity: 0.35,
        transparent: true,
        opacity: 0.75,
      })
    );
    this.turretHead.position.y = 1.85;
    group.add(this.turretHead);

    // Cork/nozzle
    const nozzleGeo = new THREE.CylinderGeometry(0.12, 0.1, 0.18, 6);
    const nozzleMat = new THREE.MeshLambertMaterial({ color: 0x886633 });
    const nozzle = new THREE.Mesh(nozzleGeo, nozzleMat);
    nozzle.position.y = 0.3;
    this.turretHead.add(nozzle);

    // Spout for spraying
    const spoutGeo = new THREE.CylinderGeometry(0.04, 0.06, 0.15, 6);
    const spout = new THREE.Mesh(spoutGeo, new THREE.MeshLambertMaterial({ color: 0x555544 }));
    spout.rotation.x = Math.PI / 2;
    spout.position.set(0, 0.28, 0.12);
    this.turretHead.add(spout);

    return group;
  }

  protected applyUpgradeVisual(): void {
    super.applyUpgradeVisual();
    const old = this.mesh.getObjectByName('tower-upgrade');
    if (old) this.mesh.remove(old);
    const ug = new THREE.Group();
    ug.name = 'tower-upgrade';

    if (this.level >= 2) {
      // Extra tube attachments
      const tubeMat = new THREE.MeshLambertMaterial({ color: 0x556644 });
      for (let i = 0; i < 2; i++) {
        const angle = Math.PI / 3 + i * Math.PI;
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 5), tubeMat);
        tube.position.set(Math.cos(angle) * 0.3, 0.7, Math.sin(angle) * 0.3);
        tube.rotation.z = 0.3 * (i === 0 ? 1 : -1);
        ug.add(tube);
      }
      // Drip effect at bottom
      const dripMat = new THREE.MeshBasicMaterial({ color: 0x44ff44, transparent: true, opacity: 0.3 });
      for (let i = 0; i < 3; i++) {
        const drip = new THREE.Mesh(new THREE.SphereGeometry(0.03, 4, 3), dripMat);
        drip.position.set((Math.random() - 0.5) * 0.4, 0.2, (Math.random() - 0.5) * 0.4);
        ug.add(drip);
      }
    }
    if (this.level >= 3) {
      // Toxic ground cloud
      const cloudMat = new THREE.MeshBasicMaterial({ color: 0x33ff33, transparent: true, opacity: 0.1, side: THREE.DoubleSide });
      const cloud = new THREE.Mesh(new THREE.CircleGeometry(1.0, 12), cloudMat);
      cloud.rotation.x = -Math.PI / 2;
      cloud.position.y = 0.03;
      ug.add(cloud);
      // Glowing vial overlay
      const glowMat = new THREE.MeshBasicMaterial({ color: 0x22ff22, transparent: true, opacity: 0.12 });
      const glowVial = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.38, 1.25, 8), glowMat);
      glowVial.position.y = 1.0;
      ug.add(glowVial);
      // Skull emblem
      const skullMat = new THREE.MeshBasicMaterial({ color: 0xccffcc, transparent: true, opacity: 0.6 });
      const skull = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), skullMat);
      skull.position.set(0, 1.6, 0.35);
      ug.add(skull);
      const jawMat = new THREE.MeshBasicMaterial({ color: 0xccffcc, transparent: true, opacity: 0.6 });
      const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.06), jawMat);
      jaw.position.set(0, 1.53, 0.37);
      ug.add(jaw);
    }
    this.mesh.add(ug);
  }

  update(dt: number, enemies: Enemy[], createProjectile: (p: Projectile) => void): void {
    super.update(dt, enemies, createProjectile);

    // Animate rising bubbles inside the vial
    this.bubbleTimer += dt;
    if (this.bubbleTimer > 0.4 && this.mesh.parent) {
      this.bubbleTimer = 0;
      this.spawnBubble();
    }

    // Update existing bubbles
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.position.y += dt * 0.5;
      const mat = b.material as THREE.MeshBasicMaterial;
      mat.opacity -= dt * 0.6;
      if (mat.opacity <= 0 && b.parent) {
        b.parent.remove(b);
        (b.geometry as THREE.BufferGeometry).dispose();
        mat.dispose();
        this.bubbles.splice(i, 1);
      }
    }
  }

  private spawnBubble(): void {
    const geo = new THREE.SphereGeometry(0.03 + Math.random() * 0.03, 4, 4);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x88ff88,
      transparent: true,
      opacity: 0.5,
    });
    const bubble = new THREE.Mesh(geo, mat);
    bubble.position.copy(this.mesh.position);
    bubble.position.x += (Math.random() - 0.5) * 0.3;
    bubble.position.y = this.mesh.position.y + 0.7 + Math.random() * 0.5;
    bubble.position.z += (Math.random() - 0.5) * 0.3;
    this.mesh.parent!.add(bubble);
    this.bubbles.push(bubble);
  }

  protected fire(target: Enemy, createProjectile: (p: Projectile) => void): void {
    const config = BALANCE.weapons.poisonTower;
    const projGeo = new THREE.SphereGeometry(0.13, 6, 6);
    const projMat = new THREE.MeshBasicMaterial({
      color: config.projectileColor,
      transparent: true,
      opacity: 0.7,
    });
    const mesh = new THREE.Mesh(projGeo, projMat);
    mesh.position.copy(this.mesh.position);
    mesh.position.y = 1.85;

    const dotDurMult = this.synergyBuffs?.dotDurationMult ?? 1;
    const extraSlow = this.synergyBuffs?.extraSlowFactor ?? 0;
    createProjectile({
      mesh,
      target,
      speed: config.projectileSpeed,
      damage: this.getEffectiveDamage(),
      dotDamage: config.dotDamage,
      dotDuration: config.dotDuration * dotDurMult,
      splashRadius: config.splashRadius,
      slowFactor: extraSlow > 0 ? (1 - extraSlow) : undefined,
      slowDuration: extraSlow > 0 ? config.dotDuration * dotDurMult : undefined,
      sourceWeaponKey: this.key,
      sourceWeapon: this,
    });
  }
}
