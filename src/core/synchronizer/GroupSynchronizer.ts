import { String3DObject } from "../String3DObject";
import type { String3DObjectSyncStrategy } from "./String3DObjectSyncStrategy";
import type { SyncContext } from "./SyncContext";

export class GroupSynchronizer implements String3DObjectSyncStrategy {
  sync(el: HTMLElement, object: String3DObject, ctx: SyncContext, parentData: any): any {
    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const style = getComputedStyle(el);
    const translateZ = parseFloat(style.getPropertyValue("--translate-z") || "0");
    const position = ctx.camera.screenToWorld(centerX, centerY, translateZ);
    object.position = position;

    const scale = parseFloat(style.getPropertyValue("--scale")) || 1;
    object.scale = ctx.engine.createVector3(scale, scale, scale);

    const rotateX = -ctx.engine.degToRad(parseFloat(style.getPropertyValue("--rotate-x") || "0"));
    const rotateY = ctx.engine.degToRad(parseFloat(style.getPropertyValue("--rotate-y") || "0"));
    const rotateZ = -ctx.engine.degToRad(parseFloat(style.getPropertyValue("--rotate-z") || "0"));
    object.rotation = ctx.engine.createEuler(rotateX, rotateY, rotateZ, "XYZ");

    object.object.updateMatrixWorld(true);

    return { scale };
  }
}
