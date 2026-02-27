import * as THREE from 'three';

// ── Types ────────────────────────────────────────────────────────────

interface LootCoin {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

interface SoulOrb {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
  startY: number;
}

// ── LootEffects ──────────────────────────────────────────────────────

export class LootEffects {
  private coins: LootCoin[] = [];
  private souls: SoulOrb[] = [];
  private scene: THREE.Scene;

  // Shared geometry/material for coins (reused across all instances)
  private coinGeometry: THREE.CylinderGeometry;
  private coinMaterial: THREE.MeshStandardMaterial;

  // Shared geometry/material for soul orbs
  private soulGeometry: THREE.SphereGeometry;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Flat coin shape: thin cylinder with 6 sides
    this.coinGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.04, 6);
    this.coinMaterial = new THREE.MeshStandardMaterial({
      color: 0xffcc00,
      emissive: 0xcc9900,
      emissiveIntensity: 0.6,
      metalness: 0.8,
      roughness: 0.2,
    });

    // Small sphere for soul orbs
    this.soulGeometry = new THREE.SphereGeometry(0.2, 8, 6);
  }

  /**
   * Spawn gold coins that scatter outward and fall with gravity.
   * @param position World position to spawn at
   * @param count    Number of coins to scatter
   */
  spawnCoins(position: THREE.Vector3, count: number): void {
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.coinGeometry, this.coinMaterial.clone());
      mesh.position.copy(position);
      // Slight random offset so they don't all start at the exact same point
      mesh.position.x += (Math.random() - 0.5) * 0.3;
      mesh.position.z += (Math.random() - 0.5) * 0.3;
      // Tilt the coin randomly for variety
      mesh.rotation.x = Math.random() * Math.PI;
      mesh.rotation.z = Math.random() * Math.PI;

      // Random outward + upward velocity
      const theta = Math.random() * Math.PI * 2;
      const horizSpeed = 1.5 + Math.random() * 2.5;
      const vertSpeed = 4 + Math.random() * 3;

      const velocity = new THREE.Vector3(
        Math.cos(theta) * horizSpeed,
        vertSpeed,
        Math.sin(theta) * horizSpeed,
      );

      const life = 1.0 + Math.random() * 0.5; // 1.0 - 1.5 seconds

      this.scene.add(mesh);
      this.coins.push({ mesh, velocity, life, maxLife: life });
    }
  }

  /**
   * Spawn a soul orb that rises and fades out.
   * @param position World position to spawn at
   * @param color    Hex color for the soul glow
   */
  spawnSoul(position: THREE.Vector3, color: number): void {
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(this.soulGeometry, material);
    mesh.position.copy(position);
    mesh.position.y += 0.5; // start slightly above ground

    this.scene.add(mesh);

    const life = 1.5;
    this.souls.push({
      mesh,
      life,
      maxLife: life,
      startY: mesh.position.y,
    });
  }

  /**
   * Update all active coin and soul effects. Call once per frame.
   */
  update(dt: number): void {
    // ── Update coins ──────────────────────────────
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const coin = this.coins[i];
      coin.life -= dt;

      if (coin.life <= 0) {
        this.scene.remove(coin.mesh);
        (coin.mesh.material as THREE.Material).dispose();
        this.coins.splice(i, 1);
        continue;
      }

      // Apply gravity
      coin.velocity.y -= 9.8 * dt;

      // Integrate position
      coin.mesh.position.x += coin.velocity.x * dt;
      coin.mesh.position.y += coin.velocity.y * dt;
      coin.mesh.position.z += coin.velocity.z * dt;

      // Don't let coins fall below ground
      if (coin.mesh.position.y < 0.05) {
        coin.mesh.position.y = 0.05;
        coin.velocity.y = Math.abs(coin.velocity.y) * 0.3; // small bounce
        coin.velocity.x *= 0.7; // friction
        coin.velocity.z *= 0.7;
      }

      // Spin the coin as it flies
      coin.mesh.rotation.x += dt * 8;
      coin.mesh.rotation.z += dt * 4;

      // Fade out in the last 30% of lifetime
      const t = coin.life / coin.maxLife;
      const mat = coin.mesh.material as THREE.MeshStandardMaterial;
      if (t < 0.3) {
        mat.opacity = t / 0.3;
        mat.transparent = true;
      }

      // Shrink slightly as coin fades
      if (t < 0.2) {
        const scale = t / 0.2;
        coin.mesh.scale.setScalar(scale);
      }
    }

    // ── Update soul orbs ──────────────────────────
    for (let i = this.souls.length - 1; i >= 0; i--) {
      const soul = this.souls[i];
      soul.life -= dt;

      if (soul.life <= 0) {
        this.scene.remove(soul.mesh);
        (soul.mesh.material as THREE.Material).dispose();
        this.souls.splice(i, 1);
        continue;
      }

      const t = 1 - soul.life / soul.maxLife; // 0 -> 1 over lifetime

      // Rise upward with deceleration
      soul.mesh.position.y = soul.startY + t * 3.0 * (1 - t * 0.4);

      // Gentle horizontal drift (sine wave)
      soul.mesh.position.x += Math.sin(t * Math.PI * 4) * dt * 0.3;

      // Pulsating scale
      const pulse = 1.0 + Math.sin(t * Math.PI * 6) * 0.15;
      soul.mesh.scale.setScalar(pulse * (1 - t * 0.5));

      // Fade out opacity
      const mat = soul.mesh.material as THREE.MeshBasicMaterial;
      if (t > 0.5) {
        mat.opacity = 0.85 * (1 - (t - 0.5) * 2); // fade from 0.85 to 0 over second half
      }
    }
  }

  /**
   * Remove all active coins and souls from the scene. Call on cleanup/restart.
   */
  cleanup(): void {
    for (const coin of this.coins) {
      this.scene.remove(coin.mesh);
      (coin.mesh.material as THREE.Material).dispose();
    }
    this.coins.length = 0;

    for (const soul of this.souls) {
      this.scene.remove(soul.mesh);
      (soul.mesh.material as THREE.Material).dispose();
    }
    this.souls.length = 0;
  }
}
