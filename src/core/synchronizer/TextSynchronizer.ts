import { String3DObject } from "../String3DObject";
import type { SyncContext } from "./SyncContext";
import type { String3DObjectSyncStrategy } from "./String3DObjectSyncStrategy";
import { StyleBundleCache } from "./StyleBundleCache";
import { String3DFontRegistry } from "../text";
import { MeshSynchronizer } from "./MeshSynchronizer";

const DEG_TO_RAD = Math.PI / 180;

const DEBUG_TEXT_SYNC = false;

const PSEUDO_ELEMENT_CSS = `
[data-string3d-text] {
  -webkit-text-fill-color: transparent;
}

[data-string3d-text]::before {
  content: attr(data-string3d-text);
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  
  color: inherit;
  -webkit-text-fill-color: initial;
  font: inherit;
  text-transform: inherit;
  letter-spacing: inherit;
  line-height: inherit;
  text-align: inherit;
  white-space: inherit;
  word-spacing: inherit;
  
  transform: var(--string3d-transform, none);
  transform-style: preserve-3d;
  transform-origin: center center;
}
`;

export class TextSynchronizer implements String3DObjectSyncStrategy {
  private static styleCache = new StyleBundleCache<StyleBundle>();
  private static layoutCache = new StyleBundleCache<LayoutBundle>();
  private static geometryKeys: WeakMap<String3DObject, string> = new WeakMap();
  private static lastMaterialType: WeakMap<String3DObject, string> = new WeakMap();
  private static fontCache: Map<string, any> = new Map();
  private static fontPromises: Map<string, Promise<any>> = new Map();
  private static pendingFontObjects: Map<string, Set<String3DObject>> = new Map();
  private static contentObservers: WeakMap<HTMLElement, MutationObserver> = new WeakMap();
  private static warnedMissingFont = false;
  private static warnedMissingLoader = false;
  private static pseudoStyleInjected = false;

  private static markObjectPendingFont(fontUrl: string, object: String3DObject): void {
    let set = this.pendingFontObjects.get(fontUrl);
    if (!set) {
      set = new Set();
      this.pendingFontObjects.set(fontUrl, set);
    }
    set.add(object);
  }

  private static clearObjectPendingFont(fontUrl: string, object: String3DObject): void {
    const set = this.pendingFontObjects.get(fontUrl);
    if (set) {
      set.delete(object);
    }
  }

  private static invalidatePendingObjects(fontUrl: string): void {
    const set = this.pendingFontObjects.get(fontUrl);
    if (set) {
      set.forEach((obj) => {
        this.geometryKeys.delete(obj);
      });
      set.clear();
    }
  }

  private static injectPseudoElementStyles(): void {
    if (this.pseudoStyleInjected || typeof document === "undefined") return;

    const style = document.createElement("style");
    style.setAttribute("data-string3d", "pseudo-text");
    style.textContent = PSEUDO_ELEMENT_CSS;
    document.head.appendChild(style);
    this.pseudoStyleInjected = true;
  }

  private static setupSelectableText(el: HTMLElement): void {
    const textContent = el.textContent || "";

    if (el.dataset.string3dText !== textContent) {
      el.dataset.string3dText = textContent;
    }

    const computed = getComputedStyle(el);
    if (computed.position === "static") {
      el.style.position = "relative";
    }

    const rx = computed.getPropertyValue("--rotate-x").trim() || "0";
    const ry = computed.getPropertyValue("--rotate-y").trim() || "0";
    const rz = computed.getPropertyValue("--rotate-z").trim() || "0";
    const tx = computed.getPropertyValue("--translate-x").trim() || "0px";
    const ty = computed.getPropertyValue("--translate-y").trim() || "0px";
    const tz = computed.getPropertyValue("--translate-z").trim() || "0px";
    const s = computed.getPropertyValue("--scale").trim() || "1";

    const transform = [
      tx !== "0px" && tx !== "0" ? `translateX(${tx})` : "",
      ty !== "0px" && ty !== "0" ? `translateY(${ty})` : "",
      tz !== "0px" && tz !== "0" ? `translateZ(${tz})` : "",
      rx !== "0" ? `rotateX(${rx}deg)` : "",
      ry !== "0" ? `rotateY(${ry}deg)` : "",
      rz !== "0" ? `rotateZ(${rz}deg)` : "",
      s !== "1" ? `scale(${s})` : "",
    ]
      .filter(Boolean)
      .join(" ");

    el.style.setProperty("--string3d-transform", transform || "none");
  }

  private static setupContentObserver(el: HTMLElement, object: String3DObject): void {
    if (this.contentObservers.has(el)) return;

    let lastContent = el.textContent || "";

    const observer = new MutationObserver((mutations) => {
      const currentContent = el.textContent || "";
      if (currentContent === lastContent) {
        return;
      }

      lastContent = currentContent;

      const string3d = (window as any).StringTune3D?.String3D?.getInstance?.();
      const currentObject = string3d?.scene?.getObjectForElement?.(el);

      if (currentObject) {
        this.geometryKeys.delete(currentObject);
        this.layoutCache.invalidate(el);

        if (el.dataset.string3dText !== currentContent) {
          el.dataset.string3dText = currentContent;
        }
      }
    });

    observer.observe(el, {
      characterData: true,
      childList: true,
      subtree: true,
    });

    this.contentObservers.set(el, observer);
  }

  private static cleanupContentObserver(el: HTMLElement): void {
    const observer = this.contentObservers.get(el);
    if (observer) {
      observer.disconnect();
      this.contentObservers.delete(el);
    }
  }

  sync(el: HTMLElement, object: String3DObject, ctx: SyncContext, parentData: any): any {
    TextSynchronizer.injectPseudoElementStyles();
    TextSynchronizer.setupSelectableText(el);
    TextSynchronizer.setupContentObserver(el, object);

    const { rect, width: originalWidth, height: originalHeight } = this.readLayout(el, ctx);
    const bundle = this.readStyleBundle(el, ctx);

    const {
      translateZ,
      cssScale,
      rotateX,
      rotateY,
      rotateZ,
      cssScaleZ,
      opacity,
      color,
      metalness,
      roughness,
      emissive,
      castShadow,
      receiveShadow,
      materialType,
      fontFamily,
      fontSize,
      textTransform,
      textDepth,
      textCurveSegments,
      bevelEnabled,
      bevelSize,
      bevelThickness,
      bevelOffset,
      bevelSegments,
      fontCss,
    } = bundle;

    const screenCenterX = rect.left + rect.width * 0.5;
    const screenCenterY = rect.top + rect.height * 0.5;

    if (ctx.camera.getMode() === "orthographic") {
      object.object.position.set(
        screenCenterX - ctx.viewportWidth / 2,
        -(screenCenterY - ctx.viewportHeight / 2),
        translateZ
      );
    } else {
      const frustum = ctx.camera.getFrustumSizeAt(translateZ);
      const normalizedX = screenCenterX / ctx.viewportWidth;
      const normalizedY = screenCenterY / ctx.viewportHeight;
      object.object.position.set(
        (normalizedX - 0.5) * frustum.width,
        -(normalizedY - 0.5) * frustum.height,
        translateZ
      );
    }

    object.object.rotation.x = -rotateX * DEG_TO_RAD;
    object.object.rotation.y = rotateY * DEG_TO_RAD;
    object.object.rotation.z = -rotateZ * DEG_TO_RAD;
    object.object.rotation.order = "XYZ";

    object.object.rotation.z = -rotateZ * DEG_TO_RAD;
    object.object.rotation.order = "XYZ";

    const layout = this.extractCharacterLayout(el, textTransform);
    const textContent = layout.map((l) => l.char).join("");
    const useCanvasText = Boolean(fontCss);

    const mesh = this.getTextMesh(object);
    if (!mesh) {
      return { scale: cssScale * (parentData?.scale || 1) };
    }

    if (layout.length === 0) {
      mesh.visible = false;
      return { scale: cssScale * (parentData?.scale || 1) };
    }

    if (opacity === 0) {
      object.object.visible = false;
      return { scale: cssScale * (parentData?.scale || 1) };
    }
    object.object.visible = true;

    mesh.visible = true;

    const fontEntry = String3DFontRegistry.resolveFontFamily(fontFamily || "");
    if (!fontEntry) {
      if (!TextSynchronizer.warnedMissingFont) {
        TextSynchronizer.warnedMissingFont = true;
      }
      return { scale: cssScale * (parentData?.scale || 1) };
    }

    if (!ctx.engine.loadFont || !ctx.engine.createTextGeometry) {
      if (!TextSynchronizer.warnedMissingLoader) {
        TextSynchronizer.warnedMissingLoader = true;
      }
      return { scale: cssScale * (parentData?.scale || 1) };
    }

    const fontUrl = fontEntry.url;
    let font = TextSynchronizer.fontCache.get(fontUrl);
    if (!font) {
      TextSynchronizer.markObjectPendingFont(fontUrl, object);
      if (!TextSynchronizer.fontPromises.has(fontUrl)) {
        const promise = ctx.engine.loadFont(fontUrl).then((loaded) => {
          if (loaded) {
            TextSynchronizer.fontCache.set(fontUrl, loaded);
            TextSynchronizer.invalidatePendingObjects(fontUrl);
          }
          return loaded;
        });
        TextSynchronizer.fontPromises.set(fontUrl, promise);
      }
      mesh.visible = false;
      return { scale: cssScale * (parentData?.scale || 1) };
    }

    TextSynchronizer.clearObjectPendingFont(fontUrl, object);

    const layoutSig =
      layout.length > 0
        ? `${layout.length}:${layout[0].x.toFixed(1)},${layout[0].y.toFixed(1)}:${layout[
            layout.length - 1
          ].x.toFixed(1)},${layout[layout.length - 1].y.toFixed(1)}`
        : "empty";

    const key = [
      textContent,
      fontSize.toFixed(3),
      fontCss || "",
      rect.width.toFixed(1),
      rect.height.toFixed(1),
      layoutSig,
      textDepth.toFixed(3),
      textCurveSegments.toFixed(3),
      bevelEnabled ? "1" : "0",
      bevelSize.toFixed(3),
      bevelThickness.toFixed(3),
      bevelOffset.toFixed(3),
      bevelSegments.toFixed(3),
    ].join("|");

    const prevKey = TextSynchronizer.geometryKeys.get(object);
    if (prevKey !== key) {
      const geometry = ctx.engine.createTextGeometry(textContent, font, {
        size: fontSize,
        height: textDepth,
        curveSegments: Math.max(1, Math.round(textCurveSegments)),
        bevelEnabled,
        bevelThickness,
        bevelSize,
        bevelOffset,
        bevelSegments: Math.max(0, Math.round(bevelSegments)),
        lineHeight: 0,
        letterSpacing: 0,
        align: "left",
        layout,
        elementWidth: rect.width,
        elementHeight: rect.height,
      });

      if (geometry) {
        geometry.computeBoundingBox();
        if (mesh.geometry) {
          mesh.geometry.dispose?.();
        }
        mesh.geometry = geometry;
        object.geometry = geometry;
        TextSynchronizer.geometryKeys.set(object, key);
      }
    }

    const parentScale = parentData?.scale || 1;
    const perPixel =
      ctx.camera.getMode() === "orthographic"
        ? 1
        : ctx.camera.getScaleAtZ(translateZ, ctx.viewportHeight);

    const scaleFactor = cssScale * parentScale * perPixel;

    const scaleZ = scaleFactor * cssScaleZ;
    object.object.scale.set(scaleFactor, scaleFactor, scaleZ);

    const localOffsetX = -originalWidth * 0.5;
    const localOffsetY = originalHeight * 0.5;

    mesh.position.set(localOffsetX, localOffsetY, 0);

    const prevMaterialType = TextSynchronizer.lastMaterialType.get(object);
    if (prevMaterialType !== undefined && prevMaterialType !== materialType) {
      if (ctx.scene && (ctx.scene as any).recreateMaterialForObject) {
        requestAnimationFrame(() => {
          if (ctx.scene && (ctx.scene as any).recreateMaterialForObject) {
            (ctx.scene as any).recreateMaterialForObject(object, el);
          }
        });
      }
    }

    TextSynchronizer.lastMaterialType.set(object, materialType);

    MeshSynchronizer.applyVisualProps(el, object, {
      opacity,
      color: color && color !== "none" ? color : undefined,
      metalness: Number.isFinite(metalness) ? metalness : undefined,
      roughness: Number.isFinite(roughness) ? roughness : undefined,
      emissive: emissive && emissive !== "none" ? emissive : undefined,
      castShadow,
      receiveShadow,
    });

    this.updateCustomUniforms(el, object, ctx);

    return { scale: scaleFactor };
  }

  cleanup(el: HTMLElement, object: String3DObject): void {
    TextSynchronizer.cleanupContentObserver(el);
    TextSynchronizer.geometryKeys.delete(object);
  }

  private extractCharacterLayout(
    el: HTMLElement,
    transform: string
  ): Array<{
    char: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
    scale?: number;
  }> {
    const layout: Array<{
      char: string;
      x: number;
      y: number;
      width?: number;
      height?: number;
      scale?: number;
    }> = [];
    if (typeof document === "undefined" || !document.createRange) return layout;

    const range = document.createRange();
    const elRect = el.getBoundingClientRect();
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node: Node | null;

    while ((node = walker.nextNode())) {
      const text = node.textContent || "";
      if (!text.trim() && text !== " ") continue;

      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === "\n" || char === "\r") continue;

        if (!char.trim()) continue;

        range.setStart(node, i);
        range.setEnd(node, i + 1);
        const rects = range.getClientRects();

        if (rects.length > 0) {
          const r = rects[0];
          const x = r.left - elRect.left;
          const y = r.top - elRect.top;

          const visibleChar = this.applyTextTransform(char, transform);

          layout.push({
            char: visibleChar,
            x,
            y,
            width: r.width,
            height: r.height,
          });
        }
      }
    }
    return layout;
  }

  private getTextMesh(object: String3DObject): any | null {
    const anyObj = object.object as any;
    if (anyObj?.__textMesh) return anyObj.__textMesh;
    if (anyObj?.isMesh) return anyObj;
    if (Array.isArray(anyObj?.children)) {
      const found = anyObj.children.find((child: any) => child?.isMesh);
      if (found) {
        anyObj.__textMesh = found;
        return found;
      }
    }
    return null;
  }

  private updateCustomUniforms(el: HTMLElement, object: String3DObject, ctx: SyncContext): void {
    const factory = ctx.engine.getMaterialFactory?.();
    if (!factory) return;

    const style = getComputedStyle(el);

    const apply = (mat: any) => {
      const definition = mat?.userData?.definition;
      if (!definition?.uniforms) return;

      const values = factory.parseUniformsFromCSS(definition, el, style);
      for (const [key, value] of Object.entries(values)) {
        const def = definition.uniforms?.[key];
        if (!def) continue;
        const converter = (factory as any).convertUniformValue?.bind(factory);
        const converted = converter ? converter(def.type, value) : value;

        if (mat.userData?.shader?.uniforms?.[key]) {
          mat.userData.shader.uniforms[key].value = converted;
        } else if (mat.userData?.customUniforms?.[key]) {
          mat.userData.customUniforms[key].value = converted;
        } else if (mat.uniforms?.[key]) {
          mat.uniforms[key].value = converted;
        }
      }
    };

    if (object.object.traverse) {
      object.object.traverse((child: any) => {
        if (child.isMesh) {
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach(apply);
        }
      });
    } else {
      const mesh = this.getTextMesh(object);
      if (!mesh) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach(apply);
    }
  }

  private readStyleBundle(el: HTMLElement, ctx: SyncContext): StyleBundle {
    return TextSynchronizer.styleCache.get(el, ctx, (el) => {
      const styleMap = (el as any).computedStyleMap?.();
      const style = getComputedStyle(el);

      const readNumber = (prop: string, fallback: number): number => {
        const mapValue = styleMap?.get?.(prop);
        if (mapValue !== undefined && mapValue !== null) {
          const val =
            typeof mapValue === "object" && "value" in (mapValue as any)
              ? (mapValue as any).value
              : mapValue;
          const num = typeof val === "number" ? val : Number.parseFloat(String(val));
          if (!Number.isNaN(num)) return num;
        }
        const raw = style.getPropertyValue(prop);
        const num = Number.parseFloat(raw);
        return Number.isNaN(num) ? fallback : num;
      };

      const readString = (prop: string): string => {
        const mapValue = styleMap?.get?.(prop);
        const val =
          mapValue && typeof mapValue === "object" && "value" in (mapValue as any)
            ? (mapValue as any).value
            : mapValue;
        if (typeof val === "string") return val.trim();
        return style.getPropertyValue(prop).trim();
      };

      const readBool = (prop: string, fallback = false): boolean => {
        const raw = readString(prop);
        if (!raw) return fallback;
        const norm = raw.toLowerCase();
        return norm === "true" || norm === "1" || norm === "yes"
          ? true
          : norm === "false" || norm === "0" || norm === "no"
          ? false
          : fallback;
      };

      const colorVar = readString("--material-color");
      const color = colorVar && colorVar !== "none" ? colorVar : style.color.trim();

      const fontSize = (() => {
        const raw = style.fontSize || "";
        const parsed = Number.parseFloat(raw);
        return Number.isFinite(parsed) ? parsed : 16;
      })();

      const lineHeight = (() => {
        const raw = style.lineHeight || "";
        if (!raw || raw === "normal") return fontSize * 1.2;
        const parsed = Number.parseFloat(raw);
        if (!Number.isFinite(parsed)) return fontSize * 1.2;
        return raw.endsWith("px") ? parsed : parsed * fontSize;
      })();

      const letterSpacing = (() => {
        const raw = style.letterSpacing || "";
        if (!raw || raw === "normal") return 0;
        const parsed = Number.parseFloat(raw);
        return Number.isFinite(parsed) ? parsed : 0;
      })();

      const fit = readString("--text-fit") || "none";

      const depthRaw = readNumber("--text-depth", NaN);
      const depth = Number.isFinite(depthRaw) ? depthRaw : Math.max(1, fontSize * 0.2);

      const bevelSize = readNumber("--text-bevel-size", 0);
      const bevelThickness = readNumber("--text-bevel-thickness", 0);
      const bevelOffset = readNumber("--text-bevel-offset", 0);
      const bevelSegments = readNumber("--text-bevel-steps", 0);

      const alignRaw = (style.textAlign || "left").toLowerCase();
      const align =
        alignRaw === "center"
          ? "center"
          : alignRaw === "right" || alignRaw === "end"
          ? "right"
          : "left";

      const fontCss = style.font?.trim();
      const computedFont =
        fontCss && fontCss.length > 0
          ? fontCss
          : [
              style.fontStyle || "normal",
              style.fontWeight || "normal",
              `${style.fontSize || "16px"}/${style.lineHeight || "normal"}`,
              style.fontFamily || "sans-serif",
            ].join(" ");

      return {
        translateZ: readNumber("--translate-z", 0),
        cssScale: readNumber("--scale", 1),
        rotateX: readNumber("--rotate-x", 0),
        rotateY: readNumber("--rotate-y", 0),
        rotateZ: readNumber("--rotate-z", 0),
        cssScaleZ: readNumber("--scale-z", 1),
        opacity: readNumber("--opacity", NaN),
        color,
        metalness: readNumber("--material-metalness", NaN),
        roughness: readNumber("--material-roughness", NaN),
        emissive: readString("--material-emissive"),
        castShadow: readBool("--shadow-cast", false),
        receiveShadow: readBool("--shadow-receive", false),
        materialType: readString("--material-type", "basic").split("[")[0] || "basic",
        fontFamily: style.fontFamily || "",
        fontCss: computedFont,
        fontSize,
        lineHeight,
        letterSpacing,
        textAlign: align,
        textTransform: (style.textTransform || "").toLowerCase(),
        textDepth: depth,
        textCurveSegments: readNumber("--text-curve-segments", 8),
        bevelEnabled: bevelSize > 0 || bevelThickness > 0,
        bevelSize,
        bevelThickness,
        bevelOffset,
        bevelSegments,
        textFit: fit === "cover" || fit === "none" ? fit : "contain",
      };
    });
  }

  private applyTextTransform(text: string, transform: string): string {
    if (!transform || transform === "none") return text;
    if (transform === "uppercase") return text.toUpperCase();
    if (transform === "lowercase") return text.toLowerCase();
    if (transform === "capitalize") {
      return text.replace(/\b(\p{L})/gu, (match) => match.toUpperCase());
    }
    return text;
  }

  private readLayout(el: HTMLElement, ctx: SyncContext): LayoutBundle {
    const cached = (el as any).__layoutCache;
    if (cached) {
      return cached;
    }

    return TextSynchronizer.layoutCache.get(el, ctx, (el) => {
      const rect = el.getBoundingClientRect();
      return { rect, width: rect.width, height: rect.height };
    });
  }
}

type StyleBundle = {
  translateZ: number;
  cssScale: number;
  rotateX: number;
  rotateY: number;
  rotateZ: number;
  cssScaleZ: number;
  opacity: number;
  color: string;
  metalness: number;
  roughness: number;
  emissive: string;
  castShadow: boolean;
  receiveShadow: boolean;
  materialType: string;
  fontFamily: string;
  fontCss: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  textAlign: "left" | "center" | "right";
  textTransform: string;
  textDepth: number;
  textCurveSegments: number;
  bevelEnabled: boolean;
  bevelSize: number;
  bevelThickness: number;
  bevelOffset: number;
  bevelSegments: number;
  textFit: "contain" | "cover" | "none";
};

type LayoutBundle = {
  rect: DOMRect;
  width: number;
  height: number;
};
