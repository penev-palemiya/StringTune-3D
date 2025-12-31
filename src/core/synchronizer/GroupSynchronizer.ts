import { String3DObject } from "../String3DObject";
import type { String3DObjectSyncStrategy } from "./String3DObjectSyncStrategy";
import type { SyncContext } from "./SyncContext";

type StyleMap = {
  get?: (prop: string) => any;
};

export class GroupSynchronizer implements String3DObjectSyncStrategy {
  sync(el: HTMLElement, object: String3DObject, ctx: SyncContext, parentData: any): any {
    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const styleMap = (el as any).computedStyleMap?.() as StyleMap | undefined;
    let style: CSSStyleDeclaration | null = null;
    const getStyle = () => {
      if (!style) style = getComputedStyle(el);
      return style;
    };

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
    const position = ctx.camera.screenToWorld(centerX, centerY, translateZ);
    object.position = position;

    const scale = readNumberStyle("--scale", 1);
    object.scale = ctx.engine.createVector3(scale, scale, scale);

    const rotateX = -ctx.engine.degToRad(readNumberStyle("--rotate-x", 0));
    const rotateY = ctx.engine.degToRad(readNumberStyle("--rotate-y", 0));
    const rotateZ = -ctx.engine.degToRad(readNumberStyle("--rotate-z", 0));
    object.rotation = ctx.engine.createEuler(rotateX, rotateY, rotateZ, "XYZ");

    object.object.updateMatrixWorld(true);

    return { scale };
  }
}
