import { String3DObject } from "../String3DObject";
import type { String3DObjectSyncStrategy } from "./String3DObjectSyncStrategy";
import type { SyncContext } from "./SyncContext";
import { I3DLight } from "../abstractions/I3DEngine";
import { StyleReader } from "../../modules/string3d/styleUtils";
import { StyleBundleCache } from "./StyleBundleCache";

type LightStyleBundle = {
  translateZ: number;
  translateX: number;
  translateY: number;
  color?: string;
  intensity: number;
  distance?: number;
  decay?: number;
  angle?: number;
  penumbra?: number;
  groundColor?: string;
  castShadow: boolean;
  shadowBias?: number;
  shadowMapSize?: number;
  targetId?: string;
  targetOffset?: { x: number; y: number; z: number };
};

export class LightSynchronizer implements String3DObjectSyncStrategy {
  private static styleCache = new StyleBundleCache<LightStyleBundle>();

  sync(el: HTMLElement, object: String3DObject, ctx: SyncContext, parentData: any): any {
    const cached = (el as any).__layoutCache;
    const rect = cached ? cached.rect : el.getBoundingClientRect();
    const bundle = this.readStyleBundle(el, ctx, object);

    const screenAnchor = this.resolveScreenAnchor(rect, ctx);
    const translateX = screenAnchor.fallbackToViewportCenter ? bundle.translateX : 0;
    const translateY = screenAnchor.fallbackToViewportCenter ? bundle.translateY : 0;

    if (ctx.camera.getMode() === "orthographic") {
      this.setObjectPosition(
        ctx,
        object.object,
        screenAnchor.x - ctx.viewportWidth / 2 + translateX,
        -(screenAnchor.y - ctx.viewportHeight / 2) + translateY,
        bundle.translateZ,
      );
    } else {
      const frustum = ctx.camera.getFrustumSizeAt(bundle.translateZ);
      const normalizedX = screenAnchor.x / ctx.viewportWidth;
      const normalizedY = screenAnchor.y / ctx.viewportHeight;
      this.setObjectPosition(
        ctx,
        object.object,
        (normalizedX - 0.5) * frustum.width + translateX,
        -(normalizedY - 0.5) * frustum.height + translateY,
        bundle.translateZ,
      );
    }

    const light = object.object as I3DLight;

    if (
      bundle.color &&
      bundle.color !== "none" &&
      light.color &&
      typeof light.color.set === "function"
    ) {
      light.color.set(bundle.color);
    }

    light.intensity = bundle.intensity;

    if (typeof light.distance !== "undefined" && bundle.distance !== undefined) {
      light.distance = bundle.distance;
    }
    if (typeof light.decay !== "undefined" && bundle.decay !== undefined) {
      light.decay = bundle.decay;
    }

    if (typeof light.angle !== "undefined" && bundle.angle !== undefined) {
      light.angle = bundle.angle;
    }
    if (typeof light.penumbra !== "undefined" && bundle.penumbra !== undefined) {
      light.penumbra = bundle.penumbra;
    }

    if (
      bundle.groundColor &&
      bundle.groundColor !== "none" &&
      (light as any).groundColor &&
      typeof (light as any).groundColor.set === "function"
    ) {
      (light as any).groundColor.set(bundle.groundColor);
    }

    if (light.castShadow !== bundle.castShadow) {
      light.castShadow = bundle.castShadow;
    }
    if (bundle.castShadow && light.shadow) {
      if (bundle.shadowBias !== undefined) {
        light.shadow.bias = bundle.shadowBias;
      }
      if (
        bundle.shadowMapSize !== undefined &&
        light.shadow.mapSize.width !== bundle.shadowMapSize
      ) {
        light.shadow.mapSize.width = bundle.shadowMapSize;
        light.shadow.mapSize.height = bundle.shadowMapSize;
      }
    }

    if (bundle.targetId && bundle.targetId !== "none" && light.target) {
      const targetEl = document.querySelector(`[string-id="${bundle.targetId}"]`);
      if (targetEl) {
        const tCached = (targetEl as any).__layoutCache;
        const tRect = tCached ? tCached.rect : targetEl.getBoundingClientRect();
        const tStyles = new StyleReader(targetEl as HTMLElement);
        const tTranslateX = tStyles.readNumber("--translate-x", 0);
        const tTranslateY = tStyles.readNumber("--translate-y", 0);
        const tTranslateZ = tStyles.readNumber("--translate-z", 0);

        const tScreenAnchor = this.resolveScreenAnchor(tRect, ctx);
        const tOffsetX = tScreenAnchor.fallbackToViewportCenter ? tTranslateX : 0;
        const tOffsetY = tScreenAnchor.fallbackToViewportCenter ? tTranslateY : 0;

        let x: number;
        let y: number;
        let z: number;
        if (ctx.camera.getMode() === "orthographic") {
          x = tScreenAnchor.x - ctx.viewportWidth / 2 + tOffsetX;
          y = -(tScreenAnchor.y - ctx.viewportHeight / 2) + tOffsetY;
          z = tTranslateZ;
        } else {
          const frustum = ctx.camera.getFrustumSizeAt(tTranslateZ);
          const normalizedX = tScreenAnchor.x / ctx.viewportWidth;
          const normalizedY = tScreenAnchor.y / ctx.viewportHeight;
          x = (normalizedX - 0.5) * frustum.width + tOffsetX;
          y = -(normalizedY - 0.5) * frustum.height + tOffsetY;
          z = tTranslateZ;
        }

        if (bundle.targetOffset) {
          x += bundle.targetOffset.x;
          y += bundle.targetOffset.y;
          z += bundle.targetOffset.z;
        }

        this.setObjectPosition(ctx, light.target, x, y, z);

        light.target.updateMatrixWorld(true);
      }
    }

    return null;
  }

  private readStyleBundle(
    el: HTMLElement,
    ctx: SyncContext,
    object: String3DObject,
  ): LightStyleBundle {
    return LightSynchronizer.styleCache.get(el, ctx, (el) => {
      const styles = new StyleReader(el);
      const light = object.object as I3DLight;

      const bundle: LightStyleBundle = {
        translateZ: styles.readNumber("--translate-z", 0),
        translateX: styles.readNumber("--translate-x", 0),
        translateY: styles.readNumber("--translate-y", 0),
        color: styles.readString("--light-color", "") || undefined,
        intensity: styles.readNumber("--light-intensity", light.intensity ?? 1),
        castShadow: styles.readBoolean("--shadow-cast", false),
      };

      if (typeof light.distance !== "undefined") {
        bundle.distance = styles.readNumber("--light-distance", light.distance ?? 0);
      }
      if (typeof light.decay !== "undefined") {
        bundle.decay = styles.readNumber("--light-decay", light.decay ?? 1);
      }
      if (typeof light.angle !== "undefined") {
        bundle.angle = styles.readNumber("--light-angle", light.angle ?? Math.PI / 3);
      }
      if (typeof light.penumbra !== "undefined") {
        bundle.penumbra = styles.readNumber("--light-penumbra", light.penumbra ?? 0);
      }

      const groundColor = styles.readString("--light-ground-color", "");
      if (groundColor) bundle.groundColor = groundColor;

      if (bundle.castShadow && light.shadow) {
        bundle.shadowBias = styles.readNumber("--shadow-bias", light.shadow.bias ?? 0);
        bundle.shadowMapSize = styles.readNumber(
          "--shadow-map-size",
          light.shadow.mapSize.width ?? 512,
        );
      }

      const targetId = styles.readString("--light-target", "").trim();
      if (targetId) bundle.targetId = targetId;
      const offsetRaw = styles.readString("--light-target-offset", "").trim();
      if (offsetRaw) {
        const offset = this.parseTargetOffset(offsetRaw);
        if (offset) bundle.targetOffset = offset;
      }

      return bundle;
    });
  }

  private parseTargetOffset(value: string): { x: number; y: number; z: number } | null {
    const parts = value
      .split(/[\s,]+/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => Number.parseFloat(part));
    if (parts.length < 3 || parts.some((num) => Number.isNaN(num))) return null;
    return { x: parts[0], y: parts[1], z: parts[2] };
  }

  private resolveScreenAnchor(
    rect: DOMRect,
    ctx: SyncContext,
  ): { x: number; y: number; fallbackToViewportCenter: boolean } {
    const hasRenderableArea = rect.width > 1 && rect.height > 1;
    if (!hasRenderableArea) {
      return {
        x: ctx.viewportWidth * 0.5,
        y: ctx.viewportHeight * 0.5,
        fallbackToViewportCenter: true,
      };
    }

    return {
      x: rect.left + rect.width * 0.5,
      y: rect.top + rect.height * 0.5,
      fallbackToViewportCenter: false,
    };
  }

  private setObjectPosition(ctx: SyncContext, target: any, x: number, y: number, z: number): void {
    if (ctx.engine.setObjectPosition?.(target, x, y, z)) {
      return;
    }

    if (target?.position?.set && typeof target.position.set === "function") {
      target.position.set(x, y, z);
      return;
    }

    if (typeof target?.setPosition === "function") {
      target.setPosition(x, y, z);
      return;
    }

    if (target?.position) {
      target.position.x = x;
      target.position.y = y;
      target.position.z = z;
    }
  }
}
