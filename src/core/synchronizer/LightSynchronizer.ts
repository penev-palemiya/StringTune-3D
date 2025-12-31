import { String3DObject } from "../String3DObject";
import type { String3DObjectSyncStrategy } from "./String3DObjectSyncStrategy";
import type { SyncContext } from "./SyncContext";
import { I3DLight } from "../abstractions/I3DEngine";

export class LightSynchronizer implements String3DObjectSyncStrategy {
  sync(el: HTMLElement, object: String3DObject, ctx: SyncContext, parentData: any): any {
    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const translateZ = parseFloat(getComputedStyle(el).getPropertyValue("--translate-z") || "0");
    const position = ctx.camera.screenToWorld(centerX, centerY, translateZ);
    object.position = position;

    const light = object.object as I3DLight;

    // Color
    const color = el.getAttribute("string-3d-color");
    if (color && light.color && typeof light.color.set === "function") {
      light.color.set(color);
    }

    // Intensity
    const intensity = el.getAttribute("string-3d-intensity");
    if (intensity) {
      light.intensity = parseFloat(intensity);
    }

    // Distance & Decay
    const distance = el.getAttribute("string-3d-distance");
    if (distance && typeof light.distance !== "undefined") {
      light.distance = parseFloat(distance);
    }
    const decay = el.getAttribute("string-3d-decay");
    if (decay && typeof light.decay !== "undefined") {
      light.decay = parseFloat(decay);
    }

    // SpotLight specific
    const angle = el.getAttribute("string-3d-angle");
    if (angle && typeof light.angle !== "undefined") {
      light.angle = parseFloat(angle);
    }
    const penumbra = el.getAttribute("string-3d-penumbra");
    if (penumbra && typeof light.penumbra !== "undefined") {
      light.penumbra = parseFloat(penumbra);
    }

    // Hemisphere specific
    const groundColor = el.getAttribute("string-3d-ground-color");
    if (
      groundColor &&
      (light as any).groundColor &&
      typeof (light as any).groundColor.set === "function"
    ) {
      (light as any).groundColor.set(groundColor);
    }

    // Shadows
    const castShadow = el.getAttribute("string-3d-cast-shadow") === "true";
    if (light.castShadow !== castShadow) {
      light.castShadow = castShadow;
    }
    if (castShadow && light.shadow) {
      const bias = el.getAttribute("string-3d-shadow-bias");
      if (bias) light.shadow.bias = parseFloat(bias);

      const mapSize = el.getAttribute("string-3d-shadow-map-size");
      if (mapSize) {
        const size = parseFloat(mapSize);
        if (light.shadow.mapSize.width !== size) {
          light.shadow.mapSize.width = size;
          light.shadow.mapSize.height = size;
        }
      }
    }

    // Target (Directional, Spot)
    const targetId = el.getAttribute("string-3d-target");
    if (targetId && light.target) {
      const targetEl = document.querySelector(`[string-id="${targetId}"]`);
      if (targetEl) {
        const tRect = targetEl.getBoundingClientRect();
        const tCenterX = tRect.left + tRect.width / 2;
        const tCenterY = tRect.top + tRect.height / 2;
        const tTranslateZ = parseFloat(
          getComputedStyle(targetEl).getPropertyValue("--translate-z") || "0"
        );
        const tPos = ctx.camera.screenToWorld(tCenterX, tCenterY, tTranslateZ);

        light.target.position.copy(tPos);
        light.target.updateMatrixWorld(true);
      }
    }

    return null;
  }
}
