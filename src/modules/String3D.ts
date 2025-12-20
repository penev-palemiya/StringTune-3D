import { StringModule } from "@fiddle-digital/string-tune";
import { StringObject } from "@fiddle-digital/string-tune";
import { StringData } from "@fiddle-digital/string-tune";
import { StringContext } from "@fiddle-digital/string-tune";
import { String3DCamera } from "../core/String3DCamera";
import { String3DRenderer } from "../core/String3DRenderer";
import { String3DScene } from "../core/String3DScene";
import { String3DSynchronizer } from "../core/synchronizer/String3DSynchronizer";
import { I3DEngineProvider } from "../core/abstractions/I3DEngineProvider";
import { I3DEngine } from "../core/abstractions/I3DEngine";
import { frameDOM } from "@fiddle-digital/string-tune";

export interface String3DOptions {
  hideHTML?: boolean;
  container?: string | HTMLElement;
  zIndex?: number;
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

  public static setProvider(provider: I3DEngineProvider): void {
    String3D.provider = provider;
  }

  constructor(context: StringContext, options: String3DOptions = {}) {
    super(context);
    this.htmlKey = "3d";
    this.options = {
      hideHTML: options.hideHTML ?? false,
      container: options.container,
      zIndex: options.zIndex ?? 1,
    };

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
    }
  }

  override onInit(): void {
    if (!String3D.provider) {
      console.error("[String3D] No provider set. Call String3D.setProvider() before use.");
      return;
    }

    this.engine = String3D.provider.getEngine();
    this.canvasContainer = this.createOrGetContainer();
    this.injectCSS();

    this.renderer = new String3DRenderer(this.canvasContainer, this.engine);
    this.renderer.attach();

    this.camera = new String3DCamera(this.engine, "orthographic");
    this.camera.setPosition(0, 0, 1000);
    this.camera.resize(this.renderer.width, this.renderer.height);

    this.scene = new String3DScene(this.engine);
    this.scene.getScene().add(this.camera.camera);

    this.synchronizer = new String3DSynchronizer(
      this.camera,
      this.renderer.width,
      this.renderer.height,
      this.engine
    );

    console.info(`[String3D] Initialized with: ${String3D.provider.getName()}`);
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

    if (this.options.hideHTML && object.htmlElement) {
      object.htmlElement.style.opacity = "0";
      object.htmlElement.style.pointerEvents = "none";
    }
  }

  override onFrame(data: StringData): void {
    if (!this.renderer || !this.scene || !this.camera || !this.synchronizer) return;

    frameDOM.measure(() => {
      this.scene!.rootObjects.forEach((obj) => {
        this.syncRecursive(obj.el, obj, { scale: 1 });
      });
    });

    frameDOM.mutate(() => {
      this.renderer!.render(this.scene!, this.camera!);
    });
  }

  private syncRecursive(el: HTMLElement | undefined, object: any, parentData: any): void {
    if (!this.synchronizer || !el) return;
    const data = this.synchronizer.syncElement(el, object, parentData);
    object.children.forEach((child: any) => this.syncRecursive(child.el, child, data));
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

      [string-3d] {
        --translate-x: 0; --translate-y: 0; --translate-z: 0;
        --rotate-x: 0; --rotate-y: 0; --rotate-z: 0;
        --scale: 1; --scale-x: 1; --scale-y: 1; --scale-z: 1;
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

  override destroy(): void {
    this.renderer?.destroy();
    this.scene?.destroy();
    this.isLoading.clear();

    const styleEl = document.getElementById("string-3d-styles");
    styleEl?.remove();

    if (this.canvasContainer?.id === "string-3d-canvas") {
      this.canvasContainer.remove();
    }

    super.destroy();
  }
}
