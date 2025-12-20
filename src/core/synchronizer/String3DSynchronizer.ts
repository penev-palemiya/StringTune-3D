import { String3DCamera } from "../String3DCamera";
import { String3DObject } from "../String3DObject";
import { I3DEngine } from "../abstractions/I3DEngine";
import { GroupSynchronizer } from "./GroupSynchronizer";
import { LightSynchronizer } from "./LightSynchronizer";
import { MeshSynchronizer } from "./MeshSynchronizer";
import type { String3DObjectSyncStrategy } from "./String3DObjectSyncStrategy";

export class String3DSynchronizer {
  private strategies: Map<string, String3DObjectSyncStrategy> = new Map();

  constructor(
    public camera: String3DCamera,
    public viewportWidth: number,
    public viewportHeight: number,
    public engine: I3DEngine
  ) {
    this.strategies.set("box", new MeshSynchronizer());
    this.strategies.set("sphere", new MeshSynchronizer());
    this.strategies.set("plane", new MeshSynchronizer());
    this.strategies.set("cylinder", new MeshSynchronizer());
    this.strategies.set("model", new MeshSynchronizer());
    this.strategies.set("group", new GroupSynchronizer());
    this.strategies.set("pointLight", new LightSynchronizer());
    this.strategies.set("ambientLight", new LightSynchronizer());
    this.strategies.set("directionalLight", new LightSynchronizer());
  }

  public syncElement(el: HTMLElement, object: String3DObject, parentData: any): any {
    const strategy = this.strategies.get(object.type);
    if (!strategy) {
      console.warn(`[String3D Sync] No strategy for type "${object.type}"`);
      return null;
    }

    return strategy.sync(
      el,
      object,
      {
        camera: this.camera,
        viewportWidth: this.viewportWidth,
        viewportHeight: this.viewportHeight,
        engine: this.engine,
      },
      parentData
    );
  }

  public updateViewportSize(width: number, height: number): void {
    this.viewportWidth = width;
    this.viewportHeight = height;
  }
}
