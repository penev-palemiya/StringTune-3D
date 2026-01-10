import { String3DObject } from "../String3DObject";
import type { String3DObjectSyncStrategy } from "./String3DObjectSyncStrategy";
import type { SyncContext } from "./SyncContext";
import { StyleReader } from "../../modules/string3d/styleUtils";
import { StyleBundleCache } from "./StyleBundleCache";
import type { ParticleSystemConfig } from "../abstractions/I3DEngine";
import { String3DCustomMaterialRegistry } from "../materials";
import type { IMaterialInstance } from "../materials";

type ParticleStyleBundle = ParticleSystemConfig & {
  translateZ: number;
  scale: number;
  rotateX: number;
  rotateY: number;
  rotateZ: number;
  particlesFit: boolean;
  materialType: string;
};

const DEG_TO_RAD = Math.PI / 180;

const DEFAULT_CONFIG: ParticleSystemConfig = {
  mode: "emitter",
  count: 300,
  size: 2,
  color: "#ffffff",
  opacity: 1,
  spread: 120,
  seed: 1,
  emitRate: 30,
  emitBurst: 0,
  particleLife: 2.5,
  particleSpeed: 40,
  particleDirection: [0, 1, 0],
  particleGravity: [0, -30, 0],
  particleDrag: 0.1,
  particleSizeVariation: 0.6,
  particleColorVariation: 0.2,
  particleShape: "sphere",
  particleModelUrl: "",
  particleModelLoader: "",
  particleModelNode: "",
  instanceShape: "sphere",
  instanceModelUrl: "",
  instanceModelLoader: "",
  instanceModelNode: "",
  instanceScale: 1,
  instanceScaleVariation: 0.5,
  instanceRotationSpeed: 0.4,
  instanceJitter: 0.2,
  instanceFlow: 0.3,
  instanceDisperse: 0,
  instanceDisperseScatter: 0,
  instanceDisperseScatterX: 0,
  instanceDisperseScatterY: 0,
  instanceDisperseScatterZ: 0,
};

export class ParticlesSynchronizer implements String3DObjectSyncStrategy {
  private static styleCache = new StyleBundleCache<ParticleStyleBundle>();
  private static lastConfig: WeakMap<String3DObject, ParticleSystemConfig> = new WeakMap();
  private static lastTime: WeakMap<String3DObject, number> = new WeakMap();
  private static lastMaterialType: WeakMap<String3DObject, string> = new WeakMap();
  private static materialInstances: WeakMap<String3DObject, IMaterialInstance> = new WeakMap();

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

    const parentScale = parentData?.scale ?? 1;
    const scale = bundle.scale * parentScale;
    object.object.scale.set(scale, scale, scale);

    object.object.rotation.x = -bundle.rotateX * DEG_TO_RAD;
    object.object.rotation.y = bundle.rotateY * DEG_TO_RAD;
    object.object.rotation.z = -bundle.rotateZ * DEG_TO_RAD;
    object.object.rotation.order = "XYZ";

    const config = this.buildConfig(bundle, rect, ctx, parentData);
    const prev = ParticlesSynchronizer.lastConfig.get(object);
    if (!prev || !this.isSameConfig(prev, config)) {
      ParticlesSynchronizer.lastConfig.set(object, config);
      (object.object as any).setConfig?.(config);
    }

    this.updateMaterialOverrides(el, object, ctx, bundle);
    this.updateCustomUniforms(el, object, ctx);

    const now = performance.now();
    const last = ParticlesSynchronizer.lastTime.get(object) ?? now;
    const dt = Math.max(0, (now - last) / 1000);
    ParticlesSynchronizer.lastTime.set(object, now);
    (object.object as any).update?.(dt);

    return { scale: parentData?.scale ?? 1 };
  }

  private readStyleBundle(el: HTMLElement, ctx: SyncContext): ParticleStyleBundle {
    return ParticlesSynchronizer.styleCache.get(el, ctx, (el) => {
      const styles = new StyleReader(el);
      const modeRaw = styles.readString("--particles-mode", DEFAULT_CONFIG.mode).toLowerCase();
      const mode = modeRaw === "instanced" ? "instanced" : "emitter";
      return {
        ...DEFAULT_CONFIG,
        translateZ: styles.readNumber("--translate-z", 0),
        scale: styles.readNumber("--scale", 1),
        rotateX: styles.readNumber("--rotate-x", 0),
        rotateY: styles.readNumber("--rotate-y", 0),
        rotateZ: styles.readNumber("--rotate-z", 0),
        particlesFit: styles.readNumber("--particles-fit", 0) > 0.5,
        materialType: styles.readString("--material-type", "basic"),
        mode,
        count: styles.readNumber("--particles-count", DEFAULT_CONFIG.count),
        size: styles.readNumber("--particles-size", DEFAULT_CONFIG.size),
        color: styles.readString("--particles-color", DEFAULT_CONFIG.color),
        opacity: styles.readNumber("--particles-opacity", DEFAULT_CONFIG.opacity),
        spread: styles.readNumber("--particles-spread", DEFAULT_CONFIG.spread),
        seed: styles.readNumber("--particles-seed", DEFAULT_CONFIG.seed),
        emitRate: styles.readNumber("--emit-rate", DEFAULT_CONFIG.emitRate),
        emitBurst: styles.readNumber("--emit-burst", DEFAULT_CONFIG.emitBurst),
        particleLife: styles.readNumber("--particle-life", DEFAULT_CONFIG.particleLife),
        particleSpeed: styles.readNumber("--particle-speed", DEFAULT_CONFIG.particleSpeed),
        particleDirection: this.parseVec3(
          styles.readString("--particle-direction", "0 1 0"),
          DEFAULT_CONFIG.particleDirection
        ),
        particleGravity: this.parseVec3(
          styles.readString("--particle-gravity", "0 -30 0"),
          DEFAULT_CONFIG.particleGravity
        ),
        particleDrag: styles.readNumber("--particle-drag", DEFAULT_CONFIG.particleDrag),
        particleSizeVariation: styles.readNumber(
          "--particle-size-variation",
          DEFAULT_CONFIG.particleSizeVariation
        ),
        particleColorVariation: styles.readNumber(
          "--particle-color-variation",
          DEFAULT_CONFIG.particleColorVariation
        ),
        particleShape: this.parseShape(
          styles.readString("--particles-shape", DEFAULT_CONFIG.particleShape)
        ),
        particleModelUrl: styles.readString("--particles-model", DEFAULT_CONFIG.particleModelUrl),
        particleModelLoader: styles.readString(
          "--particles-model-loader",
          DEFAULT_CONFIG.particleModelLoader
        ),
        particleModelNode: styles.readString(
          "--particles-model-node",
          DEFAULT_CONFIG.particleModelNode
        ),
        instanceShape: this.parseDistribution(
          styles.readString("--instance-shape", DEFAULT_CONFIG.instanceShape)
        ),
        instanceModelUrl: styles.readString("--instance-model", DEFAULT_CONFIG.instanceModelUrl),
        instanceModelLoader: styles.readString(
          "--instance-model-loader",
          DEFAULT_CONFIG.instanceModelLoader
        ),
        instanceModelNode: styles.readString(
          "--instance-model-node",
          DEFAULT_CONFIG.instanceModelNode
        ),
        instanceScale: styles.readNumber("--instance-scale", DEFAULT_CONFIG.instanceScale),
        instanceScaleVariation: styles.readNumber(
          "--instance-scale-variation",
          DEFAULT_CONFIG.instanceScaleVariation
        ),
        instanceRotationSpeed: styles.readNumber(
          "--instance-rotation-speed",
          DEFAULT_CONFIG.instanceRotationSpeed
        ),
        instanceJitter: styles.readNumber("--instance-jitter", DEFAULT_CONFIG.instanceJitter),
        instanceFlow: styles.readNumber("--instance-flow", DEFAULT_CONFIG.instanceFlow),
        instanceDisperse: styles.readNumber("--instance-disperse", DEFAULT_CONFIG.instanceDisperse),
        instanceDisperseScatter: styles.readNumber(
          "--instance-scatter",
          DEFAULT_CONFIG.instanceDisperseScatter
        ),
        instanceDisperseScatterX: styles.readNumber(
          "--instance-scatter-x",
          DEFAULT_CONFIG.instanceDisperseScatterX
        ),
        instanceDisperseScatterY: styles.readNumber(
          "--instance-scatter-y",
          DEFAULT_CONFIG.instanceDisperseScatterY
        ),
        instanceDisperseScatterZ: styles.readNumber(
          "--instance-scatter-z",
          DEFAULT_CONFIG.instanceDisperseScatterZ
        ),
      };
    });
  }

  private parseVec3(value: string, fallback: [number, number, number]): [number, number, number] {
    const parts = value
      .split(/[\s,]+/)
      .map((part) => Number.parseFloat(part))
      .filter((num) => !Number.isNaN(num));
    if (parts.length >= 3) {
      return [parts[0], parts[1], parts[2]];
    }
    return fallback;
  }

  private parseShape(value: string): "box" | "sphere" | "model" {
    const normalized = value.trim().toLowerCase();
    if (normalized === "box") return "box";
    if (normalized === "model") return "model";
    return "sphere";
  }

  private parseDistribution(value: string): "box" | "sphere" | "model" {
    return this.parseShape(value);
  }

  private buildConfig(
    bundle: ParticleStyleBundle,
    rect: DOMRect,
    ctx: SyncContext,
    parentData: any
  ): ParticleSystemConfig {
    const parentScale = parentData?.scale ?? 1;
    const scale = parentScale;
    const fitBase = Math.min(rect.width, rect.height);
    const fitMultiplier =
      bundle.instanceShape === "box" || bundle.instanceShape === "model" ? 1 : 0.5;
    const spreadPixels = bundle.particlesFit ? fitBase * fitMultiplier : bundle.spread;
    const spread = this.toWorld(spreadPixels, bundle.translateZ, ctx);
    return {
      ...bundle,
      count: Math.max(0, Math.floor(bundle.count)),
      size: Math.max(0.1, bundle.size),
      opacity: Math.max(0, Math.min(1, bundle.opacity)),
      spread: Math.max(0, spread * scale),
      seed: Math.max(0, Math.floor(bundle.seed)),
      emitRate: Math.max(0, bundle.emitRate),
      emitBurst: Math.max(0, bundle.emitBurst),
      particleLife: Math.max(0.1, bundle.particleLife),
      particleSpeed: Math.max(0, bundle.particleSpeed),
      particleDrag: Math.max(0, Math.min(1, bundle.particleDrag)),
      particleSizeVariation: Math.max(0, bundle.particleSizeVariation),
      particleColorVariation: Math.max(0, bundle.particleColorVariation),
      instanceScale: Math.max(0.1, bundle.instanceScale),
      instanceScaleVariation: Math.max(0, bundle.instanceScaleVariation),
      instanceRotationSpeed: Math.max(0, bundle.instanceRotationSpeed),
      instanceJitter: Math.max(0, bundle.instanceJitter),
      instanceFlow: Math.max(0, bundle.instanceFlow),
      instanceDisperse: Math.max(0, bundle.instanceDisperse),
      instanceDisperseScatter: Math.max(0, bundle.instanceDisperseScatter),
      instanceDisperseScatterX: Math.max(0, bundle.instanceDisperseScatterX),
      instanceDisperseScatterY: Math.max(0, bundle.instanceDisperseScatterY),
      instanceDisperseScatterZ: Math.max(0, bundle.instanceDisperseScatterZ),
    };
  }

  private toWorld(value: number, z: number, ctx: SyncContext): number {
    if (ctx.camera.getMode() === "orthographic") {
      return value;
    }
    const frustum = ctx.camera.getFrustumSizeAt(z);
    const perPixel = frustum.width / Math.max(1, ctx.viewportWidth);
    return value * perPixel;
  }

  private isSameConfig(a: ParticleSystemConfig, b: ParticleSystemConfig): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  private updateMaterialOverrides(
    el: HTMLElement,
    object: String3DObject,
    ctx: SyncContext,
    bundle: ParticleStyleBundle
  ): void {
    const typeRaw = bundle.materialType || "basic";
    const type = typeRaw.split("[")[0].trim().toLowerCase();
    const definition = String3DCustomMaterialRegistry.get(type);
    const factory = ctx.engine.getMaterialFactory?.();

    if (!definition || !factory || !factory.supports(definition)) {
      const hasExisting =
        ParticlesSynchronizer.materialInstances.has(object) ||
        ParticlesSynchronizer.lastMaterialType.has(object);
      if (!hasExisting) return;

      const existing = ParticlesSynchronizer.materialInstances.get(object);
      if (existing) {
        existing.dispose();
        ParticlesSynchronizer.materialInstances.delete(object);
      }
      ParticlesSynchronizer.lastMaterialType.delete(object);
      (object.object as any).setMaterial?.(null, { points: true, meshes: true });
      return;
    }

    const lastType = ParticlesSynchronizer.lastMaterialType.get(object);
    if (lastType !== type) {
      const existing = ParticlesSynchronizer.materialInstances.get(object);
      if (existing) existing.dispose();

      const style = getComputedStyle(el);
      const initialUniforms = factory.parseUniformsFromCSS(definition, el, style);
      const instance = factory.create(definition, initialUniforms);
      ParticlesSynchronizer.materialInstances.set(object, instance);
      ParticlesSynchronizer.lastMaterialType.set(object, type);

      const material = instance.material;
      const isShader = !!material?.isShaderMaterial;
      const system: any = object.object as any;
      system.setMaterial?.(material, { meshes: true, points: false });
      system.setMaterial?.(isShader ? material : null, { meshes: false, points: true });
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
        if (child.isMesh || child.isPoints) {
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach(apply);
        }
      });
    }
  }
}
