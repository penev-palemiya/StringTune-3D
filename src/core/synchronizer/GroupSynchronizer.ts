import { String3DObject } from "../String3DObject";
import type { String3DObjectSyncStrategy } from "./String3DObjectSyncStrategy";
import type { SyncContext } from "./SyncContext";
import { StyleReader } from "../../modules/string3d/styleUtils";
import { StyleBundleCache } from "./StyleBundleCache";

const DEG_TO_RAD = Math.PI / 180;

type GroupStyleBundle = {
  translateZ: number;
  scale: number;
  rotateX: number;
  rotateY: number;
  rotateZ: number;
};

export class GroupSynchronizer implements String3DObjectSyncStrategy {
  private static styleCache = new StyleBundleCache<GroupStyleBundle>();

  sync(el: HTMLElement, object: String3DObject, ctx: SyncContext, parentData: any): any {
    const cached = (el as any).__layoutCache;
    const rect = cached ? cached.rect : el.getBoundingClientRect();
    const bundle = this.readStyleBundle(el, ctx);

    const screenCenterX = rect.left + rect.width * 0.5;
    const screenCenterY = rect.top + rect.height * 0.5;

    if (ctx.camera.getMode() === "orthographic") {
      object.object.position.set(
        screenCenterX - ctx.viewportWidth / 2,
        -(screenCenterY - ctx.viewportHeight / 2),
        bundle.translateZ
      );
    } else {
      const frustum = ctx.camera.getFrustumSizeAt(bundle.translateZ);
      const normalizedX = screenCenterX / ctx.viewportWidth;
      const normalizedY = screenCenterY / ctx.viewportHeight;
      object.object.position.set(
        (normalizedX - 0.5) * frustum.width,
        -(normalizedY - 0.5) * frustum.height,
        bundle.translateZ
      );
    }

    object.object.scale.set(bundle.scale, bundle.scale, bundle.scale);

    object.object.rotation.x = -bundle.rotateX * DEG_TO_RAD;
    object.object.rotation.y = bundle.rotateY * DEG_TO_RAD;
    object.object.rotation.z = -bundle.rotateZ * DEG_TO_RAD;
    object.object.rotation.order = "XYZ";

    object.object.updateMatrixWorld(true);

    return { scale: bundle.scale };
  }

  private readStyleBundle(el: HTMLElement, ctx: SyncContext): GroupStyleBundle {
    return GroupSynchronizer.styleCache.get(el, ctx, (el) => {
      const styles = new StyleReader(el);
      return {
        translateZ: styles.readNumber("--translate-z", 0),
        scale: styles.readNumber("--scale", 1),
        rotateX: styles.readNumber("--rotate-x", 0),
        rotateY: styles.readNumber("--rotate-y", 0),
        rotateZ: styles.readNumber("--rotate-z", 0),
      };
    });
  }
}
