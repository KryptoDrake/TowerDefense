import * as THREE from 'three';
import { TowerWeapon, Projectile } from '../Weapon';
import { Enemy } from '../../enemies/Enemy';
import { BALANCE } from '../../systems/BalanceConfig';

export class TeslaTower extends TowerWeapon {
  private chainTargets: number;
  private declare coilGlow: THREE.Mesh | null;
  private sparkTimer = 0;

  constructor(gridX: number, gridZ: number) {
    super('teslaTower', gridX, gridZ);
    this.chainTargets = BALANCE.weapons.teslaTower.chainTargets;
  }

  createMesh(): THREE.Group {
    const group = new THREE.Group();
    const config = BALANCE.weapons.teslaTower;
    const mat = new THREE.MeshLambertMaterial({ color: config.color });
    const metalMat = new THREE.MeshLambertMaterial({ color: 0x555555 });

    // Heavy metal base
    const baseGeo = new THREE.CylinderGeometry(0.6, 0.7, 0.4, 8);
    const base = new THREE.Mesh(baseGeo, metalMat);
    base.position.y = 0.2;
    base.castShadow = true;
    group.add(base);

    // Coil body (stacked rings with center pole)
    const poleGeo = new THREE.CylinderGeometry(0.08, 0.1, 1.8, 6);
    const pole = new THREE.Mesh(poleGeo, metalMat);
    pole.position.y = 1.3;
    pole.castShadow = true;
    group.add(pole);

    // Copper coil rings
    const coilMat = new THREE.MeshLambertMaterial({ color: 0xcc7744 });
    for (let i = 0; i < 6; i++) {
      const radius = 0.32 - i * 0.025;
      const ringGeo = new THREE.TorusGeometry(radius, 0.04, 6, 12);
      const ring = new THREE.Mesh(ringGeo, coilMat);
      ring.position.y = 0.55 + i * 0.3;
      ring.rotation.x = Math.PI / 2;
      ring.castShadow = true;
      group.add(ring);
    }

    // Insulator rings (dark)
    for (const iy of [0.7, 1.3]) {
      const insGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.08, 6);
      const ins = new THREE.Mesh(insGeo, new THREE.MeshLambertMaterial({ color: 0x333344 }));
      ins.position.y = iy;
      group.add(ins);
    }

    // Tesla coil top sphere (rotating "turret")
    this.turretHead = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 10, 8),
      new THREE.MeshLambertMaterial({
        color: 0xcc88ff,
        emissive: 0x9944cc,
        emissiveIntensity: 0.5,
      })
    );
    this.turretHead.position.y = 2.4;
    group.add(this.turretHead);

    // Glow sphere around top (pulsing)
    const glowGeo = new THREE.SphereGeometry(0.35, 8, 6);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xaa66ff,
      transparent: true,
      opacity: 0.15,
    });
    this.coilGlow = new THREE.Mesh(glowGeo, glowMat);
    this.coilGlow.position.y = 2.4;
    group.add(this.coilGlow);

    // Small electrodes pointing up from top
    const electrodeMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2;
      const eGeo = new THREE.CylinderGeometry(0.015, 0.025, 0.25, 4);
      const e = new THREE.Mesh(eGeo, electrodeMat);
      e.position.set(Math.cos(angle) * 0.15, 0.2, Math.sin(angle) * 0.15);
      e.rotation.set(Math.cos(angle) * 0.3, 0, Math.sin(angle) * 0.3);
      this.turretHead.add(e);
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
      // Extra coil rings
      const coilMat = new THREE.MeshLambertMaterial({ color: 0xdd8855 });
      for (let i = 0; i < 3; i++) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.03, 6, 12), coilMat);
        ring.position.y = 0.5 + i * 0.6;
        ring.rotation.x = Math.PI / 2;
        ring.rotation.z = i * 0.3;
        ug.add(ring);
      }
      // Extra electrode
      const eMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
      for (let i = 0; i < 2; i++) {
        const angle = Math.PI / 3 + i * Math.PI;
        const e = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.3, 4), eMat);
        e.position.set(Math.cos(angle) * 0.2, 2.5, Math.sin(angle) * 0.2);
        ug.add(e);
      }
    }
    if (this.level >= 3) {
      // Bigger glow sphere
      const bigGlow = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0xcc88ff, transparent: true, opacity: 0.08 })
      );
      bigGlow.position.y = 2.4;
      ug.add(bigGlow);
      // Electric arcs (static decorative)
      const arcMat = new THREE.MeshBasicMaterial({ color: 0xeeccff, transparent: true, opacity: 0.5 });
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        const arc = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.6, 3), arcMat);
        arc.position.set(Math.cos(angle) * 0.15, 2.1, Math.sin(angle) * 0.15);
        arc.rotation.z = (Math.random() - 0.5) * 0.8;
        arc.rotation.x = (Math.random() - 0.5) * 0.4;
        ug.add(arc);
      }
      // Crown of energy
      const crownMat = new THREE.MeshBasicMaterial({ color: 0xaa66ff, transparent: true, opacity: 0.25 });
      const crown = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.03, 6, 12), crownMat);
      crown.rotation.x = Math.PI / 2;
      crown.position.y = 2.7;
      ug.add(crown);
    }
    this.mesh.add(ug);
  }

  update(dt: number, enemies: Enemy[], createProjectile: (p: Projectile) => void): void {
    this.updatePlacementAnim(dt);
    this.activeTime += dt;
    this.fireCooldown -= dt;

    const target = this.findTarget(enemies);
    if (target) {
      this.rotateTurret(target, dt);
    }

    // Animate glow pulsing
    if (this.coilGlow) {
      this.sparkTimer += dt;
      const mat = this.coilGlow.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.1 + Math.sin(this.sparkTimer * 4) * 0.08;
      const s = 1 + Math.sin(this.sparkTimer * 3) * 0.1;
      this.coilGlow.scale.setScalar(s);
    }

    if (this.fireCooldown > 0 || !target) return;

    this.fireCooldown = 1 / this.getEffectiveFireRate();

    // Chain lightning: hit primary + nearby enemies
    const targets = [target];
    let lastTarget = target;

    for (let i = 1; i < this.chainTargets; i++) {
      let closest: Enemy | null = null;
      let closestDist = 4; // chain range

      for (const enemy of enemies) {
        if (!enemy.alive || targets.includes(enemy)) continue;
        const dist = lastTarget.getPosition().distanceTo(enemy.getPosition());
        if (dist < closestDist) {
          closest = enemy;
          closestDist = dist;
        }
      }

      if (closest) {
        targets.push(closest);
        lastTarget = closest;
      } else {
        break;
      }
    }

    // Create lightning bolt to each target
    const extraSlow = this.synergyBuffs?.extraSlowFactor ?? 0;
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      const dmg = this.getEffectiveDamage() * (i === 0 ? 1 : 0.6);
      const wasAlive = t.alive;
      t.takeDamage(dmg);
      this.totalDamageDealt += dmg;
      t.lastDamagedByWeapon = this;
      if (wasAlive && !t.alive) { this.kills++; t.killAttributed = true; }
      // Storm Front synergy: chain lightning applies freeze
      if (extraSlow > 0) {
        t.applySlow(1 - extraSlow, 1.0);
      }

      this.createLightningBolt(
        i === 0 ? this.mesh.position.clone().setY(2.4) : targets[i - 1].getPosition().setY(1),
        t.getPosition().setY(1)
      );
    }

    // Flash the glow on fire
    if (this.coilGlow) {
      const mat = this.coilGlow.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.5;
    }
  }

  private createLightningBolt(from: THREE.Vector3, to: THREE.Vector3): void {
    const scene = this.mesh.parent;
    if (!scene) return;

    // Main bolt
    this.createBoltLine(scene, from, to, 0xcc88ff, 0.5, 5);
    // Thinner secondary bolt with slight offset
    const offset = new THREE.Vector3(
      (Math.random() - 0.5) * 0.3,
      (Math.random() - 0.5) * 0.2,
      (Math.random() - 0.5) * 0.3
    );
    this.createBoltLine(scene, from.clone().add(offset), to.clone().add(offset), 0xeeccff, 0.3, 3);
  }

  private createBoltLine(
    scene: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3,
    color: number, startOpacity: number, segments: number
  ): void {
    const points: THREE.Vector3[] = [from];
    const dir = to.clone().sub(from);

    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const p = from.clone().add(dir.clone().multiplyScalar(t));
      p.x += (Math.random() - 0.5) * 0.6;
      p.y += (Math.random() - 0.5) * 0.4;
      p.z += (Math.random() - 0.5) * 0.6;
      points.push(p);
    }
    points.push(to);

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: startOpacity,
    });
    const line = new THREE.Line(geometry, material);
    scene.add(line);

    const animate = () => {
      material.opacity -= 0.06;
      if (material.opacity > 0) {
        requestAnimationFrame(animate);
      } else {
        scene.remove(line);
        geometry.dispose();
        material.dispose();
      }
    };
    requestAnimationFrame(animate);
  }

  protected fire(_target: Enemy, _createProjectile: (p: Projectile) => void): void {
    // Tesla handles its own damage in update()
  }
}
