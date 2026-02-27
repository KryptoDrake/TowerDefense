import * as THREE from 'three';

export class CameraController {
  private camera: THREE.PerspectiveCamera;
  private target: THREE.Vector3;
  private distance: number;
  private angle: number;
  private pitch: number;

  // Rotation (left mouse button / one-finger touch)
  private isRotating = false;
  // Panning (middle mouse button / two-finger touch)
  private isPanning = false;
  private lastMouse = { x: 0, y: 0 };
  private dragDistance = 0;

  // Touch gesture state
  private lastTouchDist = 0;
  private lastTouchCenter = { x: 0, y: 0 };
  private touchFingers = 0;

  private readonly minDistance = 15;
  private readonly maxDistance = 60;
  private readonly minPitch = 0.3;
  private readonly maxPitch = 1.2;

  // Smooth interpolation
  private targetAngle: number;
  private targetPitch: number;
  private targetDistance: number;
  private targetTarget: THREE.Vector3;

  // Screen shake
  private shakeIntensity = 0;
  private shakeTimer = 0;
  private shakeDuration = 0;

  // Auto-follow enemies
  private autoFollow = false;
  private autoFollowTarget: THREE.Vector3 | null = null;
  private autoFollowOverride = false;
  private autoFollowOverrideTimer = 0;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.target = new THREE.Vector3(0, 0, 5);
    this.distance = 45;
    this.angle = Math.PI / 4 - Math.PI / 2;
    this.pitch = 0.85;

    this.targetAngle = this.angle;
    this.targetPitch = this.pitch;
    this.targetDistance = this.distance;
    this.targetTarget = this.target.clone();

    this.setupControls();
    this.updateCamera();
  }

  private setupControls(): void {
    const el = document.getElementById('game-canvas')!;

    // Mouse wheel zoom (smooth)
    el.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault();
      this.targetDistance += e.deltaY * 0.03;
      this.targetDistance = Math.max(this.minDistance, Math.min(this.maxDistance, this.targetDistance));
    }, { passive: false });

    // Left-click drag to rotate, middle-click drag to pan
    el.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.button === 0) { // left click
        this.isRotating = true;
        this.lastMouse = { x: e.clientX, y: e.clientY };
        this.dragDistance = 0;
      } else if (e.button === 1) { // middle click
        this.isPanning = true;
        this.lastMouse = { x: e.clientX, y: e.clientY };
        e.preventDefault();
        // Override auto-follow when user pans manually
        if (this.autoFollow) {
          this.autoFollowOverride = true;
          this.autoFollowOverrideTimer = 3;
        }
      }
    });

    window.addEventListener('mousemove', (e: MouseEvent) => {
      const dx = e.clientX - this.lastMouse.x;
      const dy = e.clientY - this.lastMouse.y;
      this.lastMouse = { x: e.clientX, y: e.clientY };

      if (this.isRotating) {
        this.dragDistance += Math.abs(dx) + Math.abs(dy);
        this.targetAngle -= dx * 0.005;
        this.targetPitch += dy * 0.005;
        this.targetPitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.targetPitch));
      }

      if (this.isPanning) {
        const panSpeed = this.distance * 0.002;
        const sin = Math.sin(this.angle);
        const cos = Math.cos(this.angle);
        this.targetTarget.x -= (cos * dx + sin * dy) * panSpeed;
        this.targetTarget.z += (sin * dx - cos * dy) * panSpeed;
      }
    });

    window.addEventListener('mouseup', (e: MouseEvent) => {
      if (e.button === 0) this.isRotating = false;
      if (e.button === 1) this.isPanning = false;
    });

    // ─── Touch gestures ──────────────────────────────────
    // 1 finger = rotate, 2 fingers = pinch-zoom + pan
    el.addEventListener('touchstart', (e: TouchEvent) => {
      this.touchFingers = e.touches.length;
      if (e.touches.length === 1) {
        this.isRotating = true;
        this.isPanning = false;
        this.lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        this.dragDistance = 0;
      } else if (e.touches.length === 2) {
        this.isRotating = false;
        this.isPanning = true;
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        this.lastTouchDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
        this.lastTouchCenter = {
          x: (t0.clientX + t1.clientX) / 2,
          y: (t0.clientY + t1.clientY) / 2,
        };
        // Override auto-follow
        if (this.autoFollow) {
          this.autoFollowOverride = true;
          this.autoFollowOverrideTimer = 3;
        }
      }
    }, { passive: true });

    el.addEventListener('touchmove', (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 1 && this.touchFingers === 1) {
        // Single finger: rotate camera
        const dx = e.touches[0].clientX - this.lastMouse.x;
        const dy = e.touches[0].clientY - this.lastMouse.y;
        this.lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        this.dragDistance += Math.abs(dx) + Math.abs(dy);
        this.targetAngle -= dx * 0.006;
        this.targetPitch += dy * 0.006;
        this.targetPitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.targetPitch));
      } else if (e.touches.length === 2) {
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        // Pinch zoom
        const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
        const deltaDist = this.lastTouchDist - dist;
        this.targetDistance += deltaDist * 0.08;
        this.targetDistance = Math.max(this.minDistance, Math.min(this.maxDistance, this.targetDistance));
        this.lastTouchDist = dist;
        // Two-finger pan
        const cx = (t0.clientX + t1.clientX) / 2;
        const cy = (t0.clientY + t1.clientY) / 2;
        const panDx = cx - this.lastTouchCenter.x;
        const panDy = cy - this.lastTouchCenter.y;
        this.lastTouchCenter = { x: cx, y: cy };
        const panSpeed = this.distance * 0.003;
        const sin = Math.sin(this.angle);
        const cos = Math.cos(this.angle);
        this.targetTarget.x -= (cos * panDx + sin * panDy) * panSpeed;
        this.targetTarget.z += (sin * panDx - cos * panDy) * panSpeed;
      }
    }, { passive: false });

    el.addEventListener('touchend', (e: TouchEvent) => {
      this.touchFingers = e.touches.length;
      if (e.touches.length === 0) {
        this.isRotating = false;
        this.isPanning = false;
      } else if (e.touches.length === 1) {
        // Transitioned from 2 → 1 finger: reset to rotate
        this.isPanning = false;
        this.isRotating = true;
        this.lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    }, { passive: true });

    // WASD / arrow keys for panning
    const keysDown = new Set<string>();
    window.addEventListener('keydown', (e: KeyboardEvent) => keysDown.add(e.key.toLowerCase()));
    window.addEventListener('keyup', (e: KeyboardEvent) => keysDown.delete(e.key.toLowerCase()));

    // Continuous key panning via interval
    setInterval(() => {
      const panSpeed = 0.8;
      const sin = Math.sin(this.angle);
      const cos = Math.cos(this.angle);
      const panKeys = ['a', 'd', 'w', 's', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown'];
      const isPanningKeys = panKeys.some(k => keysDown.has(k));

      if (isPanningKeys && this.autoFollow) {
        this.autoFollowOverride = true;
        this.autoFollowOverrideTimer = 3;
      }

      if (keysDown.has('a') || keysDown.has('arrowleft')) {
        this.targetTarget.x -= cos * panSpeed;
        this.targetTarget.z += sin * panSpeed;
      }
      if (keysDown.has('d') || keysDown.has('arrowright')) {
        this.targetTarget.x += cos * panSpeed;
        this.targetTarget.z -= sin * panSpeed;
      }
      if (keysDown.has('w') || keysDown.has('arrowup')) {
        this.targetTarget.x -= sin * panSpeed;
        this.targetTarget.z -= cos * panSpeed;
      }
      if (keysDown.has('s') || keysDown.has('arrowdown')) {
        this.targetTarget.x += sin * panSpeed;
        this.targetTarget.z += cos * panSpeed;
      }
    }, 16);
  }

  /** Returns true if the last left-click was a drag (not a simple click) */
  wasDragging(): boolean {
    return this.dragDistance > 5;
  }

  /** Trigger screen shake (intensity 0-1, duration in seconds) */
  shake(intensity: number, duration: number): void {
    this.shakeIntensity = intensity;
    this.shakeDuration = duration;
    this.shakeTimer = duration;
  }

  /** Toggle auto-follow mode (camera tracks enemies during waves) */
  setAutoFollow(enabled: boolean): void {
    this.autoFollow = enabled;
    this.autoFollowOverride = false;
    this.autoFollowOverrideTimer = 0;
    if (!enabled) {
      this.autoFollowTarget = null;
    }
  }

  /** Returns whether auto-follow is currently enabled */
  isAutoFollow(): boolean {
    return this.autoFollow;
  }

  /** Set the world position to auto-follow (typically center of enemies) */
  setAutoFollowTarget(target: THREE.Vector3): void {
    this.autoFollowTarget = target;
  }

  update(): void {
    // Tick auto-follow override timer
    if (this.autoFollowOverride && this.autoFollowOverrideTimer > 0) {
      this.autoFollowOverrideTimer -= 0.016;
      if (this.autoFollowOverrideTimer <= 0) {
        this.autoFollowOverride = false;
      }
    }

    // Auto-follow: smoothly lerp camera target toward enemy center
    if (this.autoFollow && this.autoFollowTarget && !this.autoFollowOverride) {
      const followLerp = 0.03;
      this.targetTarget.x += (this.autoFollowTarget.x - this.targetTarget.x) * followLerp;
      this.targetTarget.z += (this.autoFollowTarget.z - this.targetTarget.z) * followLerp;
    }

    // Smooth interpolation toward target values
    const lerp = 0.12;
    this.angle += (this.targetAngle - this.angle) * lerp;
    this.pitch += (this.targetPitch - this.pitch) * lerp;
    this.distance += (this.targetDistance - this.distance) * lerp;
    this.target.lerp(this.targetTarget, lerp);

    this.updateCamera();

    // Apply screen shake
    if (this.shakeTimer > 0) {
      this.shakeTimer -= 0.016;
      const t = this.shakeTimer / this.shakeDuration;
      const magnitude = this.shakeIntensity * t;
      this.camera.position.x += (Math.random() - 0.5) * magnitude;
      this.camera.position.y += (Math.random() - 0.5) * magnitude * 0.5;
      this.camera.position.z += (Math.random() - 0.5) * magnitude;
    }
  }

  private updateCamera(): void {
    const x = this.target.x + this.distance * Math.sin(this.pitch) * Math.sin(this.angle);
    const y = this.target.y + this.distance * Math.cos(this.pitch);
    const z = this.target.z + this.distance * Math.sin(this.pitch) * Math.cos(this.angle);

    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.target);
  }
}
