import { String3DObject } from "../String3DObject";
import type { SyncContext } from "./SyncContext";
import type { String3DObjectSyncStrategy } from "./String3DObjectSyncStrategy";

export class MeshSynchronizer implements String3DObjectSyncStrategy {
  sync(el: HTMLElement, object: String3DObject, ctx: SyncContext, parentData: any): any {
    const style = getComputedStyle(el);

    const originalWidth = el.offsetWidth;
    const originalHeight = el.offsetHeight;
    const rect = el.getBoundingClientRect();

    const translateZ = parseFloat(style.getPropertyValue("--translate-z") || "0");
    const cssScale = parseFloat(style.getPropertyValue("--scale") || "1");

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const worldPos = ctx.camera.screenToWorld(centerX, centerY, translateZ);
    object.position = worldPos;

    const rotateX = -ctx.engine.degToRad(parseFloat(style.getPropertyValue("--rotate-x") || "0"));
    const rotateY = ctx.engine.degToRad(parseFloat(style.getPropertyValue("--rotate-y") || "0"));
    const rotateZ = -ctx.engine.degToRad(parseFloat(style.getPropertyValue("--rotate-z") || "0"));
    object.rotation = ctx.engine.createEuler(rotateX, rotateY, rotateZ, "XYZ");

    const targetWidth = originalWidth * cssScale;
    const targetHeight = originalHeight * cssScale;
    const cssScaleZ = parseFloat(style.getPropertyValue("--scale-z") || "1");
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
        const fitMode = (el.getAttribute("string-3d-model-fit") || "contain")
          .toLowerCase()
          .trim();
        const modelScaleAttr = parseFloat(
          el.getAttribute("string-3d-model-scale") || "1"
        );
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

    return { scale: cssScale * parentScale };
  }
}
