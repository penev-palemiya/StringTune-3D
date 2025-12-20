import { I3DEngine, I3DRenderer } from "./abstractions/I3DEngine";
import { String3DCamera } from "./String3DCamera";
import { String3DScene } from "./String3DScene";

export class String3DRenderer {
  private _container: HTMLElement;
  private _renderer: I3DRenderer;
  private _width: number;
  private _height: number;
  private engine: I3DEngine;

  constructor(container: HTMLElement, engine: I3DEngine) {
    this.engine = engine;
    this._container = container;
    const { width, height } = container.getBoundingClientRect();
    this._width = width;
    this._height = height;

    this._renderer = engine.createRenderer({
      antialias: true,
      alpha: true,
      logarithmicDepthBuffer: true,
    });
    this._renderer.setPixelRatio(window.devicePixelRatio);
    this._renderer.setSize(width, height);
  }

  public attach(): void {
    this._container.appendChild(this._renderer.domElement);
  }

  public render(scene: String3DScene, camera: String3DCamera): void {
    this._renderer.render(scene.getScene(), camera.camera);
  }

  public resize(camera: String3DCamera): void {
    const { width, height } = this._container.getBoundingClientRect();
    this._width = width;
    this._height = height;
    this._renderer.setSize(width, height);
    camera.resize(width, height);
  }

  public get width(): number {
    return this._width;
  }

  public get height(): number {
    return this._height;
  }

  public get renderer(): I3DRenderer {
    return this._renderer;
  }

  public destroy(): void {
    this._renderer.dispose();
  }
}
