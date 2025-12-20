import { String3DObject } from "../String3DObject";
import type { String3DObjectSyncStrategy } from "./String3DObjectSyncStrategy";
import type { SyncContext } from "./SyncContext";

export class LightSynchronizer implements String3DObjectSyncStrategy {
  sync(el: HTMLElement, object: String3DObject, ctx: SyncContext, parentData: any): any {
    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const translateZ = parseFloat(getComputedStyle(el).getPropertyValue("--translate-z") || "0");
    const position = ctx.camera.screenToWorld(centerX, centerY, translateZ);
    object.position = position;

    return null;
  }
}
