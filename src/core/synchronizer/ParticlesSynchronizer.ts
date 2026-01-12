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
  spreadX: 120,
  spreadY: 120,
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
  modelTransitionDuration: 0,
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
        modelTransitionDuration: this.getTransitionDuration(el, "--instance-model"),
      };
    });
  }

  private getTransitionDuration(el: HTMLElement, property: string): number {
    const style = getComputedStyle(el);
    const properties = this.splitTransitionList(style.transitionProperty);
    const durations = this.splitTransitionList(style.transitionDuration);

    const index = this.findTransitionIndex(properties, property);
    if (index === -1) {
      const shorthand = this.parseTransitionShorthand(style.transition);
      const match = shorthand.get(property) || shorthand.get("all");
      return match ? match.duration : 0;
    }

    return this.parseTime(durations[index] || durations[durations.length - 1] || "0s");
  }

  private splitTransitionList(value: string): string[] {
    const result: string[] = [];
    let current = "";
    let depth = 0;
    for (let i = 0; i < value.length; i += 1) {
      const ch = value[i];
      if (ch === "(") depth += 1;
      if (ch === ")") depth = Math.max(0, depth - 1);
      if (ch === "," && depth === 0) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    if (current.trim()) result.push(current.trim());
    return result.length > 0 ? result : ["all"];
  }

  private findTransitionIndex(properties: string[], name: string): number {
    const normalized = properties.map((prop) => prop.trim().toLowerCase());
    let index = normalized.indexOf(name);
    if (index === -1) {
      index = normalized.indexOf("all");
    }
    return index;
  }

  private parseTime(value: string): number {
    const raw = value.trim().toLowerCase();
    if (raw.endsWith("ms")) {
      const num = Number.parseFloat(raw.slice(0, -2));
      return Number.isFinite(num) ? num / 1000 : 0;
    }
    if (raw.endsWith("s")) {
      const num = Number.parseFloat(raw.slice(0, -1));
      return Number.isFinite(num) ? num : 0;
    }
    const num = Number.parseFloat(raw);
    return Number.isFinite(num) ? num : 0;
  }

  private parseTransitionShorthand(value: string): Map<string, { duration: number }> {
    const map = new Map<string, { duration: number }>();
    const parts = this.splitTransitionList(value);
    parts.forEach((part) => {
      if (!part) return;
      const tokens = part.trim().split(/\s+(?![^()]*\))/g);
      let prop = "";
      let duration = "";
      tokens.forEach((token) => {
        const lower = token.toLowerCase();
        if (lower.endsWith("ms") || lower.endsWith("s") || /^[0-9.]+$/.test(lower)) {
          if (!duration) duration = lower;
        } else if (
          lower.startsWith("cubic-bezier") ||
          lower.startsWith("steps") ||
          lower === "linear" ||
          lower === "ease" ||
          lower === "ease-in" ||
          lower === "ease-out" ||
          lower === "ease-in-out"
        ) {
        } else if (!prop) {
          prop = token;
        }
      });
      if (!prop) return;
      map.set(prop.trim().toLowerCase(), {
        duration: this.parseTime(duration || "0s"),
      });
    });
    return map;
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
    const fitMultiplier = 0.5;
    let spread: number;
    let spreadX: number;
    let spreadY: number;
    if (bundle.particlesFit) {
      spreadX = this.toWorld(rect.width * fitMultiplier, bundle.translateZ, ctx);
      spreadY = this.toWorld(rect.height * fitMultiplier, bundle.translateZ, ctx);
      spread = Math.max(spreadX, spreadY);
    } else {
      spread = this.toWorld(bundle.spread, bundle.translateZ, ctx);
      spreadX = spread;
      spreadY = spread;
    }
    return {
      ...bundle,
      count: Math.max(0, Math.floor(bundle.count)),
      size: Math.max(0.1, bundle.size),
      opacity: Math.max(0, Math.min(1, bundle.opacity)),
      spread: Math.max(0, spread * scale),
      spreadX: Math.max(0, spreadX * scale),
      spreadY: Math.max(0, spreadY * scale),
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
