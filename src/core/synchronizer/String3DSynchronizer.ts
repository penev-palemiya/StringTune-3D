import { String3DCamera } from "../String3DCamera";
import { String3DObject } from "../String3DObject";
import { I3DEngine } from "../abstractions/I3DEngine";
import { GroupSynchronizer } from "./GroupSynchronizer";
import { LightSynchronizer } from "./LightSynchronizer";
import { MeshSynchronizer } from "./MeshSynchronizer";
import { ParticlesSynchronizer } from "./ParticlesSynchronizer";
import { TextSynchronizer } from "./TextSynchronizer";
import type { String3DObjectSyncStrategy } from "./String3DObjectSyncStrategy";

export class String3DSynchronizer {
  private strategies: Map<string, String3DObjectSyncStrategy> = new Map();
  private styleReadIntervalMs = 0;
  private layoutReadIntervalMs = 0;

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
    this.strategies.set("spotLight", new LightSynchronizer());
    this.strategies.set("hemisphereLight", new LightSynchronizer());
    this.strategies.set("particles", new ParticlesSynchronizer());
    this.strategies.set("text", new TextSynchronizer());
  }

  public syncElement(
    el: HTMLElement,
    object: String3DObject,
    parentData: any,
    hints?: { dirtySet?: Set<HTMLElement> | null; forceSync?: boolean }
  ): any {
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
        dirtySet: hints?.dirtySet,
        forceSync: hints?.forceSync,
        styleReadIntervalMs: this.styleReadIntervalMs,
        layoutReadIntervalMs: this.layoutReadIntervalMs,
      },
      parentData
    );
  }

  public setSyncOptions(options: { styleReadIntervalMs?: number; layoutReadIntervalMs?: number }): void {
    this.styleReadIntervalMs = Math.max(0, options.styleReadIntervalMs ?? 0);
    this.layoutReadIntervalMs = Math.max(0, options.layoutReadIntervalMs ?? 0);
  }

  public updateViewportSize(width: number, height: number): void {
    this.viewportWidth = width;
    this.viewportHeight = height;
  }
}
