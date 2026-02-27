import * as THREE from 'three';
import { TowerWeapon, Projectile } from '../Weapon';
import { Enemy } from '../../enemies/Enemy';
import { BALANCE } from '../../systems/BalanceConfig';

export class HealTower extends TowerWeapon {
  private healTimer = 1.0;
  private healPerSecond = 5;
  /** Set externally by Game.ts to heal the base */
  onHeal: ((amount: number) => void) | null = null;

  constructor(gridX: number, gridZ: number) {
    super('healTower', gridX, gridZ);
  }

  createMesh(): THREE.Group {
    const group = new THREE.Group();
    const config = BALANCE.weapons.healTower;
    const greenMat = new THREE.MeshLambertMaterial({ color: config.color });
    const whiteMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const glowMat = new THREE.MeshBasicMaterial({ color: 0x44ff88, transparent: true, opacity: 0.4 });

    // White marble base
    const baseGeo = new THREE.CylinderGeometry(0.55, 0.7, 0.35, 8);
    const base = new THREE.Mesh(baseGeo, whiteMat);
    base.position.y = 0.175;
    base.castShadow = true;
    group.add(base);

    // Pillar
    const bodyGeo = new THREE.CylinderGeometry(0.22, 0.32, 1.4, 8);
    const body = new THREE.Mesh(bodyGeo, whiteMat);
    body.position.y = 1.05;
    body.castShadow = true;
    group.add(body);

    // Green crystal on top
    const crystalGeo = new THREE.OctahedronGeometry(0.3, 0);
    const crystal = new THREE.Mesh(crystalGeo, greenMat);
    crystal.position.y = 2.0;
    crystal.castShadow = true;
    group.add(crystal);

    // Cross symbol (heal indicator)
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.12), glowMat);
    crossH.position.y = 2.5;
    group.add(crossH);
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.4), glowMat);
    crossV.position.y = 2.5;
    group.add(crossV);

    // Healing aura
    const auraGeo = new THREE.SphereGeometry(0.6, 12, 8);
    const aura = new THREE.Mesh(auraGeo, glowMat);
    aura.position.y = 1.5;
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
      // Vine/leaf decorations on the pillar
      const leafMat = new THREE.MeshLambertMaterial({ color: 0x338844 });
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.03), leafMat);
        leaf.position.set(Math.cos(angle) * 0.28, 0.7 + i * 0.2, Math.sin(angle) * 0.28);
        leaf.rotation.y = angle;
        leaf.rotation.z = 0.3;
        ug.add(leaf);
      }
      // Vine wrap
      const vineMat = new THREE.MeshLambertMaterial({ color: 0x226633 });
      const vine = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.02, 4, 8), vineMat);
      vine.position.y = 1.0;
      vine.rotation.x = Math.PI / 2;
      ug.add(vine);
    }
    if (this.level >= 3) {
      // Radiant green ground circle
      const circleMat = new THREE.MeshBasicMaterial({ color: 0x44ff88, transparent: true, opacity: 0.15, side: THREE.DoubleSide });
      const circle = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.9, 16), circleMat);
      circle.rotation.x = -Math.PI / 2;
      circle.position.y = 0.02;
      ug.add(circle);
      // Brighter cross glow
      const brightGlow = new THREE.MeshBasicMaterial({ color: 0x88ffbb, transparent: true, opacity: 0.6 });
      const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.15), brightGlow);
      crossH.position.y = 2.5;
      ug.add(crossH);
      const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 0.5), brightGlow);
      crossV.position.y = 2.5;
      ug.add(crossV);
    }
    this.mesh.add(ug);
  }

  update(dt: number, _enemies: Enemy[], _createProjectile: (p: Projectile) => void): void {
    this.updatePlacementAnim(dt);
    this.healTimer -= dt;

    if (this.healTimer <= 0) {
      this.healTimer = 1.0;
      const healAmount = this.healPerSecond * (1 + (this.level - 1) * 0.5);
      if (this.onHeal) {
        this.onHeal(healAmount);
      }
      this.createHealParticle();
    }
  }

  private createHealParticle(): void {
    const scene = this.mesh.parent;
    if (!scene) return;

    for (let i = 0; i < 3; i++) {
      const geo = new THREE.SphereGeometry(0.06, 4, 3);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x44ff88,
        transparent: true,
        opacity: 0.7,
      });
      const p = new THREE.Mesh(geo, mat);
      const angle = Math.random() * Math.PI * 2;
      p.position.set(
        this.mesh.position.x + Math.cos(angle) * 0.3,
        this.mesh.position.y + 1.5,
        this.mesh.position.z + Math.sin(angle) * 0.3
      );
      scene.add(p);

      const animate = () => {
        p.position.y += 0.03;
        mat.opacity -= 0.02;
        if (mat.opacity > 0) {
          requestAnimationFrame(animate);
        } else {
          scene.remove(p);
          geo.dispose();
          mat.dispose();
        }
      };
      requestAnimationFrame(animate);
    }
  }

  protected fire(_target: Enemy, _createProjectile: (p: Projectile) => void): void {
    // Heal tower doesn't fire - it heals the base
  }

  getStatsText(): string {
    const heal = this.healPerSecond * (1 + (this.level - 1) * 0.5);
    return `Heilung: ${heal} HP/s`;
  }
}
