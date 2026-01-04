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
import { frameDOM } from "@fiddle-digital/string-tune";
import { MeshSynchronizer } from "../core/synchronizer/MeshSynchronizer";
import { String3DObject } from "../core/String3DObject";
import type {
  String3DFilterChain,
  String3DFilterTarget,
  String3DFilterEffect,
} from "../core/filters/String3DFilterTypes";
import { String3DCustomFilterRegistry } from "../core/filters/String3DCustomFilter";
import {
  TransformWorkerClient,
  TransformWorkerInput,
  TransformWorkerCamera,
  TransformWorkerResult,
} from "../core/transform/TransformWorkerClient";

export interface String3DOptions {
  hideHTML?: boolean;
  container?: string | HTMLElement;
  zIndex?: number;
  modelLoaderType?: string;
  modelLoader?: I3DModelLoader;
  modelLoaderFactory?: (engine: I3DEngine, type?: string) => I3DModelLoader;
  useDirtySync?: boolean;
  useTransformWorker?: boolean;
  transformWorkerWasmUrl?: string;
}

type FilterTransitionState = {
  raw: string;
  effects: String3DFilterChain;
  animating: boolean;
  from: String3DFilterChain;
  to: String3DFilterChain;
  startTime: number;
  duration: number;
  easing: (t: number) => number;
  clearOnComplete: boolean;
  lastDuration: number;
  lastDelay: number;
  lastEasing: (t: number) => number;
  pendingRaw?: string;
  pendingEffects?: String3DFilterChain;
  effectsKey?: string;
};

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
  private dirtyElements: Set<HTMLElement> = new Set();
  private observedElements: Set<HTMLElement> = new Set();
  private resizeObserver: ResizeObserver | null = null;
  private mutationObserver: MutationObserver | null = null;
  private lastSyncData: WeakMap<String3DObject, { scale: number }> = new WeakMap();
  private transformWorker: TransformWorkerClient | null = null;
  private workerHasResult = false;
  private workerObjectMap: Map<string, { object: String3DObject; el: HTMLElement }> = new Map();
  private domVersion = 0;
  private lastSubmittedVersion = 0;
  private scrollTicking = false;
  private onScrollBound = () => this.handleScroll();
  private filterStates: WeakMap<HTMLElement, FilterTransitionState> = new WeakMap();
  private filterWarnings: WeakMap<HTMLElement, string> = new WeakMap();

  public static setProvider(provider: I3DEngineProvider): void {
    String3D.provider = provider;
  }

  constructor(context: StringContext) {
    super(context);
    this.htmlKey = "3d";
    this.options = this.buildOptionsFromSettings();

    this.attributesToMap = [
      ...this.attributesToMap,
      { key: "3d", type: "string", fallback: "box" },
      { key: "3d-material", type: "string", fallback: "basic[#ffffff]" },
      { key: "3d-color", type: "string", fallback: "#ffffff" },
      { key: "3d-opacity", type: "number", fallback: 1 },
      { key: "3d-intensity", type: "number", fallback: 1 },
      { key: "3d-distance", type: "number", fallback: 1000 },
      { key: "3d-decay", type: "number", fallback: 0 },
      { key: "3d-model", type: "string", fallback: "" },
      { key: "3d-segments", type: "number", fallback: 32 },
      { key: "3d-segments-width", type: "number", fallback: 32 },
      { key: "3d-segments-height", type: "number", fallback: 32 },
      { key: "3d-model-loader", type: "string", fallback: "" },
      { key: "3d-model-scale", type: "number", fallback: 1 },
      { key: "3d-model-center", type: "boolean", fallback: false },
      { key: "3d-model-fit", type: "string", fallback: "contain" },
      { key: "3d-metalness", type: "number", fallback: 0 },
      { key: "3d-roughness", type: "number", fallback: 1 },
      { key: "3d-texture-flipY", type: "boolean", fallback: true },
      { key: "3d-colorSpace", type: "string", fallback: "" },
      { key: "3d-cast-shadow", type: "boolean", fallback: false },
      { key: "3d-receive-shadow", type: "boolean", fallback: false },
      { key: "3d-shadow-bias", type: "number", fallback: 0 },
      { key: "3d-shadow-map-size", type: "number", fallback: 512 },
      { key: "3d-angle", type: "number", fallback: Math.PI / 3 },
      { key: "3d-penumbra", type: "number", fallback: 0 },
      { key: "3d-ground-color", type: "string", fallback: "#ffffff" },
      { key: "3d-target", type: "string", fallback: "" },
    ];
  }

  override canConnect(object: StringObject): boolean {
    const result = super.canConnect(object);
    console.log(
      "[String3D] canConnect:",
      object.id,
      "keys:",
      object.keys,
      "htmlKey:",
      this.htmlKey,
      "result:",
      result
    );
    return result;
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
        this.markAllDirty();
      }
    }
  }

  override onInit(): void {
    this.options = this.buildOptionsFromSettings();
    if (!String3D.provider) {
      console.error("[String3D] No provider set. Call String3D.setProvider() before use.");
      return;
    }

    this.engine = String3D.provider.getEngine();
    this.canvasContainer = this.createOrGetContainer();
    this.registerTypedProperties();
    this.injectCSS();
    this.useDirtySync = !!this.options.useDirtySync;
    if (this.useDirtySync) {
      this.setupObservers();
      this.setupScrollListeners();
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

    if (this.options.useTransformWorker) {
      this.transformWorker = new TransformWorkerClient({
        wasmUrl: this.options.transformWorkerWasmUrl,
      });
    }

    console.info(`[String3D] Initialized with: ${String3D.provider.getName()}`);
  }

  override onSettingsChange(): void {
    this.options = this.buildOptionsFromSettings();
    const shouldUseDirtySync = !!this.options.useDirtySync;
    if (shouldUseDirtySync && !this.useDirtySync) {
      this.useDirtySync = true;
      this.setupObservers();
      this.setupScrollListeners();
      this.observeSceneElements();
      this.markAllDirty();
    } else if (!shouldUseDirtySync && this.useDirtySync) {
      this.useDirtySync = false;
      this.removeScrollListeners();
      this.resizeObserver?.disconnect();
      this.mutationObserver?.disconnect();
      this.dirtyElements.clear();
    }

    const shouldUseWorker = !!this.options.useTransformWorker;
    if (shouldUseWorker && !this.transformWorker) {
      this.transformWorker = new TransformWorkerClient({
        wasmUrl: this.options.transformWorkerWasmUrl,
      });
      this.workerHasResult = false;
    } else if (!shouldUseWorker && this.transformWorker) {
      this.transformWorker.destroy();
      this.transformWorker = null;
      this.workerHasResult = false;
    }
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
      useTransformWorker: this.getSettingValue("useTransformWorker", false),
      transformWorkerWasmUrl: this.getSettingValue("transformWorkerWasmUrl", undefined),
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
      } catch (error) {
        console.warn("[String3D] Failed to create model loader:", error);
      }
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
      this.observeElement(object.htmlElement);
      this.markDirty(object.htmlElement);
    }

    if (this.options.hideHTML && object.htmlElement) {
      object.htmlElement.style.opacity = "0";
      object.htmlElement.style.pointerEvents = "none";
    }
  }

  override onFrame(data: StringData): void {
    if (!this.renderer || !this.scene || !this.camera || !this.synchronizer) return;

    const workerResults = this.transformWorker?.takeLastResult();
    if (
      workerResults &&
      workerResults.frameId === this.lastSubmittedVersion &&
      workerResults.frameId >= this.domVersion
    ) {
      this.workerHasResult = true;
      this.applyWorkerResults(workerResults.results);
    }

    const dirtySet = this.useDirtySync ? this.dirtyElements : null;
    // If dirty sync is enabled but nothing is marked dirty, we still sync everything to keep CSS-driven effects (hover/animations) fluid.
    const forceSync = !dirtySet || dirtySet.size === 0;
    const worker = this.transformWorker;

    // Collect and submit worker inputs only when the worker is free
    if (worker?.isReady() && !worker.isPending()) {
      const inputs: TransformWorkerInput[] = [];
      this.workerObjectMap.clear();
      this.scene!.rootObjects.forEach((obj) => {
        this.collectWorkerInputs(obj, { scale: 1 }, forceSync, dirtySet, inputs);
      });
      if (inputs.length > 0) {
        const frameId = this.domVersion;
        this.lastSubmittedVersion = frameId;
        worker.submit(inputs, this.buildWorkerCameraData(), frameId);
      }
    }

    // Always do immediate CPU sync to avoid frame lag while worker is pending
    this.scene!.rootObjects.forEach((obj) => {
      this.syncRecursive(obj.el, obj, { scale: 1 }, forceSync, dirtySet);
    });

    const filterTargets = this.collectFilterTargets(performance.now(), forceSync, dirtySet);
    this.renderer!.render(this.scene!, this.camera!, filterTargets);

    if (this.useDirtySync) {
      this.dirtyElements.clear();
    }
  }

  private syncRecursive(
    el: HTMLElement | undefined,
    object: String3DObject,
    parentData: any,
    forceSync: boolean,
    dirtySet: Set<HTMLElement> | null
  ): void {
    if (!this.synchronizer || !el) return;
    const shouldSync = forceSync || !dirtySet || dirtySet.has(el);
    let nextParentData = parentData;

    if (shouldSync) {
      const data = this.synchronizer.syncElement(el, object, parentData);
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

      [string-3d] {
        --translate-x: 0; --translate-y: 0; --translate-z: 0;
        --rotate-x: 0; --rotate-y: 0; --rotate-z: 0;
        --scale: 1; --scale-x: 1; --scale-y: 1; --scale-z: 1;--opacity: 1; --filter: none;
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
    ];

    props.forEach(({ name, initialValue }) => {
      try {
        css.registerProperty({
          name,
          syntax: name === "--filter" ? "*" : "<number>",
          inherits: false,
          initialValue,
        });
      } catch {
        // Property may already be registered; ignore.
      }
    });
  }

  private setupObservers(): void {
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.target instanceof HTMLElement) {
            this.markDirty(entry.target);
          }
        });
      });
    }

    if (typeof MutationObserver !== "undefined") {
      this.mutationObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.target instanceof HTMLElement) {
            this.markDirty(mutation.target);
          }
        });
      });
    }
  }

  private setupScrollListeners(): void {
    window.addEventListener("scroll", this.onScrollBound, { passive: true });
    window.addEventListener("resize", this.onScrollBound, { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener("scroll", this.onScrollBound, { passive: true });
      window.visualViewport.addEventListener("resize", this.onScrollBound, { passive: true });
    }
  }

  private removeScrollListeners(): void {
    window.removeEventListener("scroll", this.onScrollBound);
    window.removeEventListener("resize", this.onScrollBound);
    if (window.visualViewport) {
      window.visualViewport.removeEventListener("scroll", this.onScrollBound);
      window.visualViewport.removeEventListener("resize", this.onScrollBound);
    }
  }

  private handleScroll(): void {
    if (!this.useDirtySync) return;
    this.markAllDirty();
  }

  private observeElement(el: HTMLElement): void {
    if (this.observedElements.has(el)) return;
    this.observedElements.add(el);

    this.resizeObserver?.observe(el);
    this.mutationObserver?.observe(el, {
      attributes: true,
      attributeFilter: [
        "style",
        "class",
        "string-3d",
        "string-3d-model-fit",
        "string-3d-model-scale",
        "string-3d-cast-shadow",
        "string-3d-receive-shadow",
        "string-3d-opacity",
        "string-3d-target",
      ],
    });
  }

  private observeSceneElements(): void {
    if (!this.scene) return;
    this.scene.rootObjects.forEach((obj) => {
      this.observeRecursive(obj);
    });
  }

  private observeRecursive(object: String3DObject): void {
    if (object.el instanceof HTMLElement) {
      this.observeElement(object.el);
    }
    object.children.forEach((child) => this.observeRecursive(child));
  }

  private markDirty(el: HTMLElement): void {
    this.dirtyElements.add(el);
    this.domVersion += 1;
  }

  private markAllDirty(): void {
    this.observedElements.forEach((el) => this.dirtyElements.add(el));
    this.domVersion += 1;
  }

  private readNumberStyle(el: HTMLElement, prop: string, fallback: number): number {
    const styleMap = (el as any).computedStyleMap?.();
    const mapValue = styleMap?.get?.(prop);
    if (mapValue !== undefined) {
      if (typeof mapValue === "number") return mapValue;
      if (typeof mapValue === "string") {
        const parsed = Number.parseFloat(mapValue);
        if (!Number.isNaN(parsed)) return parsed;
      }
      if (mapValue && typeof mapValue === "object") {
        const value = (mapValue as any).value;
        if (typeof value === "number") return value;
        if (typeof value === "string") {
          const parsed = Number.parseFloat(value);
          if (!Number.isNaN(parsed)) return parsed;
        }
      }
    }

    const style = getComputedStyle(el);
    const raw = style.getPropertyValue(prop);
    const parsed = Number.parseFloat(raw);
    return Number.isNaN(parsed) ? fallback : parsed;
  }

  private readFilterRaw(el: HTMLElement): string {
    const styleMap = (el as any).computedStyleMap?.();
    let raw = "";
    const mapValue = styleMap?.get?.("--filter");
    if (mapValue !== undefined) {
      if (typeof mapValue === "string") {
        raw = mapValue;
      } else if (mapValue && typeof mapValue === "object") {
        const value = (mapValue as any).value;
        if (typeof value === "string") raw = value;
      }
    }
    if (!raw) {
      raw = getComputedStyle(el).getPropertyValue("--filter") || "";
    }
    raw = raw.trim();
    return raw;
  }

  private parseFilterChain(raw: string): { effects: String3DFilterChain; warnings: string[] } {
    const warnings: string[] = [];
    const effects: String3DFilterChain = [];

    const parseNumber = (value: string): number | null => {
      const cleaned = value.trim().toLowerCase();
      const match = cleaned.match(/^(-?\d*\.?\d+)(px)?$/);
      if (!match) return null;
      const num = Number.parseFloat(match[1]);
      return Number.isFinite(num) ? num : null;
    };

    const parseRatio = (value: string): number | null => {
      const cleaned = value.trim().toLowerCase();
      if (!cleaned) return null;
      if (cleaned.endsWith("%")) {
        const num = Number.parseFloat(cleaned.slice(0, -1));
        return Number.isFinite(num) ? num / 100 : null;
      }
      const num = Number.parseFloat(cleaned);
      return Number.isFinite(num) ? num : null;
    };

    const parseAngle = (value: string): number | null => {
      const cleaned = value.trim().toLowerCase();
      if (!cleaned) return null;
      if (cleaned.endsWith("rad")) {
        const num = Number.parseFloat(cleaned.slice(0, -3));
        return Number.isFinite(num) ? num : null;
      }
      const stripped = cleaned.endsWith("deg") ? cleaned.slice(0, -3) : cleaned;
      const num = Number.parseFloat(stripped);
      return Number.isFinite(num) ? (num * Math.PI) / 180 : null;
    };

    const parseBloom = (value: string): { intensity: number; threshold: number } | null => {
      const parts = value.split(",").map((part) => part.trim());
      const intensity = parseNumber(parts[0] || "");
      if (intensity === null) return null;
      const threshold = parts[1] ? parseRatio(parts[1]) : null;
      return {
        intensity: Math.max(0, intensity),
        threshold: threshold === null ? 0.8 : Math.max(0, Math.min(1, threshold)),
      };
    };

    const parseAmount = (value: string, name: string, allowZero = false): number | null => {
      const amount = parseNumber(value);
      if (amount === null) {
        warnings.push(`[String3D] Invalid ${name} value "${value}".`);
        return null;
      }
      if (!allowZero && amount <= 0) {
        warnings.push(`[String3D] ${name} must be > 0.`);
        return null;
      }
      return amount;
    };

    const parseRatioAmount = (value: string, name: string): number | null => {
      const amount = parseRatio(value);
      if (amount === null) {
        warnings.push(`[String3D] Invalid ${name} value "${value}".`);
        return null;
      }
      return amount;
    };

    const re = /([a-zA-Z-]+)\(([^)]*)\)/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(raw))) {
      const name = match[1].toLowerCase();
      const args = (match[2] || "").trim();

      if (name === "blur") {
        const amount = parseAmount(args, "blur", true);
        if (amount !== null) effects.push({ type: "blur", amount });
      } else if (name === "pixel" || name === "pixelate") {
        const size = parseAmount(args, "pixel", true);
        if (size !== null) effects.push({ type: "pixel", size });
      } else if (name === "bloom") {
        const bloom = parseBloom(args);
        if (bloom) effects.push({ type: "bloom", ...bloom });
        else warnings.push(`[String3D] Invalid bloom value "${args}".`);
      } else if (name === "brightness") {
        const amount = parseRatioAmount(args, "brightness");
        if (amount !== null) effects.push({ type: "brightness", amount: Math.max(0, amount) });
      } else if (name === "contrast") {
        const amount = parseRatioAmount(args, "contrast");
        if (amount !== null) effects.push({ type: "contrast", amount: Math.max(0, amount) });
      } else if (name === "saturate") {
        const amount = parseRatioAmount(args, "saturate");
        if (amount !== null) effects.push({ type: "saturate", amount: Math.max(0, amount) });
      } else if (name === "grayscale") {
        const amount = parseRatioAmount(args, "grayscale");
        if (amount !== null)
          effects.push({ type: "grayscale", amount: Math.max(0, Math.min(1, amount)) });
      } else if (name === "sepia") {
        const amount = parseRatioAmount(args, "sepia");
        if (amount !== null)
          effects.push({ type: "sepia", amount: Math.max(0, Math.min(1, amount)) });
      } else if (name === "invert") {
        const amount = parseRatioAmount(args, "invert");
        if (amount !== null)
          effects.push({ type: "invert", amount: Math.max(0, Math.min(1, amount)) });
      } else if (name === "hue-rotate") {
        const angle = parseAngle(args);
        if (angle !== null) effects.push({ type: "hue-rotate", angle });
        else warnings.push(`[String3D] Invalid hue-rotate value "${args}".`);
      } else if (name) {
        const custom = String3DCustomFilterRegistry.get(name);
        if (custom) {
          const parsed = custom.parse ? custom.parse(args) : {};
          if (parsed === null) {
            warnings.push(`[String3D] Invalid custom filter "${name}" args "${args}".`);
          } else {
            effects.push({ type: "custom", name, uniforms: parsed });
          }
        } else {
          warnings.push(`[String3D] Unknown filter "${name}".`);
        }
      }
    }

    if (effects.length === 0) {
      warnings.push("[String3D] No valid filters parsed from --filter.");
    }

    return { effects, warnings };
  }

  private warnFilterIssues(el: HTMLElement, raw: string, warnings: string[]): void {
    if (warnings.length === 0) return;
    const lastRaw = this.filterWarnings.get(el);
    if (lastRaw === raw) return;
    warnings.forEach((warning) => console.warn(warning, el));
    this.filterWarnings.set(el, raw);
  }

  private readFilterChain(
    el: HTMLElement,
    now: number,
    shouldReadStyle: boolean
  ): String3DFilterChain | null {
    const existing = this.filterStates.get(el);
    if (!shouldReadStyle && existing) {
      if (existing.animating) {
        return this.sampleTransition(existing, now);
      }
      return existing.effects;
    }

    const raw = this.readFilterRaw(el);
    if (!raw || raw === "none") {
      if (existing) {
        if (existing.animating && existing.clearOnComplete) {
          const current = this.sampleTransition(existing, now);
          if (!existing.animating) {
            this.filterStates.delete(el);
            return null;
          }
          return current;
        }
        let { duration, delay, easing } = this.getFilterTransition(el);
        if (duration <= 0 && existing.lastDuration > 0) {
          duration = existing.lastDuration;
          delay = existing.lastDelay;
          easing = existing.lastEasing;
        }
        if (duration > 0) {
          const zero = this.makeZeroChain(existing.effects);
          existing.from = existing.effects;
          existing.to = zero;
          existing.startTime = now + delay;
          existing.duration = duration;
          existing.easing = easing;
          existing.animating = true;
          existing.clearOnComplete = true;
          existing.lastDuration = duration;
          existing.lastDelay = delay;
          existing.lastEasing = easing;
          return this.sampleTransition(existing, now);
        }
      }
      this.filterStates.delete(el);
      return null;
    }

    const { effects, warnings } = this.parseFilterChain(raw);
    this.warnFilterIssues(el, raw, warnings);
    if (effects.length === 0) return null;

    const state = this.filterStates.get(el);
    if (!state) {
      const { duration, delay, easing } = this.getFilterTransition(el);
      if (duration > 0) {
        const zero = this.makeZeroChain(effects);
        const newState: FilterTransitionState = {
          raw,
          effects,
          animating: true,
          from: zero,
          to: effects,
          startTime: now + delay,
          duration,
          easing,
          clearOnComplete: false,
          lastDuration: duration,
          lastDelay: delay,
          lastEasing: easing,
        };
        newState.effectsKey = this.stringifyFilterChain(effects);
        this.filterStates.set(el, newState);
        return this.sampleTransition(newState, now);
      }
      this.filterStates.set(el, {
        raw,
        effects,
        animating: false,
        from: effects,
        to: effects,
        startTime: 0,
        duration: 0,
        easing: (t) => t,
        clearOnComplete: false,
        lastDuration: 0,
        lastDelay: 0,
        lastEasing: (t) => t,
        effectsKey: this.stringifyFilterChain(effects),
      });
      return effects;
    }

    if (state.raw === raw) {
      if (state.animating) {
        const current = this.sampleTransition(state, now);
        if (!state.animating && state.clearOnComplete) {
          this.filterStates.delete(el);
          return null;
        }
        return current;
      }
      return state.effects;
    }

    state.pendingEffects = undefined;
    state.pendingRaw = undefined;

    let { duration, delay, easing } = this.getFilterTransition(el);
    if (duration <= 0 && state.lastDuration > 0) {
      duration = state.lastDuration;
      delay = state.lastDelay;
      easing = state.lastEasing;
    }
    if (duration > 0) {
      const canTween = this.canInterpolate(state.effects, effects);
      const current = state.animating ? this.getCurrentChain(state, now) : state.effects;
      if (!canTween && this.isZeroChain(effects)) {
        state.pendingRaw = raw;
        state.pendingEffects = effects;
        state.raw = raw;
        state.effects = current;
        state.from = current;
        state.to = this.makeZeroChain(current);
        state.startTime = now + delay;
        state.duration = duration;
        state.easing = easing;
        state.animating = true;
        state.clearOnComplete = false;
        state.lastDuration = duration;
        state.lastDelay = delay;
        state.lastEasing = easing;
        state.effectsKey = this.stringifyFilterChain(effects);
        return this.sampleTransition(state, now);
      }

      const fromChain = canTween ? current : this.makeZeroChain(effects);
      state.raw = raw;
      state.effects = effects;
      state.from = fromChain;
      state.to = effects;
      state.startTime = now + delay;
      state.duration = duration;
      state.easing = easing;
      state.animating = true;
      state.clearOnComplete = false;
      state.lastDuration = duration;
      state.lastDelay = delay;
      state.lastEasing = easing;
      state.effectsKey = this.stringifyFilterChain(effects);
      return this.sampleTransition(state, now);
    }

    state.raw = raw;
    state.effects = effects;
    state.animating = false;
    state.clearOnComplete = false;
    state.effectsKey = this.stringifyFilterChain(effects);
    return effects;
  }

  private collectFilterTargets(
    now: number,
    forceSync: boolean,
    dirtySet: Set<HTMLElement> | null
  ): String3DFilterTarget[] {
    if (!this.scene) return [];
    const targets: String3DFilterTarget[] = [];
    const walk = (obj: String3DObject): void => {
      const el = obj.el as HTMLElement | undefined;
      if (el) {
        const shouldReadStyle =
          !this.useDirtySync ||
          !dirtySet ||
          dirtySet.has(el) ||
          this.filterStates.get(el)?.animating === true;
        const chain = this.readFilterChain(el, now, shouldReadStyle);
        if (chain && chain.length > 0) {
          const dirty =
            !this.useDirtySync ||
            !dirtySet ||
            dirtySet.has(el) ||
            this.filterStates.get(el)?.animating === true;
          const effectsKey =
            this.filterStates.get(el)?.effectsKey || this.stringifyFilterChain(chain);
          targets.push({
            object: obj,
            effects: chain,
            effectsKey,
            dirty,
          });
          return;
        }
      }
      obj.children.forEach((child) => walk(child));
    };
    this.scene.rootObjects.forEach((obj) => walk(obj));
    return targets;
  }

  private stringifyFilterChain(chain: String3DFilterChain): string {
    const parts = chain.map((effect) => {
      if (effect.type === "blur") return `blur:${effect.amount}`;
      if (effect.type === "pixel") return `pixel:${effect.size}`;
      if (effect.type === "bloom") return `bloom:${effect.intensity},${effect.threshold}`;
      if (effect.type === "brightness") return `brightness:${effect.amount}`;
      if (effect.type === "contrast") return `contrast:${effect.amount}`;
      if (effect.type === "saturate") return `saturate:${effect.amount}`;
      if (effect.type === "grayscale") return `grayscale:${effect.amount}`;
      if (effect.type === "sepia") return `sepia:${effect.amount}`;
      if (effect.type === "invert") return `invert:${effect.amount}`;
      if (effect.type === "hue-rotate") return `hue-rotate:${effect.angle}`;
      if (effect.type === "custom") {
        const uniforms = Object.keys(effect.uniforms || {})
          .sort()
          .map((key) => `${key}=${effect.uniforms[key]}`)
          .join(",");
        return `custom:${effect.name}:${uniforms}`;
      }
      return "unknown";
    });
    return parts.join("|");
  }

  private getFilterTransition(el: HTMLElement): {
    duration: number;
    delay: number;
    easing: (t: number) => number;
  } {
    const style = getComputedStyle(el);
    const properties = this.splitTransitionList(style.transitionProperty);
    const durations = this.splitTransitionList(style.transitionDuration);
    const delays = this.splitTransitionList(style.transitionDelay);
    const timings = this.splitTransitionList(style.transitionTimingFunction);

    const index = this.findTransitionIndex(properties, "--filter");
    if (index === -1) {
      const shorthand = this.parseTransitionShorthand(style.transition);
      const fallback = shorthand.get("--filter") || shorthand.get("all");
      if (fallback) {
        return fallback;
      }
      return { duration: 0, delay: 0, easing: (t) => t };
    }

    const duration = this.parseTime(durations[index] || durations[durations.length - 1] || "0s");
    const delay = this.parseTime(delays[index] || delays[delays.length - 1] || "0s");
    const easingRaw = timings[index] || timings[timings.length - 1] || "linear";
    return { duration, delay, easing: this.parseEasing(easingRaw) };
  }

  private splitTransitionList(value: string): string[] {
    const result: string[] = [];
    let current = "";
    let depth = 0;
    for (let i = 0; i < value.length; i += 1) {
      const ch = value[i];
      if (ch === "(") depth += 1;
      if (ch === ")") depth = Math.max(0, depth - 1);
      if (ch === "," && depth === 0) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    if (current.trim()) result.push(current.trim());
    return result.length > 0 ? result : ["all"];
  }

  private findTransitionIndex(properties: string[], name: string): number {
    const normalized = properties.map((prop) => prop.trim().toLowerCase());
    let index = normalized.indexOf(name);
    if (index === -1) {
      index = normalized.indexOf("all");
    }
    return index;
  }

  private parseTime(value: string): number {
    const raw = value.trim().toLowerCase();
    if (raw.endsWith("ms")) {
      const num = Number.parseFloat(raw.slice(0, -2));
      return Number.isFinite(num) ? num : 0;
    }
    if (raw.endsWith("s")) {
      const num = Number.parseFloat(raw.slice(0, -1));
      return Number.isFinite(num) ? num * 1000 : 0;
    }
    const num = Number.parseFloat(raw);
    return Number.isFinite(num) ? num : 0;
  }

  private parseTransitionShorthand(
    value: string
  ): Map<string, { duration: number; delay: number; easing: (t: number) => number }> {
    const map = new Map<
      string,
      { duration: number; delay: number; easing: (t: number) => number }
    >();
    const parts = this.splitTransitionList(value);
    parts.forEach((part) => {
      if (!part) return;
      const tokens = part.trim().split(/\s+(?![^()]*\))/g);
      let prop = "";
      let duration = "";
      let delay = "";
      let easing = "";
      tokens.forEach((token) => {
        const lower = token.toLowerCase();
        if (
          lower.endsWith("ms") ||
          lower.endsWith("s") ||
          /^[0-9.]+$/.test(lower)
        ) {
          if (!duration) duration = lower;
          else if (!delay) delay = lower;
        } else if (
          lower.startsWith("cubic-bezier") ||
          lower.startsWith("steps") ||
          lower === "linear" ||
          lower === "ease" ||
          lower === "ease-in" ||
          lower === "ease-out" ||
          lower === "ease-in-out"
        ) {
          easing = token;
        } else if (!prop) {
          prop = token;
        }
      });
      if (!prop) return;
      map.set(prop.trim().toLowerCase(), {
        duration: this.parseTime(duration || "0s"),
        delay: this.parseTime(delay || "0s"),
        easing: this.parseEasing(easing || "linear"),
      });
    });
    return map;
  }

  private parseEasing(value: string): (t: number) => number {
    const raw = value.trim().toLowerCase();
    if (raw === "linear") return (t) => t;
    if (raw === "ease") return this.cubicBezier(0.25, 0.1, 0.25, 1);
    if (raw === "ease-in") return this.cubicBezier(0.42, 0, 1, 1);
    if (raw === "ease-out") return this.cubicBezier(0, 0, 0.58, 1);
    if (raw === "ease-in-out") return this.cubicBezier(0.42, 0, 0.58, 1);
    if (raw.startsWith("cubic-bezier")) {
      const match = raw.match(/cubic-bezier\(([^)]+)\)/);
      if (match) {
        const parts = match[1].split(",").map((p) => Number.parseFloat(p.trim()));
        if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
          return this.cubicBezier(parts[0], parts[1], parts[2], parts[3]);
        }
      }
    }
    return (t) => t;
  }

  private cubicBezier(p1x: number, p1y: number, p2x: number, p2y: number): (t: number) => number {
    const sampleCurveX = (t: number) => {
      const inv = 1 - t;
      return 3 * inv * inv * t * p1x + 3 * inv * t * t * p2x + t * t * t;
    };
    const sampleCurveY = (t: number) => {
      const inv = 1 - t;
      return 3 * inv * inv * t * p1y + 3 * inv * t * t * p2y + t * t * t;
    };
    const solveCurveX = (x: number) => {
      let t = x;
      for (let i = 0; i < 5; i += 1) {
        const x2 = sampleCurveX(t) - x;
        const d2 =
          3 * (1 - t) * (1 - t) * p1x + 6 * (1 - t) * t * (p2x - p1x) + 3 * t * t * (1 - p2x);
        if (Math.abs(x2) < 1e-5 || d2 === 0) break;
        t -= x2 / d2;
      }
      return t;
    };
    return (t: number) => {
      const x = Math.min(1, Math.max(0, t));
      const solved = solveCurveX(x);
      return Math.min(1, Math.max(0, sampleCurveY(solved)));
    };
  }

  private canInterpolate(from: String3DFilterChain, to: String3DFilterChain): boolean {
    if (from.length !== to.length) return false;
    return from.every((effect, index) => {
      const other = to[index];
      if (effect.type !== other.type) return false;
      if (effect.type === "custom" && other.type === "custom") {
        if (effect.name !== other.name) return false;
        const keys = Object.keys(effect.uniforms || {});
        const otherKeys = Object.keys(other.uniforms || {});
        if (keys.length !== otherKeys.length) return false;
        return keys.every((key) => key in other.uniforms && this.isNumeric(effect.uniforms[key]));
      }
      return true;
    });
  }

  private makeZeroChain(chain: String3DFilterChain): String3DFilterChain {
    return chain.map((effect) => {
      switch (effect.type) {
        case "blur":
          return { type: "blur", amount: 0 };
        case "pixel":
          return { type: "pixel", size: 0 };
        case "bloom":
          return { type: "bloom", intensity: 0, threshold: effect.threshold };
        case "brightness":
          return { type: "brightness", amount: 1 };
        case "contrast":
          return { type: "contrast", amount: 1 };
        case "saturate":
          return { type: "saturate", amount: 1 };
        case "grayscale":
          return { type: "grayscale", amount: 0 };
        case "sepia":
          return { type: "sepia", amount: 0 };
        case "invert":
          return { type: "invert", amount: 0 };
        case "hue-rotate":
          return { type: "hue-rotate", angle: 0 };
        case "custom": {
          const uniforms: Record<string, any> = {};
          Object.entries(effect.uniforms || {}).forEach(([key, value]) => {
            uniforms[key] = this.isNumeric(value) ? 0 : value;
          });
          return { type: "custom", name: effect.name, uniforms };
        }
        default:
          return effect;
      }
    });
  }

  private sampleTransition(state: FilterTransitionState, now: number): String3DFilterChain {
    if (!state.animating) return state.effects;
    if (now < state.startTime) {
      return state.from;
    }
    const elapsed = now - state.startTime;
    const duration = Math.max(1, state.duration);
    const t = Math.min(1, Math.max(0, elapsed / duration));
    const eased = state.easing(t);
    const interpolated = this.interpolateChain(state.from, state.to, eased);
    if (t >= 1) {
      state.animating = false;
      state.from = state.to;
      if (state.pendingEffects && state.pendingRaw === state.raw) {
        state.effects = state.pendingEffects;
        state.raw = state.pendingRaw || state.raw;
        state.pendingEffects = undefined;
        state.pendingRaw = undefined;
      } else if (state.pendingEffects) {
        state.pendingEffects = undefined;
        state.pendingRaw = undefined;
      }
    }
    return interpolated;
  }

  private getCurrentChain(state: FilterTransitionState, now: number): String3DFilterChain {
    if (!state.animating) return state.effects;
    if (now < state.startTime) return state.from;
    const elapsed = now - state.startTime;
    const duration = Math.max(1, state.duration);
    const t = Math.min(1, Math.max(0, elapsed / duration));
    const eased = state.easing(t);
    return this.interpolateChain(state.from, state.to, eased);
  }

  private interpolateChain(
    from: String3DFilterChain,
    to: String3DFilterChain,
    t: number
  ): String3DFilterChain {
    if (!this.canInterpolate(from, to)) return to;
    return from.map((effect, index) => this.interpolateEffect(effect, to[index], t));
  }

  private interpolateEffect(
    from: String3DFilterEffect,
    to: String3DFilterEffect,
    t: number
  ): String3DFilterEffect {
    const lerp = (a: number, b: number) => a + (b - a) * t;
    if (from.type === "blur" && to.type === "blur") {
      return { type: "blur", amount: lerp(from.amount, to.amount) };
    }
    if (from.type === "pixel" && to.type === "pixel") {
      return { type: "pixel", size: lerp(from.size, to.size) };
    }
    if (from.type === "bloom" && to.type === "bloom") {
      return {
        type: "bloom",
        intensity: lerp(from.intensity, to.intensity),
        threshold: lerp(from.threshold, to.threshold),
      };
    }
    if (from.type === "brightness" && to.type === "brightness") {
      return { type: "brightness", amount: lerp(from.amount, to.amount) };
    }
    if (from.type === "contrast" && to.type === "contrast") {
      return { type: "contrast", amount: lerp(from.amount, to.amount) };
    }
    if (from.type === "saturate" && to.type === "saturate") {
      return { type: "saturate", amount: lerp(from.amount, to.amount) };
    }
    if (from.type === "grayscale" && to.type === "grayscale") {
      return { type: "grayscale", amount: lerp(from.amount, to.amount) };
    }
    if (from.type === "sepia" && to.type === "sepia") {
      return { type: "sepia", amount: lerp(from.amount, to.amount) };
    }
    if (from.type === "invert" && to.type === "invert") {
      return { type: "invert", amount: lerp(from.amount, to.amount) };
    }
    if (from.type === "hue-rotate" && to.type === "hue-rotate") {
      return { type: "hue-rotate", angle: lerp(from.angle, to.angle) };
    }
    if (from.type === "custom" && to.type === "custom" && from.name === to.name) {
      const uniforms: Record<string, any> = {};
      Object.entries(to.uniforms || {}).forEach(([key, value]) => {
        const fromValue = from.uniforms?.[key];
        if (this.isNumeric(fromValue) && this.isNumeric(value)) {
          uniforms[key] = lerp(fromValue, value);
        } else {
          uniforms[key] = value;
        }
      });
      return { type: "custom", name: to.name, uniforms };
    }
    return to;
  }

  private isNumeric(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
  }

  private isZeroChain(chain: String3DFilterChain): boolean {
    return chain.every((effect) => {
      switch (effect.type) {
        case "blur":
          return effect.amount <= 0;
        case "pixel":
          return effect.size <= 0;
        case "bloom":
          return effect.intensity <= 0;
        case "brightness":
          return effect.amount === 1;
        case "contrast":
          return effect.amount === 1;
        case "saturate":
          return effect.amount === 1;
        case "grayscale":
          return effect.amount === 0;
        case "sepia":
          return effect.amount === 0;
        case "invert":
          return effect.amount === 0;
        case "hue-rotate":
          return effect.angle === 0;
        case "custom":
          return false;
        default:
          return false;
      }
    });
  }

  private buildWorkerCameraData(): TransformWorkerCamera {
    return {
      mode: this.camera!.getMode(),
      width: this.renderer!.width,
      height: this.renderer!.height,
      cameraZ: this.camera!.getPositionZ(),
      fov: this.camera!.getPerspectiveFov(),
      aspect: this.renderer!.width / this.renderer!.height,
    };
  }

  private collectWorkerInputs(
    object: String3DObject,
    parentData: { scale: number },
    forceSync: boolean,
    dirtySet: Set<HTMLElement> | null,
    inputs: TransformWorkerInput[]
  ): void {
    if (!this.synchronizer || !object.el) return;
    const el = object.el as HTMLElement;
    const shouldSync = forceSync || !dirtySet || dirtySet.has(el);
    let nextParentData = parentData;

    if (object.type.endsWith("Light")) {
      if (shouldSync) {
        this.synchronizer.syncElement(el, object, parentData);
      }
      return;
    }

    if (shouldSync) {
      const rect = el.getBoundingClientRect();
      const layoutWidth = el.offsetWidth || rect.width;
      const layoutHeight = el.offsetHeight || rect.height;
      const translateZ = this.readNumberStyle(el, "--translate-z", 0);
      const scale = this.readNumberStyle(el, "--scale", 1);
      const scaleZ = this.readNumberStyle(el, "--scale-z", 1);
      const rotateX = this.readNumberStyle(el, "--rotate-x", 0);
      const rotateY = this.readNumberStyle(el, "--rotate-y", 0);
      const rotateZ = this.readNumberStyle(el, "--rotate-z", 0);
      const opacity = this.readNumberStyle(el, "--opacity", NaN);

      if (object.type !== "group") {
        MeshSynchronizer.applyVisualProps(el, object, opacity);
      }

      let modelSizeX: number | undefined;
      let modelSizeY: number | undefined;
      let modelScale: number | undefined;
      let fitMode: string | undefined;

      if (object.type === "model") {
        const bbox = object.getOriginalBoundingBox();
        const size = bbox.getSize(this.engine!.createVector3());
        modelSizeX = size.x;
        modelSizeY = size.y;
        const modelScaleAttr = parseFloat(el.getAttribute("string-3d-model-scale") || "1");
        modelScale = Number.isFinite(modelScaleAttr) ? modelScaleAttr : 1;
        fitMode = (el.getAttribute("string-3d-model-fit") || "contain").toLowerCase().trim();
      }

      const returnScale = object.type === "group" ? scale : scale * parentData.scale;
      this.lastSyncData.set(object, { scale: returnScale });
      nextParentData = { scale: returnScale };

      this.workerObjectMap.set(object.id, { object, el });
      inputs.push({
        id: object.id,
        type: object.type,
        rectLeft: rect.left,
        rectTop: rect.top,
        rectWidth: layoutWidth,
        rectHeight: layoutHeight,
        translateZ,
        scale,
        scaleZ,
        rotateX,
        rotateY,
        rotateZ,
        parentScale: parentData.scale,
        modelSizeX,
        modelSizeY,
        modelScale,
        fitMode,
      });
    } else {
      const cached = this.lastSyncData.get(object);
      if (cached) {
        nextParentData = cached;
      }
    }

    const forceChildren = forceSync || shouldSync;
    object.children.forEach((child) => {
      this.collectWorkerInputs(child, nextParentData, forceChildren, dirtySet, inputs);
    });
  }

  private applyWorkerResults(results: TransformWorkerResult[]): void {
    if (!this.engine) return;
    results.forEach((result) => {
      const entry = this.workerObjectMap.get(result.id);
      if (!entry) return;
      const object = entry.object;
      object.position = this.engine!.createVector3(result.posX, result.posY, result.posZ);
      object.rotation = this.engine!.createEuler(result.rotX, result.rotY, result.rotZ, "XYZ");
      object.scale = this.engine!.createVector3(result.scaleX, result.scaleY, result.scaleZ);
      if (object.type === "group") {
        object.object.updateMatrixWorld(true);
      }
    });
  }

  override destroy(): void {
    this.renderer?.destroy();
    this.scene?.destroy();
    this.isLoading.clear();
    this.transformWorker?.destroy();
    this.transformWorker = null;
    this.removeScrollListeners();
    this.resizeObserver?.disconnect();
    this.mutationObserver?.disconnect();
    this.observedElements.clear();
    this.dirtyElements.clear();
    this.workerObjectMap.clear();
    this.lastSyncData = new WeakMap();

    const styleEl = document.getElementById("string-3d-styles");
    styleEl?.remove();

    if (this.canvasContainer?.id === "string-3d-canvas") {
      this.canvasContainer.remove();
    }

    super.destroy();
  }
}
