import { String3DObject } from "../String3DObject";
import type { SyncContext } from "./SyncContext";
import type { String3DObjectSyncStrategy } from "./String3DObjectSyncStrategy";
import { StyleBundleCache } from "./StyleBundleCache";

const DEG_TO_RAD = Math.PI / 180;

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

  static applyVisualProps(
    el: HTMLElement,
    object: String3DObject,
    props: {
      opacity?: number;
      color?: string;
      metalness?: number;
      roughness?: number;
      emissive?: string;
      castShadow?: boolean;
      receiveShadow?: boolean;
    }
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

    const applyMaterialProps = (mat: any) => {
      if (!mat) return;

      if (!isNaN(opacity)) {
        mat.opacity = opacity;
        mat.transparent = opacity < 1;
      }

      if (props.color && mat.color && mat.color.set) {
        mat.color.set(props.color);
      }

      if (typeof props.metalness === "number" && "metalness" in mat) {
        mat.metalness = props.metalness;
      }

      if (typeof props.roughness === "number" && "roughness" in mat) {
        mat.roughness = props.roughness;
      }

      if (props.emissive && mat.emissive && mat.emissive.set) {
        mat.emissive.set(props.emissive);
      }
    };

    if (object.object.traverse) {
      object.object.traverse((child: any) => {
        if (child.isMesh) {
          if (child.castShadow !== castShadow) child.castShadow = castShadow;
          if (child.receiveShadow !== receiveShadow) child.receiveShadow = receiveShadow;

          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach(applyMaterialProps);
        }
      });
    } else if ((object.object as any).isMesh) {
      const mesh = object.object as any;
      if (mesh.castShadow !== castShadow) mesh.castShadow = castShadow;
      if (mesh.receiveShadow !== receiveShadow) mesh.receiveShadow = receiveShadow;

      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach(applyMaterialProps);
    }
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

    MeshSynchronizer.applyVisualProps(el, object, {
      opacity,
      color: color && color !== "none" ? color : undefined,
      metalness: isNaN(metalness) ? undefined : metalness,
      roughness: isNaN(roughness) ? undefined : roughness,
      emissive: emissive && emissive !== "none" ? emissive : undefined,
      castShadow,
      receiveShadow,
    });

    this.applyGeometryQuality(object, geometryQuality, ctx);

    this.updateCustomUniforms(el, object, ctx);

    return { scale: cssScale * parentScale };
  }

  private applyGeometryQuality(object: String3DObject, quality: number, ctx: SyncContext): void {
    const engine: any = ctx.engine as any;
    const simplify = engine?.simplifyGeometry?.bind(engine);
    if (typeof simplify !== "function") return;

    const normalized = Number.isFinite(quality) && quality > 0 ? quality : 1;
    const prev = MeshSynchronizer.lastGeometryQuality.get(object);
    if (typeof prev === "number" && Math.abs(prev - normalized) < 0.001) return;
    MeshSynchronizer.lastGeometryQuality.set(object, normalized);

    const applyToMesh = (mesh: any) => {
      if (!mesh?.geometry) return;
      const userData = mesh.userData || (mesh.userData = {});
      if (!userData.__originalGeometry) {
        userData.__originalGeometry = mesh.geometry;
      }
      const original = userData.__originalGeometry;
      if (normalized >= 0.999) {
        mesh.geometry = original;
        return;
      }
      if (!userData.__lodCache) {
        userData.__lodCache = new Map<string, any>();
      }
      const key = normalized.toFixed(3);
      if (userData.__lodCache.has(key)) {
        mesh.geometry = userData.__lodCache.get(key);
        return;
      }
      const simplified = simplify(original, normalized);
      if (simplified) {
        userData.__lodCache.set(key, simplified);
        mesh.geometry = simplified;
      }
    };

    if (object.object.traverse) {
      object.object.traverse((child: any) => {
        if (child?.isMesh) applyToMesh(child);
      });
    } else if ((object.object as any).isMesh) {
      applyToMesh(object.object as any);
    }
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
    } else if ((object.object as any).isMesh) {
      const mesh = object.object as any;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach(apply);
    }
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
