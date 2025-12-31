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

    if (this.useDirtySync) {
      this.dirtyElements.clear();
    }

    this.renderer!.render(this.scene!, this.camera!);
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

      [string-3d] {
        --translate-x: 0; --translate-y: 0; --translate-z: 0;
        --rotate-x: 0; --rotate-y: 0; --rotate-z: 0;
        --scale: 1; --scale-x: 1; --scale-y: 1; --scale-z: 1;--opacity: 1;
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
    ];

    props.forEach(({ name, initialValue }) => {
      try {
        css.registerProperty({
          name,
          syntax: "<number>",
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
