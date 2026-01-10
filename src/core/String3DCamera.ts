import { I3DEngine, I3DVector3, I3DCamera } from "./abstractions/I3DEngine";

export type CameraMode = "orthographic" | "perspective";

export class String3DCamera {
  private scaleCache = new Map<number, number>();
  private _camera: I3DCamera;
  private _position: I3DVector3;
  private _width = 1;
  private _height = 1;
  private engine: I3DEngine;
  private mode: CameraMode;
  private perspectiveFov: number;

  constructor(
    engine: I3DEngine,
    mode: CameraMode = "perspective",
    fov = 50,
    near = 0.1,
    far = 10000
  ) {
    this.engine = engine;
    this.mode = mode;
    this.perspectiveFov = fov;

    if (mode === "orthographic") {
      this._camera = engine.createOrthographicCamera(-1, 1, 1, -1, near, far);
    } else {
      this._camera = engine.createPerspectiveCamera(fov, 1, near, far);
    }

    this._position = engine.createVector3(0, 0, 1000);
    this.update();
  }

  public get camera(): I3DCamera {
    return this._camera;
  }

  public resize(width: number, height: number): void {
    this._width = width;
    this._height = height;

    if (this.mode === "orthographic") {
      const ortho = this._camera as any;
      ortho.left = -width / 2;
      ortho.right = width / 2;
      ortho.top = height / 2;
      ortho.bottom = -height / 2;
    } else {
      this._camera.aspect = width / height;
    }

    this.update();
  }

  public setPosition(x: number, y: number, z: number): void {
    this._position.set(x, y, z);
    this._camera.position.copy(this._position);
    this.update();
  }

  public lookAt(x: number, y: number, z: number): void {
    this._camera.lookAt(x, y, z);
    this.update();
  }

  public update(): void {
    this._camera.updateProjectionMatrix();
    (this._camera as any).updateMatrixWorld?.();
  }

  public screenToWorld(screenX: number, screenY: number, z = 0): I3DVector3 {
    if (this.mode === "orthographic") {
      const x = screenX - this._width / 2;
      const y = -(screenY - this._height / 2);
      return this.engine.createVector3(x, y, z);
    } else {
      const { width, height } = this.getFrustumSizeAt(z);
      const normalizedX = screenX / this._width;
      const normalizedY = screenY / this._height;
      const x = (normalizedX - 0.5) * width;
      const y = -(normalizedY - 0.5) * height;
      return this.engine.createVector3(x, y, z);
    }
  }

  public getFrustumSizeAt(z: number): { width: number; height: number } {
    if (this.mode === "orthographic") {
      return { width: this._width, height: this._height };
    }

    const fov = this.engine.degToRad(this.perspectiveFov);
    const distance = Math.abs(z - this._camera.position.z);
    const height = 2 * Math.tan(fov / 2) * distance;
    const width = height * this._camera.aspect;
    return { width, height };
  }

  public getScaleAtZ(z: number, viewportHeight: number): number {
    if (this.mode === "orthographic") {
      return 1;
    }

    const roundedZ = Math.round(z * 1000) / 1000;
    if (this.scaleCache.has(roundedZ)) {
      return this.scaleCache.get(roundedZ)!;
    }

    const { height } = this.getFrustumSizeAt(z);
    const scale = height / viewportHeight;
    this.scaleCache.set(roundedZ, scale);
    return scale;
  }

  public clearScaleCache(): void {
    this.scaleCache.clear();
  }

  public getMode(): CameraMode {
    return this.mode;
  }

  public getPerspectiveFov(): number {
    return this.perspectiveFov;
  }

  public getPositionZ(): number {
    return this._position.z;
  }
}
