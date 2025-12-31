import { String3DObject } from "../String3DObject";
import type { SyncContext } from "./SyncContext";
import type { String3DObjectSyncStrategy } from "./String3DObjectSyncStrategy";

type StyleMap = {
  get?: (prop: string) => any;
};

export class MeshSynchronizer implements String3DObjectSyncStrategy {
  static applyVisualProps(el: HTMLElement, object: String3DObject, opacityValue?: number): void {
    const castShadow = el.getAttribute("string-3d-cast-shadow") === "true";
    const receiveShadow = el.getAttribute("string-3d-receive-shadow") === "true";

    const opacity = typeof opacityValue === "number" ? opacityValue : NaN;

    if (object.object.traverse) {
      object.object.traverse((child: any) => {
        if (child.isMesh) {
          if (child.castShadow !== castShadow) child.castShadow = castShadow;
          if (child.receiveShadow !== receiveShadow) child.receiveShadow = receiveShadow;

          if (!isNaN(opacity)) {
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materials.forEach((mat: any) => {
              if (mat) {
                mat.opacity = opacity;
                mat.transparent = opacity < 1;
              }
            });
          }
        }
      });
    } else if ((object.object as any).isMesh) {
      const mesh = object.object as any;
      if (mesh.castShadow !== castShadow) mesh.castShadow = castShadow;
      if (mesh.receiveShadow !== receiveShadow) mesh.receiveShadow = receiveShadow;

      if (!isNaN(opacity)) {
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((mat: any) => {
          if (mat) {
            mat.opacity = opacity;
            mat.transparent = opacity < 1;
          }
        });
      }
    }
  }

  sync(el: HTMLElement, object: String3DObject, ctx: SyncContext, parentData: any): any {
    const styleMap = (el as any).computedStyleMap?.() as StyleMap | undefined;
    let style: CSSStyleDeclaration | null = null;
    const getStyle = () => {
      if (!style) style = getComputedStyle(el);
      return style;
    };

    const rect = el.getBoundingClientRect();
    const originalWidth = el.offsetWidth || rect.width;
    const originalHeight = el.offsetHeight || rect.height;

    const readNumberStyle = (prop: string, fallback: number): number => {
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

      const raw = getStyle().getPropertyValue(prop);
      const parsed = Number.parseFloat(raw);
      return Number.isNaN(parsed) ? fallback : parsed;
    };

    const translateZ = readNumberStyle("--translate-z", 0);
    const cssScale = readNumberStyle("--scale", 1);

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const worldPos = ctx.camera.screenToWorld(centerX, centerY, translateZ);
    object.position = worldPos;

    const rotateX = -ctx.engine.degToRad(readNumberStyle("--rotate-x", 0));
    const rotateY = ctx.engine.degToRad(readNumberStyle("--rotate-y", 0));
    const rotateZ = -ctx.engine.degToRad(readNumberStyle("--rotate-z", 0));
    object.rotation = ctx.engine.createEuler(rotateX, rotateY, rotateZ, "XYZ");

    const targetWidth = originalWidth * cssScale;
    const targetHeight = originalHeight * cssScale;
    const cssScaleZ = readNumberStyle("--scale-z", 1);
    const parentScale = parentData?.scale || 1;

    const objectType = object.type;
    let scaleX: number, scaleY: number, scaleZ: number;

    switch (objectType) {
      case "box":
      case "sphere": {
        const uniformSize = Math.min(targetWidth, targetHeight);
        scaleX = uniformSize * parentScale;
        scaleY = uniformSize * parentScale;
        scaleZ = uniformSize * cssScaleZ * parentScale;
        break;
      }
      case "model": {
        const bbox = object.getOriginalBoundingBox();
        const size = bbox.getSize(ctx.engine.createVector3());
        const fitMode = (el.getAttribute("string-3d-model-fit") || "contain").toLowerCase().trim();
        const modelScaleAttr = parseFloat(el.getAttribute("string-3d-model-scale") || "1");
        const modelScale = Number.isFinite(modelScaleAttr) ? modelScaleAttr : 1;

        if (size.x > 0 && size.y > 0) {
          const scaleToWidth = targetWidth / size.x;
          const scaleToHeight = targetHeight / size.y;
          const uniformScale =
            fitMode === "cover"
              ? Math.max(scaleToWidth, scaleToHeight)
              : Math.min(scaleToWidth, scaleToHeight);

          scaleX = uniformScale * modelScale * parentScale;
          scaleY = uniformScale * modelScale * parentScale;
          scaleZ = uniformScale * modelScale * cssScaleZ * parentScale;
        } else {
          const fallbackSize = Math.min(targetWidth, targetHeight);
          scaleX = fallbackSize * modelScale * parentScale;
          scaleY = fallbackSize * modelScale * parentScale;
          scaleZ = fallbackSize * modelScale * cssScaleZ * parentScale;
        }
        break;
      }
      case "cylinder": {
        const cylRadius = targetWidth;
        scaleX = cylRadius * parentScale;
        scaleY = targetHeight * parentScale;
        scaleZ = cylRadius * cssScaleZ * parentScale;
        break;
      }
      case "plane":
      default:
        scaleX = targetWidth * parentScale;
        scaleY = targetHeight * parentScale;
        scaleZ = Math.min(targetWidth, targetHeight) * 0.5 * cssScaleZ * parentScale;
        break;
    }

    object.scale = ctx.engine.createVector3(scaleX, scaleY, scaleZ);

    const opacity = readNumberStyle("--opacity", NaN);
    MeshSynchronizer.applyVisualProps(el, object, opacity);

    return { scale: cssScale * parentScale };
  }
}
