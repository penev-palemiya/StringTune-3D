import {
  I3DCustomFilterRegistryRuntime,
  I3DEngine,
  I3DPostProcessPipelineRuntime,
  I3DPostProcessRuntime,
  I3DRenderer,
  I3DRenderTarget,
} from "../abstractions/I3DEngine";
import type { String3DFilterChain } from "./String3DFilterTypes";
import { String3DCustomFilterRegistry } from "./String3DCustomFilter";

export class String3DFilterPipeline {
  private readonly pipeline: I3DPostProcessPipelineRuntime | null;

  constructor(
    engine: I3DEngine,
    renderer: I3DRenderer,
    runtime: I3DPostProcessRuntime,
    width: number,
    height: number,
  ) {
    const customFilterRegistry: I3DCustomFilterRegistryRuntime =
      engine.getCustomFilterRegistry?.() || String3DCustomFilterRegistry;
    this.pipeline =
      runtime.createPipeline?.({
        engine,
        renderer,
        width,
        height,
        customFilterRegistry,
      }) || null;
  }

  public isSupported(): boolean {
    return this.pipeline?.isSupported() ?? false;
  }

  public resize(width: number, height: number): void {
    this.pipeline?.resize(width, height);
  }

  public setScale(scale: number): void {
    this.pipeline?.setScale(scale);
  }

  public applyFilters(
    input: I3DRenderTarget,
    effects: String3DFilterChain,
    quality = 1,
  ): I3DRenderTarget {
    return this.pipeline?.applyFilters(input, effects, quality) || input;
  }

  public acquireTarget(): I3DRenderTarget {
    if (!this.pipeline) {
      throw new Error("[String3D] Post-process pipeline runtime is not available.");
    }
    return this.pipeline.acquireTarget();
  }

  public releaseTarget(target: I3DRenderTarget): void {
    this.pipeline?.releaseTarget(target);
  }

  public renderToScreen(input: I3DRenderTarget): void {
    this.pipeline?.renderToScreen(input);
  }

  public dispose(): void {
    this.pipeline?.dispose();
  }
}
