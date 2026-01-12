import { StringModule } from "@fiddle-digital/string-tune";
import { StringObject } from "@fiddle-digital/string-tune";
import { StringData } from "@fiddle-digital/string-tune";
import { StringContext } from "@fiddle-digital/string-tune";
import { String3DCamera } from "../core/String3DCamera";
import { String3DRenderer } from "../core/String3DRenderer";
import { String3DScene } from "../core/String3DScene";
import { String3DSynchronizer } from "../core/synchronizer/String3DSynchronizer";
import { I3DEngineProvider } from "../core/abstractions/I3DEngineProvider";
import { I3DEngine, I3DModelLoader } from "../core/abstractions/I3DEngine";
import { String3DObject } from "../core/String3DObject";
import { DirtySyncManager } from "./string3d/DirtySyncManager";
import { FilterController } from "./string3d/FilterController";
import { StyleReader } from "./string3d/styleUtils";
import { String3DFontRegistry } from "../core/text";

export interface String3DOptions {
  hideHTML?: boolean;
  container?: string | HTMLElement;
  zIndex?: number;
  modelLoaderType?: string;
  modelLoader?: I3DModelLoader;
  modelLoaderFactory?: (engine: I3DEngine, type?: string) => I3DModelLoader;
  useDirtySync?: boolean;
  styleReadIntervalMs?: number;
  layoutReadIntervalMs?: number;
}

export class String3D extends StringModule {
  private static provider: I3DEngineProvider | null = null;

  private renderer: String3DRenderer | null = null;
  private camera: String3DCamera | null = null;
  private scene: String3DScene | null = null;
  private synchronizer: String3DSynchronizer | null = null;
  private engine: I3DEngine | null = null;
  private canvasContainer: HTMLElement | null = null;
  private isLoading: Map<string, boolean> = new Map();
  private options: String3DOptions;
  private useDirtySync = false;
  private dirtySyncManager: DirtySyncManager;
  private lastSyncData: WeakMap<String3DObject, { scale: number }> = new WeakMap();
  private filterController: FilterController;
  private needsInitialResize = true;

  public static setProvider(provider: I3DEngineProvider): void {
    String3D.provider = provider;
  }

  public static registerFont(name: string, url: string, options: { default?: boolean } = {}): void {
    String3DFontRegistry.register(name, url);
    if (options.default) {
      String3DFontRegistry.setDefault(name);
    }
  }

  public static setDefaultFont(name: string): void {
    String3DFontRegistry.setDefault(name);
  }

  constructor(context: StringContext) {
    super(context);
    this.htmlKey = "3d";
    this.options = this.buildOptionsFromSettings();
    this.dirtySyncManager = new DirtySyncManager([
      "style",
      "class",
      "string-3d",
      "string-3d-model-fit",
      "string-3d-model-scale",
    ]);
    this.filterController = new FilterController((value) =>
      this.tools.easingFunction.process({ easing: value })
    );

    this.attributesToMap = [
      ...this.attributesToMap,
      { key: "3d", type: "string", fallback: "box" },
      { key: "3d-model", type: "string", fallback: "" },
      { key: "3d-segments", type: "number", fallback: 32 },
      { key: "3d-segments-width", type: "number", fallback: 32 },
      { key: "3d-segments-height", type: "number", fallback: 32 },
      { key: "3d-model-loader", type: "string", fallback: "" },
      { key: "3d-model-scale", type: "number", fallback: 1 },
      { key: "3d-model-center", type: "boolean", fallback: false },
      { key: "3d-model-fit", type: "string", fallback: "contain" },
    ];
  }

  override canConnect(object: StringObject): boolean {
    return super.canConnect(object);
  }

  override initializeObject(
    globalId: number,
    object: StringObject,
    element: HTMLElement,
    attributes: Record<string, any>
  ): void {
    super.initializeObject(globalId, object, element, attributes);

    object.setProperty("parentId", null);
    const parentElement = element.parentElement?.closest(
      '[string-3d="group"]'
    ) as HTMLElement | null;
    if (parentElement) {
      const parentId = parentElement.getAttribute("string-id");
      if (parentId) {
        object.setProperty("parentId", parentId);
        object.setProperty("parent", parentElement);
      }
    }
  }

  override onResize(): void {
    if (this.renderer && this.camera && this.synchronizer) {
      this.renderer.resize(this.camera);
      this.synchronizer.updateViewportSize(this.renderer.width, this.renderer.height);
      this.camera.clearScaleCache();
      if (this.useDirtySync) {
        this.dirtySyncManager.markAllDirty();
      }
    }
  }

  override onInit(): void {
    this.options = this.buildOptionsFromSettings();
    if (!String3D.provider) {
      return;
    }

    this.engine = String3D.provider.getEngine();
    this.canvasContainer = this.createOrGetContainer();
    this.registerTypedProperties();
    this.injectCSS();
    this.useDirtySync = !!this.options.useDirtySync;
    if (this.useDirtySync) {
      this.dirtySyncManager.enable();
    }

    this.renderer = new String3DRenderer(this.canvasContainer, this.engine);
    this.renderer.attach();

    this.camera = new String3DCamera(this.engine, "orthographic");
    this.camera.setPosition(0, 0, 1000);
    this.camera.resize(this.renderer.width, this.renderer.height);

    const modelLoader = this.resolveModelLoader();
    const modelLoaderFactory = this.resolveModelLoaderFactory();
    this.scene = new String3DScene(this.engine, {
      modelLoader,
      modelLoaderFactory,
    });
    this.scene.getScene().add(this.camera.camera);

    this.synchronizer = new String3DSynchronizer(
      this.camera,
      this.renderer.width,
      this.renderer.height,
      this.engine
    );
    this.synchronizer.setSyncOptions({
      styleReadIntervalMs: this.options.styleReadIntervalMs,
      layoutReadIntervalMs: this.options.layoutReadIntervalMs,
    });

    console.info(`[String3D] Initialized with: ${String3D.provider.getName()}`);
  }

  override onSettingsChange(): void {
    this.options = this.buildOptionsFromSettings();
    const shouldUseDirtySync = !!this.options.useDirtySync;
    if (shouldUseDirtySync && !this.useDirtySync) {
      this.useDirtySync = true;
      this.dirtySyncManager.enable();
      if (this.scene) {
        this.dirtySyncManager.observeScene(this.scene.rootObjects);
      }
      this.dirtySyncManager.markAllDirty();
    } else if (!shouldUseDirtySync && this.useDirtySync) {
      this.useDirtySync = false;
      this.dirtySyncManager.disable();
    }

    this.synchronizer?.setSyncOptions({
      styleReadIntervalMs: this.options.styleReadIntervalMs,
      layoutReadIntervalMs: this.options.layoutReadIntervalMs,
    });
  }

  private buildOptionsFromSettings(): String3DOptions {
    return {
      hideHTML: this.getSettingValue("hideHTML", false),
      container: this.getSettingValue("container", undefined),
      zIndex: this.getSettingValue("zIndex", 1),
      modelLoaderType: this.getSettingValue("modelLoaderType", undefined),
      modelLoader: this.getSettingValue("modelLoader", undefined),
      modelLoaderFactory: this.getSettingValue("modelLoaderFactory", undefined),
      useDirtySync: this.getSettingValue("useDirtySync", false),
      styleReadIntervalMs: this.getSettingValue("styleReadIntervalMs", 0),
      layoutReadIntervalMs: this.getSettingValue("layoutReadIntervalMs", 0),
    };
  }

  private getSettingValue<T>(key: string, fallback: T): T {
    if (!this.settings || !(key in this.settings)) return fallback;
    return this.settings[key] as T;
  }

  private resolveModelLoader(): I3DModelLoader | undefined {
    if (!this.engine) return undefined;
    if (this.options.modelLoader) return this.options.modelLoader;
    if (this.options.modelLoaderFactory) return undefined;
    if (this.options.modelLoaderType) {
      try {
        return this.engine.createModelLoader(this.options.modelLoaderType);
      } catch (error) {}
    }
    return undefined;
  }

  private resolveModelLoaderFactory():
    | ((engine: I3DEngine, type?: string) => I3DModelLoader)
    | undefined {
    if (!this.engine) return undefined;
    if (this.options.modelLoaderFactory) return this.options.modelLoaderFactory;
    if (this.options.modelLoaderType) {
      return (engine: I3DEngine, type?: string) => {
        const loaderType = type || this.options.modelLoaderType;
        if (!loaderType) {
          throw new Error("[String3D] Model loader type not provided");
        }
        return engine.createModelLoader(loaderType);
      };
    }
    return undefined;
  }

  private createOrGetContainer(): HTMLElement {
    if (this.options.container instanceof HTMLElement) {
      this.applyContainerStyles(this.options.container);
      return this.options.container;
    }

    if (typeof this.options.container === "string") {
      const existing = document.getElementById(this.options.container);
      if (existing) {
        this.applyContainerStyles(existing);
        return existing;
      }
    }

    const container = document.createElement("div");
    container.id = "string-3d-canvas";
    this.applyContainerStyles(container);
    document.body.insertBefore(container, document.body.firstChild);
    return container;
  }

  private applyContainerStyles(el: HTMLElement): void {
    Object.assign(el.style, {
      position: "fixed",
      left: "0",
      top: "0",
      width: "100vw",
      height: "100lvh",
      zIndex: String(this.options.zIndex),
      pointerEvents: "none",
    });
  }

  override onObjectConnected(object: StringObject): void {
    if (this.isLoading.has(object.id) || !this.scene) return;
    this.isLoading.set(object.id, true);

    this.scene.createFromElement(object);

    if (this.useDirtySync && object.htmlElement) {
      this.dirtySyncManager.observeElement(object.htmlElement);
      this.dirtySyncManager.markDirty(object.htmlElement);
    }

    if (this.options.hideHTML && object.htmlElement) {
      object.htmlElement.style.opacity = "0";
      object.htmlElement.style.pointerEvents = "none";
    }
  }

  override onFrame(data: StringData): void {
    if (!this.renderer || !this.scene || !this.camera || !this.synchronizer) return;

    if (this.needsInitialResize) {
      this.needsInitialResize = false;
      this.renderer.resize(this.camera);
      this.synchronizer.updateViewportSize(this.renderer.width, this.renderer.height);
    }

    const dirtySet = this.useDirtySync ? this.dirtySyncManager.getDirtySet() : null;
    const forceSync = !dirtySet || dirtySet.size === 0;

    this.batchReadLayouts(this.scene.rootObjects, forceSync, dirtySet);

    this.scene.rootObjects.forEach((obj) => {
      this.syncRecursive(obj.el, obj, { scale: 1 }, forceSync, dirtySet);
    });

    const filterTargets = this.filterController.collectTargets(
      this.scene.rootObjects,
      performance.now(),
      this.useDirtySync,
      dirtySet
    );
    this.renderer!.render(this.scene!, this.camera!, filterTargets);

    if (this.useDirtySync) {
      this.dirtySyncManager.clearDirty();
    }
  }

  private batchReadLayouts(
    rootObjects: String3DObject[],
    forceSync: boolean,
    dirtySet: Set<HTMLElement> | null
  ): void {
    const walk = (obj: String3DObject): void => {
      if (obj.el) {
        const shouldSync = forceSync || !dirtySet || dirtySet.has(obj.el);
        if (shouldSync) {
          const rect = obj.el.getBoundingClientRect();
          const width = obj.el.offsetWidth || rect.width;
          const height = obj.el.offsetHeight || rect.height;
          (obj.el as any).__layoutCache = { rect, width, height };
        }
      }
      obj.children.forEach(walk);
    };
    rootObjects.forEach(walk);
  }

  private syncRecursive(
    el: HTMLElement | undefined,
    object: String3DObject,
    parentData: any,
    forceSync: boolean,
    dirtySet: Set<HTMLElement> | null
  ): void {
    if (!this.synchronizer || !el) return;
    const shouldSync =
      object.type === "particles" ||
      object.type === "text" ||
      forceSync ||
      !dirtySet ||
      dirtySet.has(el);
    let nextParentData = parentData;

    if (shouldSync) {
      const data = this.synchronizer.syncElement(el, object, parentData, {
        dirtySet,
        forceSync,
      });
      if (data && typeof data.scale === "number") {
        this.lastSyncData.set(object, data);
        nextParentData = data;
      }
    } else {
      const cached = this.lastSyncData.get(object);
      if (cached) {
        nextParentData = cached;
      }
    }

    const forceChildren = forceSync || shouldSync;
    object.children.forEach((child) =>
      this.syncRecursive(child.el, child, nextParentData, forceChildren, dirtySet)
    );
  }

  private injectCSS(): void {
    if (document.getElementById("string-3d-styles")) return;

    const style = document.createElement("style");
    style.id = "string-3d-styles";
    style.textContent = `
      @property --translate-x { syntax: "<number>"; inherits: false; initial-value: 0; }
      @property --translate-y { syntax: "<number>"; inherits: false; initial-value: 0; }
      @property --translate-z { syntax: "<number>"; inherits: false; initial-value: 0; }
      @property --rotate-x { syntax: "<number>"; inherits: false; initial-value: 0; }
      @property --rotate-y { syntax: "<number>"; inherits: false; initial-value: 0; }
      @property --rotate-z { syntax: "<number>"; inherits: false; initial-value: 0; }
      @property --scale { syntax: "<number>"; inherits: false; initial-value: 1; }
      @property --scale-x { syntax: "<number>"; inherits: false; initial-value: 1; }
      @property --scale-y { syntax: "<number>"; inherits: false; initial-value: 1; }
      @property --scale-z { syntax: "<number>"; inherits: false; initial-value: 1; }
      @property --opacity { syntax: "<number>"; inherits: false; initial-value: 1; }
      @property --filter { syntax: "*"; inherits: false; initial-value: none; }
      @property --light-color { syntax: "<color>"; inherits: false; initial-value: #ffffff; }
      @property --light-intensity { syntax: "<number>"; inherits: false; initial-value: 1; }
      @property --light-distance { syntax: "<number>"; inherits: false; initial-value: 1000; }
      @property --light-decay { syntax: "<number>"; inherits: false; initial-value: 0; }
      @property --light-angle { syntax: "<number>"; inherits: false; initial-value: 1.0472; }
      @property --light-penumbra { syntax: "<number>"; inherits: false; initial-value: 0; }
      @property --light-ground-color { syntax: "<color>"; inherits: false; initial-value: #ffffff; }
      @property --light-target { syntax: "*"; inherits: false; initial-value: none; }
      @property --shadow-cast { syntax: "<number>"; inherits: false; initial-value: 0; }
      @property --shadow-receive { syntax: "<number>"; inherits: false; initial-value: 0; }
      @property --shadow-bias { syntax: "<number>"; inherits: false; initial-value: 0; }
      @property --shadow-map-size { syntax: "<number>"; inherits: false; initial-value: 512; }
      @property --texture-flip-y { syntax: "<number>"; inherits: false; initial-value: 1; }
      @property --texture-color-space { syntax: "*"; inherits: false; initial-value: none; }
      @property --particles-mode { syntax: "*"; inherits: false; initial-value: emitter; }
      @property --particles-count { syntax: "<number>"; inherits: false; initial-value: 300; }
      @property --particles-size { syntax: "<number>"; inherits: false; initial-value: 2; }
      @property --particles-color { syntax: "<color>"; inherits: false; initial-value: #ffffff; }
      @property --particles-opacity { syntax: "<number>"; inherits: false; initial-value: 1; }
      @property --particles-spread { syntax: "<number>"; inherits: false; initial-value: 120; }
      @property --particles-seed { syntax: "<number>"; inherits: false; initial-value: 1; }
      @property --particles-shape { syntax: "*"; inherits: false; initial-value: sphere; }
      @property --particles-fit { syntax: "<number>"; inherits: false; initial-value: 0; }
      @property --particles-model { syntax: "*"; inherits: false; initial-value: none; }
      @property --particles-model-loader { syntax: "*"; inherits: false; initial-value: none; }
      @property --particles-model-node { syntax: "*"; inherits: false; initial-value: none; }
      @property --instance-model { syntax: "*"; inherits: false; initial-value: none; }
      @property --instance-model-loader { syntax: "*"; inherits: false; initial-value: none; }
      @property --instance-model-node { syntax: "*"; inherits: false; initial-value: none; }
      @property --emit-rate { syntax: "<number>"; inherits: false; initial-value: 30; }
      @property --emit-burst { syntax: "<number>"; inherits: false; initial-value: 0; }
      @property --particle-life { syntax: "<number>"; inherits: false; initial-value: 2.5; }
      @property --particle-speed { syntax: "<number>"; inherits: false; initial-value: 40; }
      @property --particle-direction { syntax: "*"; inherits: false; initial-value: 0 1 0; }
      @property --particle-gravity { syntax: "*"; inherits: false; initial-value: 0 -30 0; }
      @property --particle-drag { syntax: "<number>"; inherits: false; initial-value: 0.1; }
      @property --particle-size-variation { syntax: "<number>"; inherits: false; initial-value: 0.6; }
      @property --particle-color-variation { syntax: "<number>"; inherits: false; initial-value: 0.2; }
      @property --instance-shape { syntax: "*"; inherits: false; initial-value: sphere; }
      @property --instance-scale { syntax: "<number>"; inherits: false; initial-value: 1; }
      @property --instance-scale-variation { syntax: "<number>"; inherits: false; initial-value: 0.5; }
      @property --instance-rotation-speed { syntax: "<number>"; inherits: false; initial-value: 0.4; }
      @property --instance-jitter { syntax: "<number>"; inherits: false; initial-value: 0.2; }
      @property --instance-flow { syntax: "<number>"; inherits: false; initial-value: 0.3; }
      @property --instance-disperse { syntax: "<number>"; inherits: false; initial-value: 0; }
      @property --instance-scatter { syntax: "<number>"; inherits: false; initial-value: 0; }
      @property --instance-scatter-x { syntax: "<number>"; inherits: false; initial-value: 0; }
      @property --instance-scatter-y { syntax: "<number>"; inherits: false; initial-value: 0; }
      @property --instance-scatter-z { syntax: "<number>"; inherits: false; initial-value: 0; }
      @property --text-depth { syntax: "<number>"; inherits: false; initial-value: 8; }
      @property --text-curve-segments { syntax: "<number>"; inherits: false; initial-value: 8; }
      @property --text-bevel-size { syntax: "<number>"; inherits: false; initial-value: 0; }
      @property --text-bevel-thickness { syntax: "<number>"; inherits: false; initial-value: 0; }
      @property --text-bevel-offset { syntax: "<number>"; inherits: false; initial-value: 0; }
      @property --text-bevel-steps { syntax: "<number>"; inherits: false; initial-value: 0; }
      @property --text-fit { syntax: "*"; inherits: false; initial-value: contain; }

      :where([string-3d]) {
        --translate-x: 0; --translate-y: 0; --translate-z: 0;
        --rotate-x: 0; --rotate-y: 0; --rotate-z: 0;
        --scale: 1; --scale-x: 1; --scale-y: 1; --scale-z: 1; --opacity: 1; --filter: none;
        --light-color: #ffffff; --light-intensity: 1; --light-distance: 1000; --light-decay: 0;
        --light-angle: 1.0472; --light-penumbra: 0; --light-ground-color: #ffffff; --light-target: none;
        --shadow-cast: 0; --shadow-receive: 0; --shadow-bias: 0; --shadow-map-size: 512;
        --texture-flip-y: 1; --texture-color-space: none;
        --particles-mode: emitter; --particles-count: 300; --particles-size: 2; --particles-color: #ffffff;
        --particles-opacity: 1; --particles-spread: 120; --particles-seed: 1; --particles-shape: sphere;
        --particles-fit: 0;
        --particles-model: none; --particles-model-loader: none; --particles-model-node: none;
        --instance-model: none; --instance-model-loader: none; --instance-model-node: none;
        --emit-rate: 30; --emit-burst: 0; --particle-life: 2.5; --particle-speed: 40;
        --particle-direction: 0 1 0; --particle-gravity: 0 -30 0; --particle-drag: 0.1;
        --particle-size-variation: 0.6; --particle-color-variation: 0.2;
        --instance-shape: sphere; --instance-scale: 1; --instance-scale-variation: 0.5;
        --instance-rotation-speed: 0.4; --instance-jitter: 0.2; --instance-flow: 0.3;
        --instance-disperse: 0;
        --instance-scatter: 0;
        --instance-scatter-x: 0; --instance-scatter-y: 0; --instance-scatter-z: 0;
        --text-depth: 8; --text-curve-segments: 8; --text-bevel-size: 0; --text-bevel-thickness: 0;
        --text-bevel-offset: 0; --text-bevel-steps: 0; --text-fit: contain;
        transform-style: preserve-3d;
      }

      [string-3d-visual="true"] {
        transform:
          translate3d(calc(var(--translate-x) * 1px), calc(var(--translate-y) * 1px), calc(var(--translate-z) * 1px))
          rotateX(calc(var(--rotate-x) * 1deg))
          rotateY(calc(var(--rotate-y) * 1deg))
          rotateZ(calc(var(--rotate-z) * 1deg))
          scale3d(calc(var(--scale) * var(--scale-x)), calc(var(--scale) * var(--scale-y)), calc(var(--scale) * var(--scale-z)));
      }
    `;
    document.head.appendChild(style);
  }

  private registerTypedProperties(): void {
    const css = (globalThis as any).CSS;
    if (!css?.registerProperty) return;

    const props: Array<{ name: string; initialValue: string }> = [
      { name: "--translate-x", initialValue: "0" },
      { name: "--translate-y", initialValue: "0" },
      { name: "--translate-z", initialValue: "0" },
      { name: "--rotate-x", initialValue: "0" },
      { name: "--rotate-y", initialValue: "0" },
      { name: "--rotate-z", initialValue: "0" },
      { name: "--scale", initialValue: "1" },
      { name: "--scale-x", initialValue: "1" },
      { name: "--scale-y", initialValue: "1" },
      { name: "--scale-z", initialValue: "1" },
      { name: "--opacity", initialValue: "1" },
      { name: "--filter", initialValue: "none" },
      { name: "--material-type", initialValue: "basic" },
      { name: "--material-color", initialValue: "#ffffff" },
      { name: "--material-metalness", initialValue: "0" },
      { name: "--material-roughness", initialValue: "1" },
      { name: "--material-emissive", initialValue: "#000000" },
      { name: "--rim-color", initialValue: "#00c8ff" },
      { name: "--rim-power", initialValue: "1.5" },
      { name: "--rim-strength", initialValue: "1" },
      { name: "--uv-strength", initialValue: "0.7" },
      { name: "--texture-map", initialValue: "none" },
      { name: "--texture-normal", initialValue: "none" },
      { name: "--texture-roughness", initialValue: "none" },
      { name: "--texture-metalness", initialValue: "none" },
      { name: "--texture-ao", initialValue: "none" },
      { name: "--light-color", initialValue: "#ffffff" },
      { name: "--light-intensity", initialValue: "1" },
      { name: "--light-distance", initialValue: "1000" },
      { name: "--light-decay", initialValue: "0" },
      { name: "--light-angle", initialValue: "1.0472" },
      { name: "--light-penumbra", initialValue: "0" },
      { name: "--light-ground-color", initialValue: "#ffffff" },
      { name: "--light-target", initialValue: "none" },
      { name: "--shadow-cast", initialValue: "0" },
      { name: "--shadow-receive", initialValue: "0" },
      { name: "--shadow-bias", initialValue: "0" },
      { name: "--shadow-map-size", initialValue: "512" },
      { name: "--texture-flip-y", initialValue: "1" },
      { name: "--texture-color-space", initialValue: "none" },
      { name: "--particles-mode", initialValue: "emitter" },
      { name: "--particles-count", initialValue: "300" },
      { name: "--particles-size", initialValue: "2" },
      { name: "--particles-color", initialValue: "#ffffff" },
      { name: "--particles-opacity", initialValue: "1" },
      { name: "--particles-spread", initialValue: "120" },
      { name: "--particles-seed", initialValue: "1" },
      { name: "--particles-shape", initialValue: "sphere" },
      { name: "--particles-fit", initialValue: "0" },
      { name: "--particles-model", initialValue: "none" },
      { name: "--particles-model-loader", initialValue: "none" },
      { name: "--particles-model-node", initialValue: "none" },
      { name: "--instance-model", initialValue: "none" },
      { name: "--instance-model-loader", initialValue: "none" },
      { name: "--instance-model-node", initialValue: "none" },
      { name: "--emit-rate", initialValue: "30" },
      { name: "--emit-burst", initialValue: "0" },
      { name: "--particle-life", initialValue: "2.5" },
      { name: "--particle-speed", initialValue: "40" },
      { name: "--particle-direction", initialValue: "0 1 0" },
      { name: "--particle-gravity", initialValue: "0 -30 0" },
      { name: "--particle-drag", initialValue: "0.1" },
      { name: "--particle-size-variation", initialValue: "0.6" },
      { name: "--particle-color-variation", initialValue: "0.2" },
      { name: "--instance-shape", initialValue: "sphere" },
      { name: "--instance-scale", initialValue: "1" },
      { name: "--instance-scale-variation", initialValue: "0.5" },
      { name: "--instance-rotation-speed", initialValue: "0.4" },
      { name: "--instance-jitter", initialValue: "0.2" },
      { name: "--instance-flow", initialValue: "0.3" },
      { name: "--instance-disperse", initialValue: "0" },
      { name: "--instance-scatter", initialValue: "0" },
      { name: "--instance-scatter-x", initialValue: "0" },
      { name: "--instance-scatter-y", initialValue: "0" },
      { name: "--instance-scatter-z", initialValue: "0" },
      { name: "--text-depth", initialValue: "8" },
      { name: "--text-curve-segments", initialValue: "8" },
      { name: "--text-bevel-size", initialValue: "0" },
      { name: "--text-bevel-thickness", initialValue: "0" },
      { name: "--text-bevel-offset", initialValue: "0" },
      { name: "--text-bevel-steps", initialValue: "0" },
      { name: "--text-fit", initialValue: "contain" },
    ];

    props.forEach(({ name, initialValue }) => {
      try {
        css.registerProperty({
          name,
          syntax:
            name === "--filter" ||
            name === "--light-target" ||
            name.startsWith("--texture-") ||
            name === "--material-type" ||
            name === "--particles-mode" ||
            name === "--particles-shape" ||
            name === "--particles-model" ||
            name === "--particles-model-loader" ||
            name === "--particles-model-node" ||
            name === "--instance-model" ||
            name === "--instance-model-loader" ||
            name === "--instance-model-node" ||
            name === "--particle-direction" ||
            name === "--particle-gravity" ||
            name === "--instance-shape" ||
            name === "--text-fit"
              ? "*"
              : name.includes("color") || name.includes("emissive")
              ? "<color>"
              : "<number>",
          inherits: false,
          initialValue,
        });
      } catch {}
    });
  }

  override destroy(): void {
    this.renderer?.destroy();
    this.scene?.destroy();
    this.isLoading.clear();
    this.dirtySyncManager.disable();
    this.filterController.clear();
    this.lastSyncData = new WeakMap();

    const styleEl = document.getElementById("string-3d-styles");
    styleEl?.remove();

    if (this.canvasContainer?.id === "string-3d-canvas") {
      this.canvasContainer.remove();
    }

    super.destroy();
  }
}
