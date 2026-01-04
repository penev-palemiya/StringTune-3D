import {
  I3DEngine,
  I3DRenderer,
  I3DRenderTarget,
  I3DScene,
  I3DCamera,
  I3DMaterial,
  I3DObject,
} from "../abstractions/I3DEngine";
import type { String3DFilterChain } from "./String3DFilterTypes";
import { String3DCustomFilterRegistry } from "./String3DCustomFilter";

type RenderTargetFactory = (width: number, height: number) => I3DRenderTarget;

class RenderTargetPool {
  private pool: I3DRenderTarget[] = [];
  private create: RenderTargetFactory;

  constructor(create: RenderTargetFactory) {
    this.create = create;
  }

  acquire(width: number, height: number): I3DRenderTarget {
    const target = this.pool.pop() || this.create(width, height);
    if (target.width !== width || target.height !== height) {
      target.setSize(width, height);
    }
    return target;
  }

  release(target: I3DRenderTarget): void {
    this.pool.push(target);
  }

  dispose(): void {
    this.pool.forEach((target) => target.dispose());
    this.pool = [];
  }
}

export class String3DFilterPipeline {
  private engine: I3DEngine;
  private renderer: I3DRenderer;
  private width: number;
  private height: number;
  private scale = 1;
  private scene: I3DScene;
  private camera: I3DCamera;
  private quad: I3DObject;
  private copyMaterial: I3DMaterial;
  private blurMaterial: I3DMaterial;
  private pixelMaterial: I3DMaterial;
  private bloomExtractMaterial: I3DMaterial;
  private bloomAddMaterial: I3DMaterial;
  private colorMaterial: I3DMaterial;
  private customMaterials: Map<string, I3DMaterial> = new Map();
  private pool: RenderTargetPool;

  constructor(engine: I3DEngine, renderer: I3DRenderer, width: number, height: number) {
    this.engine = engine;
    this.renderer = renderer;
    this.width = width;
    this.height = height;

    this.scene = engine.createScene();
    this.camera = engine.createOrthographicCamera(-1, 1, 1, -1, 0, 1);

    const geometry = engine.createPlaneGeometry(2, 2);
    this.copyMaterial = this.createCopyMaterial();
    this.blurMaterial = this.createBlurMaterial();
    this.pixelMaterial = this.createPixelMaterial();
    this.bloomExtractMaterial = this.createBloomExtractMaterial();
    this.bloomAddMaterial = this.createBloomAddMaterial();
    this.colorMaterial = this.createColorMaterial();

    this.quad = engine.createMesh(geometry, this.copyMaterial);
    this.scene.add(this.quad);

    const create = (w: number, h: number) => {
      if (!this.engine.createRenderTarget) {
        throw new Error("[String3DFilterPipeline] Render target support missing.");
      }
      return this.engine.createRenderTarget(w, h);
    };
    this.pool = new RenderTargetPool(create);
  }

  public isSupported(): boolean {
    return (
      !!this.engine.createRenderTarget &&
      !!this.engine.createShaderMaterial &&
      !!this.renderer.setRenderTarget
    );
  }

  public resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  public setScale(scale: number): void {
    const next = Math.max(0.75, Math.min(1, scale));
    this.scale = next;
  }

  public applyFilters(
    input: I3DRenderTarget,
    effects: String3DFilterChain,
    quality = 1
  ): I3DRenderTarget {
    let current = input;
    const locals: I3DRenderTarget[] = [];

    const releaseLocal = (target: I3DRenderTarget): void => {
      const idx = locals.indexOf(target);
      if (idx >= 0) {
        locals.splice(idx, 1);
        this.pool.release(target);
      }
    };

    const acquire = (): I3DRenderTarget => {
      const { width, height } = this.getScaledSize();
      const target = this.pool.acquire(width, height);
      locals.push(target);
      return target;
    };

    effects.forEach((effect) => {
      if (effect.type === "blur") {
        const radius = effect.amount * quality;
        if (radius <= 0.0001) return;
        const first = acquire();
        this.renderPass(this.blurMaterial, current, first, {
          uDirection: [1, 0],
          uRadius: radius,
        });
        const second = acquire();
        this.renderPass(this.blurMaterial, first, second, {
          uDirection: [0, 1],
          uRadius: radius,
        });
        releaseLocal(first);
        if (current !== input) {
          releaseLocal(current);
        }
        current = second;
      } else if (effect.type === "pixel") {
        if (effect.size <= 0.5) return;
        const output = acquire();
        this.renderPass(this.pixelMaterial, current, output, {
          uPixelSize: effect.size,
        });
        if (current !== input) {
          releaseLocal(current);
        }
        current = output;
      } else if (effect.type === "bloom") {
        const intensity = effect.intensity;
        if (intensity <= 0.0001) return;
        if (effect.threshold >= 0.99) return;
        const blurRadius = Math.max(1, 4 * quality);
        const extracted = acquire();
        this.renderPass(this.bloomExtractMaterial, current, extracted, {
          uThreshold: effect.threshold,
        });

        const blur1 = acquire();
        this.renderPass(this.blurMaterial, extracted, blur1, {
          uDirection: [1, 0],
          uRadius: blurRadius,
        });
        const blur2 = acquire();
        this.renderPass(this.blurMaterial, blur1, blur2, {
          uDirection: [0, 1],
          uRadius: blurRadius,
        });

        releaseLocal(extracted);
        releaseLocal(blur1);

        const combined = acquire();
        this.renderAddPass(current, blur2, combined, intensity);
        releaseLocal(blur2);

        if (current !== input) {
          releaseLocal(current);
        }
        current = combined;
      } else if (
        effect.type === "brightness" ||
        effect.type === "contrast" ||
        effect.type === "saturate" ||
        effect.type === "grayscale" ||
        effect.type === "sepia" ||
        effect.type === "invert" ||
        effect.type === "hue-rotate"
      ) {
        const output = acquire();
        const mode = this.getColorMode(effect.type);
        const amount = effect.type === "hue-rotate" ? effect.angle : effect.amount;
        this.renderPass(this.colorMaterial, current, output, {
          uMode: mode,
          uAmount: amount,
        });
        if (current !== input) {
          releaseLocal(current);
        }
        current = output;
      } else if (effect.type === "custom") {
        const output = acquire();
        const material = this.getCustomMaterial(effect.name);
        if (material) {
          this.renderPass(material, current, output, effect.uniforms);
          if (current !== input) {
            releaseLocal(current);
          }
          current = output;
        } else {
          releaseLocal(output);
        }
      }
    });

    locals.forEach((target) => {
      if (target !== current) {
        this.pool.release(target);
      }
    });

    return current;
  }

  public acquireTarget(): I3DRenderTarget {
    const { width, height } = this.getScaledSize();
    return this.pool.acquire(width, height);
  }

  public releaseTarget(target: I3DRenderTarget): void {
    this.pool.release(target);
  }

  public renderToScreen(input: I3DRenderTarget): void {
    this.renderPass(this.copyMaterial, input, null, {}, false);
  }

  public dispose(): void {
    this.pool.dispose();
    this.customMaterials.forEach((material) => material.dispose());
    this.customMaterials.clear();
  }

  private renderPass(
    material: I3DMaterial,
    input: I3DRenderTarget,
    output: I3DRenderTarget | null,
    uniforms: Record<string, any> = {},
    clear = true
  ): void {
    const renderer = this.renderer as any;
    if (renderer.setRenderTarget) {
      renderer.setRenderTarget(output);
    }

    this.setMaterial(this.quad, material);
    this.setUniform(material, "tDiffuse", input.texture);
    const { width, height } = this.getScaledSize();
    this.setUniform(material, "uResolution", [width, height]);
    this.setUniform(material, "uTexel", [1 / width, 1 / height]);
    Object.entries(uniforms).forEach(([key, value]) => this.setUniform(material, key, value));

    if (clear && renderer.clear) {
      renderer.clear(true, true, true);
    }
    this.renderer.render(this.scene, this.camera);
  }

  private renderAddPass(
    base: I3DRenderTarget,
    bloom: I3DRenderTarget,
    output: I3DRenderTarget,
    intensity: number
  ): void {
    const renderer = this.renderer as any;
    if (renderer.setRenderTarget) {
      renderer.setRenderTarget(output);
    }

    this.setMaterial(this.quad, this.bloomAddMaterial);
    this.setUniform(this.bloomAddMaterial, "tBase", base.texture);
    this.setUniform(this.bloomAddMaterial, "tBloom", bloom.texture);
    this.setUniform(this.bloomAddMaterial, "uIntensity", intensity);
    const { width, height } = this.getScaledSize();
    this.setUniform(this.bloomAddMaterial, "uResolution", [width, height]);

    if (renderer.clear) {
      renderer.clear(true, true, true);
    }
    this.renderer.render(this.scene, this.camera);
  }

  private setMaterial(object: I3DObject, material: I3DMaterial): void {
    const anyObj = object as any;
    if (anyObj.material !== material) {
      anyObj.material = material as any;
    }
  }

  private setUniform(material: I3DMaterial, name: string, value: any): void {
    const uniforms = (material as any).uniforms;
    if (!uniforms) return;
    if (!uniforms[name]) {
      uniforms[name] = { value };
    } else {
      uniforms[name].value = value;
    }
  }

  private createCopyMaterial(): I3DMaterial {
    return this.createShaderMaterial({
      uniforms: { tDiffuse: { value: null } },
      vertexShader: this.getVertexShader(),
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D tDiffuse;
        void main() {
          gl_FragColor = texture2D(tDiffuse, vUv);
        }
      `,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
  }

  private createPixelMaterial(): I3DMaterial {
    return this.createShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        uResolution: { value: [this.width, this.height] },
        uPixelSize: { value: 1 },
      },
      vertexShader: this.getVertexShader(),
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D tDiffuse;
        uniform vec2 uResolution;
        uniform float uPixelSize;
        void main() {
          vec2 pixel = uPixelSize / uResolution;
          vec2 coord = floor(vUv / pixel) * pixel + pixel * 0.5;
          gl_FragColor = texture2D(tDiffuse, coord);
        }
      `,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
  }

  private createBlurMaterial(): I3DMaterial {
    return this.createShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        uTexel: { value: [1 / this.width, 1 / this.height] },
        uDirection: { value: [1, 0] },
        uRadius: { value: 2 },
      },
      vertexShader: this.getVertexShader(),
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D tDiffuse;
        uniform vec2 uTexel;
        uniform vec2 uDirection;
        uniform float uRadius;
        void main() {
          vec2 off1 = uDirection * uTexel * uRadius;
          vec2 off2 = uDirection * uTexel * uRadius * 2.0;
          vec2 off3 = uDirection * uTexel * uRadius * 3.0;
          vec2 off4 = uDirection * uTexel * uRadius * 4.0;
          vec4 color = texture2D(tDiffuse, vUv) * 0.227027;
          color += texture2D(tDiffuse, vUv + off1) * 0.1945946;
          color += texture2D(tDiffuse, vUv - off1) * 0.1945946;
          color += texture2D(tDiffuse, vUv + off2) * 0.1216216;
          color += texture2D(tDiffuse, vUv - off2) * 0.1216216;
          color += texture2D(tDiffuse, vUv + off3) * 0.054054;
          color += texture2D(tDiffuse, vUv - off3) * 0.054054;
          color += texture2D(tDiffuse, vUv + off4) * 0.016216;
          color += texture2D(tDiffuse, vUv - off4) * 0.016216;
          gl_FragColor = color;
        }
      `,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
  }

  private createBloomExtractMaterial(): I3DMaterial {
    return this.createShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        uThreshold: { value: 0.8 },
      },
      vertexShader: this.getVertexShader(),
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D tDiffuse;
        uniform float uThreshold;
        void main() {
          vec4 color = texture2D(tDiffuse, vUv);
          float brightness = max(max(color.r, color.g), color.b);
          gl_FragColor = brightness > uThreshold ? color : vec4(0.0);
        }
      `,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
  }

  private createBloomAddMaterial(): I3DMaterial {
    return this.createShaderMaterial({
      uniforms: {
        tBase: { value: null },
        tBloom: { value: null },
        uIntensity: { value: 1 },
        uResolution: { value: [this.width, this.height] },
      },
      vertexShader: this.getVertexShader(),
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D tBase;
        uniform sampler2D tBloom;
        uniform float uIntensity;
        void main() {
          vec4 base = texture2D(tBase, vUv);
          vec4 bloom = texture2D(tBloom, vUv);
          gl_FragColor = vec4(base.rgb + bloom.rgb * uIntensity, base.a);
        }
      `,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
  }

  private createColorMaterial(): I3DMaterial {
    return this.createShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        uMode: { value: 0 },
        uAmount: { value: 1 },
      },
      vertexShader: this.getVertexShader(),
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D tDiffuse;
        uniform int uMode;
        uniform float uAmount;

        vec3 applyHueRotate(vec3 color, float angle) {
          float cosA = cos(angle);
          float sinA = sin(angle);
          mat3 m = mat3(
            0.213 + cosA * 0.787 - sinA * 0.213,
            0.715 - cosA * 0.715 - sinA * 0.715,
            0.072 - cosA * 0.072 + sinA * 0.928,
            0.213 - cosA * 0.213 + sinA * 0.143,
            0.715 + cosA * 0.285 + sinA * 0.140,
            0.072 - cosA * 0.072 - sinA * 0.283,
            0.213 - cosA * 0.213 - sinA * 0.787,
            0.715 - cosA * 0.715 + sinA * 0.715,
            0.072 + cosA * 0.928 + sinA * 0.072
          );
          return clamp(m * color, 0.0, 1.0);
        }

        void main() {
          vec4 color = texture2D(tDiffuse, vUv);
          float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));

          if (uMode == 1) {
            color.rgb *= uAmount;
          } else if (uMode == 2) {
            color.rgb = (color.rgb - 0.5) * uAmount + 0.5;
          } else if (uMode == 3) {
            color.rgb = mix(vec3(luma), color.rgb, uAmount);
          } else if (uMode == 4) {
            color.rgb = mix(color.rgb, vec3(luma), uAmount);
          } else if (uMode == 5) {
            vec3 sepia = vec3(
              dot(color.rgb, vec3(0.393, 0.769, 0.189)),
              dot(color.rgb, vec3(0.349, 0.686, 0.168)),
              dot(color.rgb, vec3(0.272, 0.534, 0.131))
            );
            color.rgb = mix(color.rgb, sepia, uAmount);
          } else if (uMode == 6) {
            color.rgb = mix(color.rgb, vec3(1.0) - color.rgb, uAmount);
          } else if (uMode == 7) {
            color.rgb = applyHueRotate(color.rgb, uAmount);
          }

          gl_FragColor = color;
        }
      `,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
  }

  private getColorMode(type: string): number {
    switch (type) {
      case "brightness":
        return 1;
      case "contrast":
        return 2;
      case "saturate":
        return 3;
      case "grayscale":
        return 4;
      case "sepia":
        return 5;
      case "invert":
        return 6;
      case "hue-rotate":
        return 7;
      default:
        return 0;
    }
  }

  private createShaderMaterial(params: any): I3DMaterial {
    if (!this.engine.createShaderMaterial) {
      throw new Error("[String3DFilterPipeline] Shader material support missing.");
    }
    return this.engine.createShaderMaterial(params);
  }

  private getCustomMaterial(name: string): I3DMaterial | null {
    const normalized = name.trim().toLowerCase();
    if (!normalized) return null;
    if (this.customMaterials.has(normalized)) {
      return this.customMaterials.get(normalized)!;
    }
    const def = String3DCustomFilterRegistry.get(normalized);
    if (!def) return null;

    const uniforms: Record<string, any> = { tDiffuse: { value: null } };
    const { width, height } = this.getScaledSize();
    uniforms.uResolution = { value: [width, height] };
    uniforms.uTexel = { value: [1 / width, 1 / height] };
    Object.entries(def.uniforms || {}).forEach(([key, value]) => {
      uniforms[key] = { value };
    });

    const material = this.createShaderMaterial({
      uniforms,
      vertexShader: this.getVertexShader(),
      fragmentShader: def.fragmentShader,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });

    this.customMaterials.set(normalized, material);
    return material;
  }

  private getScaledSize(): { width: number; height: number } {
    const width = Math.max(1, Math.round(this.width * this.scale));
    const height = Math.max(1, Math.round(this.height * this.scale));
    return { width, height };
  }

  private getVertexShader(): string {
    return `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
  }
}
