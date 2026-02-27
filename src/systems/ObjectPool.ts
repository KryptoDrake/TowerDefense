import * as THREE from 'three';

// ── Generic Object Pool ─────────────────────────────────────────────

/**
 * Generic, reusable object pool that reduces garbage collection pressure.
 *
 * - Factory pattern: takes a factory function that creates new objects
 * - Reset function: resets an object to initial state when released back to pool
 * - Max size: optional cap to prevent pools from growing indefinitely
 * - Pre-warming: create objects upfront to avoid allocation spikes during gameplay
 * - Auto-grow: if pool is empty, create new object (never blocks)
 */
export class ObjectPool<T> {
  private pool: T[] = [];
  private active: Set<T> = new Set();
  private readonly factory: () => T;
  private readonly resetFn: (obj: T) => void;
  private readonly maxSize: number;

  /** Name used for stats tracking. */
  readonly name: string;

  constructor(
    factory: () => T,
    reset: (obj: T) => void,
    initialSize: number,
    maxSize: number = 1024,
    name: string = 'ObjectPool',
  ) {
    this.factory = factory;
    this.resetFn = reset;
    this.maxSize = maxSize;
    this.name = name;

    // Register with global stats tracker
    PoolStats.register(this);

    // Pre-fill pool
    this.prewarm(initialSize);
  }

  /** Get an object from the pool (or create a new one if empty). */
  acquire(): T {
    let obj: T;
    if (this.pool.length > 0) {
      obj = this.pool.pop()!;
    } else {
      obj = this.factory();
    }
    this.active.add(obj);
    return obj;
  }

  /** Return an object to the pool. Resets it via the reset function. */
  release(obj: T): void {
    if (!this.active.has(obj)) return; // already released or never acquired
    this.active.delete(obj);
    this.resetFn(obj);
    // Only keep in pool if under max size; otherwise discard
    if (this.pool.length < this.maxSize) {
      this.pool.push(obj);
    }
  }

  /** Number of objects currently in use. */
  getActiveCount(): number {
    return this.active.size;
  }

  /** Number of objects waiting in the pool. */
  getPooledCount(): number {
    return this.pool.length;
  }

  /** Pre-warm the pool with N objects (up to maxSize). */
  prewarm(count: number): void {
    for (let i = 0; i < count; i++) {
      if (this.pool.length >= this.maxSize) break;
      this.pool.push(this.factory());
    }
  }

  /** Release all active objects back to the pool. */
  releaseAll(): void {
    for (const obj of this.active) {
      this.resetFn(obj);
      if (this.pool.length < this.maxSize) {
        this.pool.push(obj);
      }
    }
    this.active.clear();
  }

  /** Clear both pool and active set. Objects are not reset -- use for teardown. */
  clear(): void {
    this.pool.length = 0;
    this.active.clear();
  }
}

// ── MeshPool ────────────────────────────────────────────────────────

/**
 * Specialized pool for THREE.Mesh objects that share a single geometry
 * and material. Acquired meshes are visible and at the origin; released
 * meshes are hidden.
 */
export class MeshPool {
  private pool: ObjectPool<THREE.Mesh>;
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.Material;

  constructor(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    initialSize: number,
    maxSize?: number,
    name: string = 'MeshPool',
  ) {
    this.geometry = geometry;
    this.material = material;

    this.pool = new ObjectPool<THREE.Mesh>(
      () => this.createMesh(),
      (mesh) => this.resetMesh(mesh),
      initialSize,
      maxSize,
      name,
    );
  }

  acquire(): THREE.Mesh {
    const mesh = this.pool.acquire();
    mesh.visible = true;
    return mesh;
  }

  release(mesh: THREE.Mesh): void {
    this.pool.release(mesh);
  }

  releaseAll(): void {
    this.pool.releaseAll();
  }

  getActiveCount(): number {
    return this.pool.getActiveCount();
  }

  getPooledCount(): number {
    return this.pool.getPooledCount();
  }

  clear(): void {
    this.pool.clear();
  }

  /** Dispose the shared geometry and material. Call only on full teardown. */
  dispose(): void {
    this.pool.clear();
    this.geometry.dispose();
    this.material.dispose();
  }

  // ── Internal ────────────────────────────────────────────

  private createMesh(): THREE.Mesh {
    const mesh = new THREE.Mesh(this.geometry, this.material);
    mesh.visible = false;
    mesh.frustumCulled = false;
    return mesh;
  }

  private resetMesh(mesh: THREE.Mesh): void {
    mesh.visible = false;
    mesh.position.set(0, 0, 0);
    mesh.rotation.set(0, 0, 0);
    mesh.scale.set(1, 1, 1);
    // Remove from parent scene if still attached
    if (mesh.parent) {
      mesh.parent.remove(mesh);
    }
  }
}

// ── Vector3Pool ─────────────────────────────────────────────────────

/**
 * Pool for THREE.Vector3 instances. Useful in hot loops that need
 * many temporary vectors (e.g. distance checks, direction calculations).
 *
 * ```ts
 * const v = vec3Pool.acquire(1, 2, 3);
 * // ... use v ...
 * vec3Pool.release(v);
 * ```
 */
export class Vector3Pool {
  private pool: ObjectPool<THREE.Vector3>;

  constructor(initialSize: number = 32, maxSize: number = 256) {
    this.pool = new ObjectPool<THREE.Vector3>(
      () => new THREE.Vector3(),
      (v) => v.set(0, 0, 0),
      initialSize,
      maxSize,
      'Vector3Pool',
    );
  }

  /** Acquire a vector, optionally initializing its components. */
  acquire(x: number = 0, y: number = 0, z: number = 0): THREE.Vector3 {
    const v = this.pool.acquire();
    v.set(x, y, z);
    return v;
  }

  release(vec: THREE.Vector3): void {
    this.pool.release(vec);
  }

  releaseAll(): void {
    this.pool.releaseAll();
  }

  getActiveCount(): number {
    return this.pool.getActiveCount();
  }

  getPooledCount(): number {
    return this.pool.getPooledCount();
  }

  clear(): void {
    this.pool.clear();
  }
}

// ── ProjectilePool ──────────────────────────────────────────────────

/** Data structure for a pooled projectile. */
export interface PooledProjectile {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  damage: number;
  speed: number;
  splashRadius: number;
  slowFactor: number;
  slowDuration: number;
  dotDamage: number;
  dotDuration: number;
  sourceWeaponKey: string;
  active: boolean;
}

/**
 * Pool for projectile data bundles (mesh + velocity + gameplay fields).
 * Manages adding/removing meshes from the scene automatically.
 */
export class ProjectilePool {
  private pool: ObjectPool<PooledProjectile>;
  private scene: THREE.Scene;
  private geometry: THREE.SphereGeometry;
  private material: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene, initialSize: number = 30, maxSize: number = 200) {
    this.scene = scene;
    this.geometry = new THREE.SphereGeometry(0.1, 4, 4);
    this.material = new THREE.MeshBasicMaterial({ color: 0xff4444 });

    this.pool = new ObjectPool<PooledProjectile>(
      () => this.createProjectile(),
      (proj) => this.resetProjectile(proj),
      initialSize,
      maxSize,
      'ProjectilePool',
    );
  }

  acquire(): PooledProjectile {
    const proj = this.pool.acquire();
    proj.active = true;
    proj.mesh.visible = true;
    this.scene.add(proj.mesh);
    return proj;
  }

  release(proj: PooledProjectile): void {
    this.pool.release(proj);
  }

  releaseAll(): void {
    this.pool.releaseAll();
  }

  getActiveCount(): number {
    return this.pool.getActiveCount();
  }

  getPooledCount(): number {
    return this.pool.getPooledCount();
  }

  clear(): void {
    this.pool.releaseAll();
    this.pool.clear();
  }

  /** Dispose shared geometry and material. Call only on full teardown. */
  dispose(): void {
    this.pool.releaseAll();
    this.pool.clear();
    this.geometry.dispose();
    this.material.dispose();
  }

  // ── Internal ────────────────────────────────────────────

  private createProjectile(): PooledProjectile {
    const mesh = new THREE.Mesh(this.geometry, this.material.clone());
    mesh.visible = false;
    mesh.frustumCulled = false;

    return {
      mesh,
      velocity: new THREE.Vector3(),
      damage: 0,
      speed: 0,
      splashRadius: 0,
      slowFactor: 0,
      slowDuration: 0,
      dotDamage: 0,
      dotDuration: 0,
      sourceWeaponKey: '',
      active: false,
    };
  }

  private resetProjectile(proj: PooledProjectile): void {
    proj.active = false;
    proj.mesh.visible = false;
    proj.mesh.position.set(0, 0, 0);
    proj.mesh.rotation.set(0, 0, 0);
    proj.mesh.scale.set(1, 1, 1);
    proj.velocity.set(0, 0, 0);
    proj.damage = 0;
    proj.speed = 0;
    proj.splashRadius = 0;
    proj.slowFactor = 0;
    proj.slowDuration = 0;
    proj.dotDamage = 0;
    proj.dotDuration = 0;
    proj.sourceWeaponKey = '';

    // Remove from scene
    if (proj.mesh.parent) {
      proj.mesh.parent.remove(proj.mesh);
    }
  }
}

// ── PoolStats (Performance Monitoring) ──────────────────────────────

interface PoolInfo {
  name: string;
  pooled: number;
  active: number;
}

interface PoolStatsSnapshot {
  totalPooled: number;
  totalActive: number;
  pools: PoolInfo[];
}

/**
 * Global registry of all object pools for performance monitoring.
 * Pools auto-register on construction.
 *
 * ```ts
 * const stats = PoolStats.getStats();
 * console.log(`Active objects: ${stats.totalActive}, Pooled: ${stats.totalPooled}`);
 * ```
 */
export class PoolStats {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static pools: ObjectPool<any>[] = [];

  /** Called internally by ObjectPool constructor. */
  static register<T>(pool: ObjectPool<T>): void {
    PoolStats.pools.push(pool);
  }

  /** Remove a pool from tracking (e.g. on teardown). */
  static unregister<T>(pool: ObjectPool<T>): void {
    const idx = PoolStats.pools.indexOf(pool);
    if (idx !== -1) {
      PoolStats.pools.splice(idx, 1);
    }
  }

  /** Snapshot of all registered pools. */
  static getStats(): PoolStatsSnapshot {
    let totalPooled = 0;
    let totalActive = 0;
    const pools: PoolInfo[] = [];

    for (const pool of PoolStats.pools) {
      const pooled = pool.getPooledCount();
      const active = pool.getActiveCount();
      totalPooled += pooled;
      totalActive += active;
      pools.push({ name: pool.name, pooled, active });
    }

    return { totalPooled, totalActive, pools };
  }

  /** Clear the global registry. */
  static clear(): void {
    PoolStats.pools.length = 0;
  }
}
