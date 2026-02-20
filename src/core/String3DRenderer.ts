import {
  I3DEngine,
  I3DLayerIsolationState,
  I3DRenderer,
  I3DObject,
  I3DPostProcessRuntime,
  I3DRenderTarget,
} from "./abstractions/I3DEngine";
import { resolvePostProcessRuntime } from "./abstractions/engineCapabilities";
import { String3DCamera } from "./String3DCamera";
import { String3DScene } from "./String3DScene";
import { String3DFilterPipeline } from "./filters/String3DFilterPipeline";
import type { String3DFilterTarget } from "./filters/String3DFilterTypes";
import type { String3DFilterEffect } from "./filters/String3DFilterTypes";

type FilterCacheEntry = {
  target: I3DRenderTarget;
  effectsKey: string;
  lastUsedFrame: number;
  qualityScale: number;
};

export class String3DRenderer {
  private _container: HTMLElement;
  private _renderer: I3DRenderer;
  private _width: number;
  private _height: number;
  private engine: I3DEngine;
  private postProcessRuntime: I3DPostProcessRuntime | null;
  private filterPipeline: String3DFilterPipeline | null = null;
  private filterCache: Map<string, FilterCacheEntry> = new Map();
  private frameId = 0;
  private lastFrameTime = performance.now();
  private avgFrameMs = 16.7;
  private qualityScale = 1;
  private lastQualityChange = 0;
  private filterLayer = 1;

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
    const configuredPixelRatio = this.engine.getRecommendedPixelRatio?.();
    const pixelRatio =
      typeof configuredPixelRatio === "number" && Number.isFinite(configuredPixelRatio)
        ? Math.max(0.1, configuredPixelRatio)
        : 1;
    this._renderer.setPixelRatio(pixelRatio);
    this._renderer.setSize(width, height);
    this.engine.configureRenderer?.(this._renderer, {
      width,
      height,
      pixelRatio,
      container: this._container,
    });

    this.postProcessRuntime = resolvePostProcessRuntime(this.engine, this._renderer);
  }

  public attach(): void {
    this._container.appendChild(this._renderer.domElement);
  }

  public render(
    scene: String3DScene,
    camera: String3DCamera,
    filterTargets: String3DFilterTarget[] = [],
  ): void {
    if (filterTargets.length === 0) {
      this._renderer.render(scene.getScene(), camera.camera);
      return;
    }

    const pipeline = this.ensureFilterPipeline();
    if (!pipeline?.isSupported()) {
      this._renderer.render(scene.getScene(), camera.camera);
      return;
    }

    this.frameId += 1;
    this.updateQuality(filterTargets.length, pipeline);

    const allObjects = scene.getAllObjects();
    const visibility = new Map<I3DObject, boolean | undefined>();
    allObjects.forEach((obj) => {
      const anyObj = obj.object as any;
      if ("visible" in anyObj) {
        visibility.set(obj.object, anyObj.visible);
      }
    });

    const filteredSet = new Set<I3DObject>();
    filterTargets.forEach((target) => {
      this.collectSubtreeObjects(target.object, filteredSet);
    });

    allObjects.forEach((obj) => {
      if (filteredSet.has(obj.object)) {
        this.setVisible(obj.object, false);
      }
    });

    const rendererAny = this._renderer as any;
    const prevAutoClear = rendererAny.autoClear;
    rendererAny.autoClear = true;
    this.postProcessRuntime?.setRenderTarget(this._renderer, null);
    this.postProcessRuntime?.clear(this._renderer, true, true, true);
    this._renderer.render(scene.getScene(), camera.camera);

    rendererAny.autoClear = false;

    allObjects.forEach((obj) => {
      const originalVisible = visibility.get(obj.object);
      if (typeof originalVisible !== "undefined") {
        this.setVisible(obj.object, originalVisible);
      }
    });

    const lights = allObjects.filter((obj) => obj.type.endsWith("Light"));
    const supportsLayerIsolation =
      this.engine.supportsObjectLayerIsolation?.(
        camera.camera,
        allObjects.map((entry) => entry.object),
      ) === true &&
      typeof this.engine.beginObjectLayerIsolation === "function" &&
      typeof this.engine.endObjectLayerIsolation === "function";
    let usedVisibilityFallback = false;

    filterTargets.forEach((target) => {
      const cache = this.filterCache.get(target.object.id);
      const canUseCache =
        !target.dirty &&
        cache &&
        cache.effectsKey === target.effectsKey &&
        cache.qualityScale === this.qualityScale;

      if (canUseCache) {
        cache.lastUsedFrame = this.frameId;
        pipeline.renderToScreen(cache.target);
        return;
      }

      const effects = this.injectEffectContext(
        target.object.el as HTMLElement | undefined,
        target.effects,
      );

      const allowed = new Set<I3DObject>();
      this.collectSubtreeObjects(target.object, allowed);

      let isolationState: I3DLayerIsolationState | null = null;
      if (supportsLayerIsolation) {
        const subtree = target.object.getSubtreeObjects();
        isolationState =
          this.engine.beginObjectLayerIsolation?.(
            camera.camera,
            subtree,
            lights.map((entry) => entry.object),
            this.filterLayer,
          ) || null;
      }

      if (!isolationState) {
        usedVisibilityFallback = true;
        allObjects.forEach((obj) => {
          const originalVisible = visibility.get(obj.object);
          if (originalVisible === false) {
            this.setVisible(obj.object, false);
            return;
          }

          if (obj.type.endsWith("Light")) {
            this.setVisible(obj.object, true);
            return;
          }

          this.setVisible(obj.object, allowed.has(obj.object));
        });
      }

      const input = pipeline.acquireTarget();
      this.postProcessRuntime?.setRenderTarget(this._renderer, input);
      this.postProcessRuntime?.clear(this._renderer, true, true, true);
      this._renderer.render(scene.getScene(), camera.camera);

      const output = pipeline.applyFilters(input, effects, this.qualityScale);
      this.postProcessRuntime?.setRenderTarget(this._renderer, null);
      pipeline.renderToScreen(output);

      if (isolationState) {
        this.engine.endObjectLayerIsolation?.(camera.camera, isolationState);
      }

      if (output !== input) {
        pipeline.releaseTarget(input);
      }

      const entry: FilterCacheEntry = {
        target: output,
        effectsKey: target.effectsKey,
        lastUsedFrame: this.frameId,
        qualityScale: this.qualityScale,
      };
      const existing = this.filterCache.get(target.object.id);
      if (existing && existing.target !== output) {
        pipeline.releaseTarget(existing.target);
      }
      this.filterCache.set(target.object.id, entry);
    });

    if (usedVisibilityFallback) {
      allObjects.forEach((obj) => {
        const originalVisible = visibility.get(obj.object);
        if (typeof originalVisible !== "undefined") {
          this.setVisible(obj.object, originalVisible);
        }
      });
    }

    rendererAny.autoClear = prevAutoClear;

    this.evictCache();
  }

  public resize(camera: String3DCamera): void {
    const { width, height } = this._container.getBoundingClientRect();
    this._width = width;
    this._height = height;
    this._renderer.setSize(width, height);
    camera.resize(width, height);
    this.filterPipeline?.resize(width, height);
    this.invalidateFilterCache();
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
    this.filterPipeline?.dispose();
    this.filterCache.clear();
  }

  private ensureFilterPipeline(): String3DFilterPipeline | null {
    const runtime = this.postProcessRuntime;
    if (!runtime || !this.canCreateFilterPipeline()) {
      return null;
    }
    if (!this.filterPipeline) {
      this.filterPipeline = new String3DFilterPipeline(
        this.engine,
        this._renderer,
        runtime,
        this._width,
        this._height,
      );
      this.filterPipeline.setScale(this.qualityScale);
    }
    return this.filterPipeline;
  }

  private canCreateFilterPipeline(): boolean {
    return !!this.postProcessRuntime;
  }

  private collectSubtreeObjects(
    object: import("./String3DObject").String3DObject,
    set: Set<I3DObject>,
  ): void {
    set.add(object.object);
    object.children.forEach((child) => this.collectSubtreeObjects(child, set));
  }

  private setVisible(object: I3DObject, visible: boolean): void {
    const anyObj = object as any;
    if ("visible" in anyObj) {
      anyObj.visible = visible;
    }
  }

  private getFilterCenter(el: HTMLElement | undefined): [number, number] {
    if (!el || !this._width || !this._height) return [0.5, 0.5];
    const cached = (el as any).__layoutCache;
    const rect = cached ? cached.rect : el.getBoundingClientRect();
    const cx = (rect.left + rect.width / 2) / this._width;
    const cy = 1 - (rect.top + rect.height / 2) / this._height;
    const clamp = (value: number) => Math.max(0, Math.min(1, value));
    return [clamp(cx), clamp(cy)];
  }

  private injectEffectContext(
    el: HTMLElement | undefined,
    effects: String3DFilterEffect[],
  ): String3DFilterEffect[] {
    if (!effects.some((effect) => effect.type === "custom")) {
      return effects;
    }
    const center = this.getFilterCenter(el);
    let changed = false;
    const next = effects.map((effect) => {
      if (effect.type !== "custom") return effect;
      if (effect.uniforms && "uCenter" in effect.uniforms) return effect;
      const uniforms = { ...(effect.uniforms || {}), uCenter: center };
      changed = true;
      return { ...effect, uniforms };
    });
    return changed ? next : effects;
  }

  private updateQuality(filterCount: number, pipeline: String3DFilterPipeline): void {
    const now = performance.now();
    const dt = Math.max(0.1, now - this.lastFrameTime);
    this.lastFrameTime = now;
    this.avgFrameMs = this.avgFrameMs * 0.9 + dt * 0.1;

    const fps = 1000 / this.avgFrameMs;
    const countScale = Math.max(0.75, 1 - Math.min(0.4, filterCount * 0.03));
    let targetScale = countScale;

    if (fps < 48) targetScale = Math.max(0.75, countScale - 0.1);
    if (fps < 40) targetScale = Math.max(0.75, countScale - 0.2);
    if (fps > 58) targetScale = Math.min(1, countScale + 0.05);

    if (Math.abs(targetScale - this.qualityScale) >= 0.05 && now - this.lastQualityChange > 300) {
      this.qualityScale = targetScale;
      this.lastQualityChange = now;
      pipeline.setScale(this.qualityScale);
      this.invalidateFilterCache();
    }
  }

  private invalidateFilterCache(): void {
    if (!this.filterPipeline) return;
    this.filterCache.forEach((entry) => {
      this.filterPipeline?.releaseTarget(entry.target);
    });
    this.filterCache.clear();
  }

  private evictCache(): void {
    if (!this.filterPipeline) return;
    const maxAge = 120;
    this.filterCache.forEach((entry, key) => {
      if (this.frameId - entry.lastUsedFrame > maxAge) {
        this.filterPipeline?.releaseTarget(entry.target);
        this.filterCache.delete(key);
      }
    });
  }
}
