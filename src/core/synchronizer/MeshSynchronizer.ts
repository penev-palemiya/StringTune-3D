import { String3DObject } from "../String3DObject";
import { I3DEngine, I3DMaterialVisualProps } from "../abstractions/I3DEngine";
import type { SyncContext } from "./SyncContext";
import type { String3DObjectSyncStrategy } from "./String3DObjectSyncStrategy";
import { StyleBundleCache } from "./StyleBundleCache";

const DEG_TO_RAD = Math.PI / 180;

type ParsedRgb = { r: number; g: number; b: number };

function parseCssColorToRgb(value: string): ParsedRgb | null {
  const raw = (value || "").trim().toLowerCase();
  if (!raw) return null;

  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) {
    const normalized =
      raw.length === 4 ? `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}` : raw;
    const r = Number.parseInt(normalized.slice(1, 3), 16) / 255;
    const g = Number.parseInt(normalized.slice(3, 5), 16) / 255;
    const b = Number.parseInt(normalized.slice(5, 7), 16) / 255;
    return { r, g, b };
  }

  const rgb = raw.match(/rgba?\(([^)]+)\)/i);
  if (rgb) {
    const parts = rgb[1]
      .replace(/\//g, " ")
      .split(/[\s,]+/)
      .map((part) => Number.parseFloat(part.trim()))
      .filter((num) => Number.isFinite(num));
    if (parts.length >= 3) {
      return { r: parts[0] / 255, g: parts[1] / 255, b: parts[2] / 255 };
    }
  }

  if (raw === "black") return { r: 0, g: 0, b: 0 };
  if (raw === "white") return { r: 1, g: 1, b: 1 };
  return null;
}

function isBlackCssColor(value: string): boolean {
  const raw = (value || "").trim().toLowerCase();
  if (!raw) return false;
  if (raw === "black" || raw === "#000" || raw === "#000000") return true;

  const parsed = parseCssColorToRgb(raw);
  if (!parsed) return false;
  return parsed.r === 0 && parsed.g === 0 && parsed.b === 0;
}

function applyColorToTarget(target: any, value: string): boolean {
  if (!target) return false;

  if (typeof target.set === "function") {
    try {
      target.set(value);
      return true;
    } catch {}
  }

  const rgb = parseCssColorToRgb(value);
  if (!rgb) return false;

  if (typeof target.setRGB === "function") {
    target.setRGB(rgb.r, rgb.g, rgb.b);
    return true;
  }

  if ("r" in target && "g" in target && "b" in target) {
    target.r = rgb.r;
    target.g = rgb.g;
    target.b = rgb.b;
    return true;
  }

  return false;
}

export class MeshSynchronizer implements String3DObjectSyncStrategy {
  private static styleCache = new StyleBundleCache<StyleBundle>();
  private static layoutCache = new StyleBundleCache<LayoutBundle>();
  private static tempVector3: any = null;
  private static lastVisualProps: WeakMap<
    String3DObject,
    {
      opacity?: number;
      color?: string;
      metalness?: number;
      roughness?: number;
      emissive?: string;
      castShadow?: boolean;
      receiveShadow?: boolean;
    }
  > = new WeakMap();
  private static lastGeometryQuality: WeakMap<String3DObject, number> = new WeakMap();
  private static originalGeometryByMesh: WeakMap<object, any> = new WeakMap();
  private static lodGeometryCacheByMesh: WeakMap<object, Map<string, any>> = new WeakMap();

  static resolveEmissiveValue(el: HTMLElement, emissive?: string): string | undefined {
    if (!emissive || emissive === "none") return undefined;

    const inlineRaw = el.style.getPropertyValue("--material-emissive").trim();
    if (inlineRaw) {
      return emissive;
    }

    return isBlackCssColor(emissive) ? undefined : emissive;
  }

  static applyVisualProps(
    el: HTMLElement,
    object: String3DObject,
    engine: I3DEngine,
    props: {
      opacity?: number;
      color?: string;
      metalness?: number;
      roughness?: number;
      emissive?: string;
      castShadow?: boolean;
      receiveShadow?: boolean;
    },
  ): void {
    const prev = MeshSynchronizer.lastVisualProps.get(object);
    if (prev) {
      if (
        prev.opacity === props.opacity &&
        prev.color === props.color &&
        prev.metalness === props.metalness &&
        prev.roughness === props.roughness &&
        prev.emissive === props.emissive &&
        prev.castShadow === props.castShadow &&
        prev.receiveShadow === props.receiveShadow
      )
        return;
      prev.opacity = props.opacity;
      prev.color = props.color;
      prev.metalness = props.metalness;
      prev.roughness = props.roughness;
      prev.emissive = props.emissive;
      prev.castShadow = props.castShadow;
      prev.receiveShadow = props.receiveShadow;
    } else {
      MeshSynchronizer.lastVisualProps.set(object, {
        opacity: props.opacity,
        color: props.color,
        metalness: props.metalness,
        roughness: props.roughness,
        emissive: props.emissive,
        castShadow: props.castShadow,
        receiveShadow: props.receiveShadow,
      });
    }

    const castShadow = props.castShadow ?? false;
    const receiveShadow = props.receiveShadow ?? false;

    const opacity = typeof props.opacity === "number" ? props.opacity : NaN;

    const materialProps: I3DMaterialVisualProps = {
      opacity: Number.isFinite(opacity) ? opacity : undefined,
      color: props.color,
      metalness: Number.isFinite(props.metalness as number) ? props.metalness : undefined,
      roughness: Number.isFinite(props.roughness as number) ? props.roughness : undefined,
      emissive: props.emissive,
    };

    const applyMaterialProps = (mat: any) => {
      if (!mat) return;

      if (engine.applyMaterialProps?.(mat, materialProps)) {
        return;
      }

      if (!isNaN(opacity)) {
        mat.opacity = opacity;
        mat.transparent = opacity < 1;
      }

      if (props.color && mat.color) {
        applyColorToTarget(mat.color, props.color);
      }

      if (typeof props.metalness === "number" && "metalness" in mat) {
        mat.metalness = props.metalness;
      }

      if (typeof props.roughness === "number" && "roughness" in mat) {
        mat.roughness = props.roughness;
      }

      if (props.emissive) {
        if (mat.emissive) {
          applyColorToTarget(mat.emissive, props.emissive);
        }
      }
    };

    engine.forEachMesh(object.object, (mesh) => {
      if (mesh.castShadow !== castShadow) mesh.castShadow = castShadow;
      if (mesh.receiveShadow !== receiveShadow) mesh.receiveShadow = receiveShadow;

      const materials = Array.isArray((mesh as any).material)
        ? (mesh as any).material
        : [(mesh as any).material];
      materials.forEach(applyMaterialProps);
    });
  }

  sync(el: HTMLElement, object: String3DObject, ctx: SyncContext, parentData: any): any {
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
      geometryQuality,
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
    object.object.rotation.y = rotateY * DEG_TO_RAD;
    object.object.rotation.z = -rotateZ * DEG_TO_RAD;
    object.object.rotation.order = "XYZ";

    const targetWidth = originalWidth * cssScale;
    const targetHeight = originalHeight * cssScale;
    const parentScale = parentData?.scale || 1;
    const baseScaleZ = cssScaleZ * parentScale;
    const minTargetSize = targetWidth < targetHeight ? targetWidth : targetHeight;
    let scaleX: number, scaleY: number, scaleZ: number;

    switch (object.type) {
      case "box":
      case "sphere": {
        const uniformSize = minTargetSize * parentScale;
        scaleX = scaleY = uniformSize;
        scaleZ = uniformSize * cssScaleZ;
        break;
      }
      case "model": {
        const bbox = object.getOriginalBoundingBox();
        if (!MeshSynchronizer.tempVector3) {
          MeshSynchronizer.tempVector3 = ctx.engine.createVector3();
        }
        const size = bbox.getSize(MeshSynchronizer.tempVector3);
        const fitMode = el.getAttribute("string-3d-model-fit");
        const modelScale = parseFloat(el.getAttribute("string-3d-model-scale") || "1");
        const finalModelScale = Number.isFinite(modelScale)
          ? modelScale * parentScale
          : parentScale;

        if (size.x > 0 && size.y > 0) {
          const scaleW = targetWidth / size.x;
          const scaleH = targetHeight / size.y;
          const uniformScale =
            (fitMode === "cover"
              ? scaleW > scaleH
                ? scaleW
                : scaleH
              : scaleW < scaleH
                ? scaleW
                : scaleH) * finalModelScale;
          scaleX = scaleY = uniformScale;
          scaleZ = uniformScale * cssScaleZ;
        } else {
          const fallbackSize = minTargetSize * finalModelScale;
          scaleX = scaleY = fallbackSize;
          scaleZ = fallbackSize * cssScaleZ;
        }
        break;
      }
      case "cylinder":
        scaleX = targetWidth * parentScale;
        scaleY = targetHeight * parentScale;
        scaleZ = targetWidth * baseScaleZ;
        break;
      default:
        scaleX = targetWidth * parentScale;
        scaleY = targetHeight * parentScale;
        scaleZ = minTargetSize * 0.5 * baseScaleZ;
        break;
    }

    object.object.scale.set(scaleX, scaleY, scaleZ);

    MeshSynchronizer.applyVisualProps(el, object, ctx.engine, {
      opacity,
      color: color && color !== "none" ? color : undefined,
      metalness: isNaN(metalness) ? undefined : metalness,
      roughness: isNaN(roughness) ? undefined : roughness,
      emissive: MeshSynchronizer.resolveEmissiveValue(el, emissive),
      castShadow,
      receiveShadow,
    });

    this.applyGeometryQuality(object, geometryQuality, ctx);

    this.updateCustomUniforms(el, object, ctx);

    return { scale: cssScale * parentScale };
  }

  private applyGeometryQuality(object: String3DObject, quality: number, ctx: SyncContext): void {
    const simplify = ctx.engine.simplifyGeometry?.bind(ctx.engine);
    if (typeof simplify !== "function") return;

    const normalized = Number.isFinite(quality) && quality > 0 ? quality : 1;
    const prev = MeshSynchronizer.lastGeometryQuality.get(object);
    if (typeof prev === "number" && Math.abs(prev - normalized) < 0.001) return;
    MeshSynchronizer.lastGeometryQuality.set(object, normalized);

    const applyToMesh = (mesh: any) => {
      if (!mesh?.geometry) return;
      if (!MeshSynchronizer.originalGeometryByMesh.has(mesh)) {
        MeshSynchronizer.originalGeometryByMesh.set(mesh, mesh.geometry);
      }
      const original = MeshSynchronizer.originalGeometryByMesh.get(mesh);
      if (normalized >= 0.999) {
        mesh.geometry = original;
        return;
      }
      if (!MeshSynchronizer.lodGeometryCacheByMesh.has(mesh)) {
        MeshSynchronizer.lodGeometryCacheByMesh.set(mesh, new Map<string, any>());
      }
      const lodCache = MeshSynchronizer.lodGeometryCacheByMesh.get(mesh)!;
      const key = normalized.toFixed(3);
      if (lodCache.has(key)) {
        mesh.geometry = lodCache.get(key);
        return;
      }
      const simplified = simplify(original, normalized);
      if (simplified) {
        lodCache.set(key, simplified);
        mesh.geometry = simplified;
      }
    };
    ctx.engine.forEachMesh(object.object, applyToMesh);
  }

  private updateCustomUniforms(el: HTMLElement, object: String3DObject, ctx: SyncContext): void {
    const factory = ctx.engine.getMaterialFactory?.();
    if (!factory) return;

    const style = getComputedStyle(el);

    const apply = (mat: any) => {
      const definition = factory.getMaterialDefinition?.(mat) ?? mat?.userData?.definition;
      if (!definition?.uniforms) return;

      const values = factory.parseUniformsFromCSS(definition, el, style);

      if (typeof factory.applyUniforms === "function") {
        factory.applyUniforms(mat, definition, values);
        return;
      }

      for (const [key, value] of Object.entries(values)) {
        const def = definition.uniforms?.[key];
        if (!def) continue;

        const converter = (factory as any).convertUniformValue?.bind(factory);
        const converted = converter ? converter(def.type, value) : value;

        if (mat.uniforms?.[key]) {
          mat.uniforms[key].value = converted;
        }
      }
    };
    ctx.engine.forEachMaterial(object.object, apply);
  }

  private readStyleBundle(el: HTMLElement, ctx: SyncContext): StyleBundle {
    return MeshSynchronizer.styleCache.get(el, ctx, (el) => {
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

      const readString = (prop: string): string | undefined => {
        const mapValue = styleMap?.get?.(prop);
        const val =
          mapValue && typeof mapValue === "object" && "value" in (mapValue as any)
            ? (mapValue as any).value
            : mapValue;
        if (typeof val === "string") return val.trim() || undefined;
        const raw = style.getPropertyValue(prop).trim();
        return raw || undefined;
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

      return {
        translateZ: readNumber("--translate-z", 0),
        cssScale: readNumber("--scale", 1),
        rotateX: readNumber("--rotate-x", 0),
        rotateY: readNumber("--rotate-y", 0),
        rotateZ: readNumber("--rotate-z", 0),
        cssScaleZ: readNumber("--scale-z", 1),
        opacity: readNumber("--opacity", NaN),
        color: readString("--material-color"),
        metalness: readNumber("--material-metalness", NaN),
        roughness: readNumber("--material-roughness", NaN),
        emissive: readString("--material-emissive"),
        castShadow: readBool("--shadow-cast", false),
        receiveShadow: readBool("--shadow-receive", false),
        geometryQuality: readNumber("--geometry-quality", 1),
      };
    });
  }

  private readLayout(el: HTMLElement, ctx: SyncContext): LayoutBundle {
    const cached = (el as any).__layoutCache;
    if (cached) {
      return cached;
    }

    return MeshSynchronizer.layoutCache.get(el, ctx, (el) => {
      const rect = el.getBoundingClientRect();
      const width = el.offsetWidth || rect.width;
      const height = el.offsetHeight || rect.height;
      return { rect, width, height };
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
  color?: string;
  metalness: number;
  roughness: number;
  emissive?: string;
  castShadow: boolean;
  receiveShadow: boolean;
  geometryQuality: number;
};

type LayoutBundle = {
  rect: DOMRect;
  width: number;
  height: number;
};
