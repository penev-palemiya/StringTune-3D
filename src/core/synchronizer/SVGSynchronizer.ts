import { String3DObject } from "../String3DObject";
import type { SyncContext } from "./SyncContext";
import type { String3DObjectSyncStrategy } from "./String3DObjectSyncStrategy";
import { StyleBundleCache } from "./StyleBundleCache";
import { MeshSynchronizer } from "./MeshSynchronizer";
import { SVGParser } from "../svg/SVGParser";
import type { ParsedSVGData } from "../svg/SVGParser";
const DEG_TO_RAD = Math.PI / 180;
function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}
type MorphState = {
  startTime: number;
  duration: number;
  swapped: boolean;
};
export class SVGSynchronizer implements String3DObjectSyncStrategy {
  private static styleCache = new StyleBundleCache<StyleBundle>();
  private static geometryKeys: WeakMap<String3DObject, string> = new WeakMap();
  private static lastMaterialType: WeakMap<String3DObject, string> = new WeakMap();
  private static svgCache: WeakMap<HTMLElement, ParsedSVGData> = new WeakMap();
  private static svgFetchCache: Map<string, ParsedSVGData | null> = new Map();
  private static svgFetchPromises: Map<string, Promise<ParsedSVGData | null>> = new Map();
  private static pendingSrcObjects: Map<string, Set<String3DObject>> = new Map();
  private static mutationObservers: WeakMap<HTMLElement, MutationObserver> = new WeakMap();
  private static morphStates: WeakMap<String3DObject, MorphState> = new WeakMap();
  private static svgSignatures: WeakMap<String3DObject, string> = new WeakMap();
  sync(el: HTMLElement, object: String3DObject, ctx: SyncContext, parentData: any): any {
    SVGSynchronizer.setupMutationObserver(el, object);
    const rect = el.getBoundingClientRect();
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
      svgDepth,
      svgCurveSegments,
      bevelEnabled,
      bevelSize,
      bevelThickness,
      bevelOffset,
      bevelSegments,
      svgSrc,
      morphDuration,
    } = bundle;
    const screenCenterX = rect.left + rect.width * 0.5;
    const screenCenterY = rect.top + rect.height * 0.5;
    if (ctx.camera.getMode() === "orthographic") {
      object.object.position.set(
        screenCenterX - ctx.viewportWidth / 2,
        -(screenCenterY - ctx.viewportHeight / 2),
        translateZ,
      );
    } else {
      const frustum = ctx.camera.getFrustumSizeAt(translateZ);
      const normalizedX = screenCenterX / ctx.viewportWidth;
      const normalizedY = screenCenterY / ctx.viewportHeight;
      object.object.position.set(
        (normalizedX - 0.5) * frustum.width,
        -(normalizedY - 0.5) * frustum.height,
        translateZ,
      );
    }
    object.object.rotation.x = -rotateX * DEG_TO_RAD;
    object.object.rotation.z = -rotateZ * DEG_TO_RAD;
    object.object.rotation.order = "XYZ";
    if (opacity === 0) {
      object.object.visible = false;
      return { scale: cssScale * (parentData?.scale || 1) };
    }
    object.object.visible = true;
    if (!ctx.engine.createSVGGeometry) {
      object.object.rotation.y = rotateY * DEG_TO_RAD;
      return { scale: cssScale * (parentData?.scale || 1) };
    }
    const mesh = ctx.engine.getPrimaryMesh(object.object);
    if (!mesh) {
      object.object.rotation.y = rotateY * DEG_TO_RAD;
      return { scale: cssScale * (parentData?.scale || 1) };
    }
    const svgData = this.resolveSVGData(el, svgSrc, object);
    if (!svgData) {
      mesh.visible = false;
      object.object.rotation.y = rotateY * DEG_TO_RAD;
      return { scale: cssScale * (parentData?.scale || 1) };
    }
    mesh.visible = true;
    const currentSig = svgData.paths.map((p) => p.d).join("~");
    const prevSig = SVGSynchronizer.svgSignatures.get(object);
    if (prevSig !== undefined && prevSig !== currentSig) {
      SVGSynchronizer.morphStates.set(object, {
        startTime: performance.now(),
        duration: morphDuration,
        swapped: false,
      });
    }
    SVGSynchronizer.svgSignatures.set(object, currentSig);
    let morphFactor = 1;
    let morphRotationBonus = 0;
    const morphState = SVGSynchronizer.morphStates.get(object);
    if (morphState) {
      const elapsed = performance.now() - morphState.startTime;
      const raw = Math.min(elapsed / morphState.duration, 1);
      const eased = easeInOut(raw);
      if (raw >= 1) {
        SVGSynchronizer.morphStates.delete(object);
        morphFactor = 1;
      } else if (eased < 0.5) {
        morphFactor = 1 - eased * 2;
      } else {
        if (!morphState.swapped) {
          morphState.swapped = true;
          SVGSynchronizer.geometryKeys.delete(object);
        }
        morphFactor = (eased - 0.5) * 2;
      }
      morphRotationBonus = Math.sin(eased * Math.PI) * 90 * DEG_TO_RAD;
    }
    object.object.rotation.y = rotateY * DEG_TO_RAD + morphRotationBonus;
    const vb = svgData.viewBox;
    const svgW = vb?.width || svgData.naturalWidth || rect.width;
    const svgH = vb?.height || svgData.naturalHeight || rect.height;
    const svgScale = svgW > 0 && svgH > 0 ? Math.min(rect.width / svgW, rect.height / svgH) : 1;
    const holdOldGeometry = morphState && !morphState.swapped;
    if (!holdOldGeometry) {
      const pathsSig = svgData.paths.map((p) => p.d.length).join(",");
      const key = [
        pathsSig,
        svgScale.toFixed(4),
        rect.width.toFixed(1),
        rect.height.toFixed(1),
        svgDepth.toFixed(3),
        svgCurveSegments,
        bevelEnabled ? "1" : "0",
        bevelSize.toFixed(3),
        bevelThickness.toFixed(3),
        bevelOffset.toFixed(3),
        bevelSegments,
      ].join("|");
      const prevKey = SVGSynchronizer.geometryKeys.get(object);
      if (prevKey !== key) {
        const scaledPaths = svgData.paths.map((p) => {
          if (!p.transform) {
            return {
              d: p.d,
              transform: { a: svgScale, b: 0, c: 0, d: svgScale, e: 0, f: 0 },
            };
          }
          return {
            d: p.d,
            transform: {
              a: p.transform.a * svgScale,
              b: p.transform.b * svgScale,
              c: p.transform.c * svgScale,
              d: p.transform.d * svgScale,
              e: p.transform.e * svgScale,
              f: p.transform.f * svgScale,
            },
          };
        });
        const scaledViewBox = vb
          ? {
              x: vb.x * svgScale,
              y: vb.y * svgScale,
              width: vb.width * svgScale,
              height: vb.height * svgScale,
            }
          : null;
        const geometry = ctx.engine.createSVGGeometry(scaledPaths, scaledViewBox, {
          depth: svgDepth,
          curveSegments: Math.max(1, Math.round(svgCurveSegments)),
          bevelEnabled,
          bevelThickness,
          bevelSize,
          bevelOffset,
          bevelSegments: Math.max(0, Math.round(bevelSegments)),
        });
        if (geometry) {
          geometry.computeBoundingBox();
          const appliedToMesh = ctx.engine.applyTextGeometryToMesh(mesh, geometry);
          if (!appliedToMesh) {
            if (mesh.geometry) {
              mesh.geometry.dispose?.();
            }
            mesh.geometry = geometry;
          }
          object.geometry = geometry;
          SVGSynchronizer.geometryKeys.set(object, key);
        }
      }
    }
    const parentScale = parentData?.scale || 1;
    const perPixel =
      ctx.camera.getMode() === "orthographic"
        ? 1
        : ctx.camera.getScaleAtZ(translateZ, ctx.viewportHeight);
    const scaleFactor = cssScale * parentScale * perPixel;
    const mf = Math.max(0.0001, morphFactor);
    object.object.scale.set(scaleFactor * mf, scaleFactor * mf, scaleFactor * cssScaleZ * mf);
    mesh.position.set(0, 0, 0);
    const prevMaterialType = SVGSynchronizer.lastMaterialType.get(object);
    if (prevMaterialType !== undefined && prevMaterialType !== materialType) {
      const scene = ctx.scene;
      if (scene) {
        requestAnimationFrame(() => {
          scene.recreateMaterialForObject(object, el);
        });
      }
    }
    SVGSynchronizer.lastMaterialType.set(object, materialType);
    MeshSynchronizer.applyVisualProps(el, object, ctx.engine, {
      opacity,
      color: color && color !== "none" ? color : undefined,
      metalness: Number.isFinite(metalness) ? metalness : undefined,
      roughness: Number.isFinite(roughness) ? roughness : undefined,
      emissive: MeshSynchronizer.resolveEmissiveValue(el, emissive),
      castShadow,
      receiveShadow,
    });
    return { scale: scaleFactor };
  }
  cleanup(el: HTMLElement, object: String3DObject): void {
    SVGSynchronizer.geometryKeys.delete(object);
    SVGSynchronizer.svgCache.delete(el);
    SVGSynchronizer.morphStates.delete(object);
    SVGSynchronizer.svgSignatures.delete(object);
    const observer = SVGSynchronizer.mutationObservers.get(el);
    if (observer) {
      observer.disconnect();
      SVGSynchronizer.mutationObservers.delete(el);
    }
  }
  private resolveSVGData(
    el: HTMLElement,
    svgSrc: string,
    object: String3DObject,
  ): ParsedSVGData | null {
    const inlineSvg = el.querySelector("svg");
    if (inlineSvg) {
      const cached = SVGSynchronizer.svgCache.get(el);
      if (cached) return cached;
      const data = SVGParser.fromElement(inlineSvg as SVGSVGElement);
      if (data && data.paths.length > 0) {
        SVGSynchronizer.svgCache.set(el, data);
        return data;
      }
    }
    const src = svgSrc || el.getAttribute("data-svg-src") || "";
    if (!src) return null;
    const cached = SVGSynchronizer.svgFetchCache.get(src);
    if (cached !== undefined) return cached;
    if (!SVGSynchronizer.svgFetchPromises.has(src)) {
      const promise = fetch(src)
        .then((r) => r.text())
        .then((text) => {
          const data = SVGParser.fromString(text);
          SVGSynchronizer.svgFetchCache.set(src, data);
          SVGSynchronizer.invalidatePendingSrcObjects(src);
          return data;
        })
        .catch(() => {
          SVGSynchronizer.svgFetchCache.set(src, null);
          return null;
        });
      SVGSynchronizer.svgFetchPromises.set(src, promise);
    }
    SVGSynchronizer.markObjectPendingSrc(src, object);
    return null;
  }
  private static markObjectPendingSrc(src: string, object: String3DObject): void {
    let set = this.pendingSrcObjects.get(src);
    if (!set) {
      set = new Set();
      this.pendingSrcObjects.set(src, set);
    }
    set.add(object);
  }
  private static invalidatePendingSrcObjects(src: string): void {
    const set = this.pendingSrcObjects.get(src);
    if (set) {
      set.forEach((obj) => this.geometryKeys.delete(obj));
      set.clear();
    }
  }
  private static setupMutationObserver(el: HTMLElement, _object: String3DObject): void {
    if (SVGSynchronizer.mutationObservers.has(el)) return;
    const observer = new MutationObserver(() => {
      SVGSynchronizer.svgCache.delete(el);
    });
    observer.observe(el, { childList: true, subtree: true, attributes: true });
    SVGSynchronizer.mutationObservers.set(el, observer);
  }
  private readStyleBundle(el: HTMLElement, ctx: SyncContext): StyleBundle {
    return SVGSynchronizer.styleCache.get(el, ctx, (el) => {
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
        const num = Number.parseFloat(style.getPropertyValue(prop));
        return Number.isNaN(num) ? fallback : num;
      };
      const readString = (prop: string, fallback = ""): string => {
        const mapValue = styleMap?.get?.(prop);
        const val =
          mapValue && typeof mapValue === "object" && "value" in (mapValue as any)
            ? (mapValue as any).value
            : mapValue;
        if (typeof val === "string") return val.trim() || fallback;
        return style.getPropertyValue(prop).trim() || fallback;
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
      const bevelSize = readNumber("--svg-bevel-size", 0);
      const bevelThickness = readNumber("--svg-bevel-thickness", 0);
      const depthRaw = readNumber("--svg-depth", NaN);
      const svgDepth = Number.isFinite(depthRaw) ? depthRaw : 10;
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
        svgDepth,
        svgCurveSegments: readNumber("--svg-curve-segments", 12),
        bevelEnabled: bevelSize > 0 || bevelThickness > 0,
        bevelSize,
        bevelThickness,
        bevelOffset: readNumber("--svg-bevel-offset", 0),
        bevelSegments: readNumber("--svg-bevel-steps", 3),
        svgSrc: readString("--svg-src"),
        morphDuration: readNumber("--svg-morph-duration", 600),
      };
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
  svgDepth: number;
  svgCurveSegments: number;
  bevelEnabled: boolean;
  bevelSize: number;
  bevelThickness: number;
  bevelOffset: number;
  bevelSegments: number;
  svgSrc: string;
  morphDuration: number;
};
