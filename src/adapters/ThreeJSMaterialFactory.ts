import type {
  String3DCustomMaterialDefinition,
  IMaterialInstance,
  IMaterialFactory,
} from "../core/materials";
import { collectUniformsFromCSS, mergeInjections } from "../core/materials";

export class ThreeJSMaterialFactory implements IMaterialFactory {
  private THREE: any;
  private textureLoader: any;
  private textureCache: Map<string, any> = new Map();

  constructor(THREE: any) {
    this.THREE = THREE;
    this.textureLoader = new THREE.TextureLoader();
  }

  supports(definition: String3DCustomMaterialDefinition): boolean {
    return true;
  }

  create(
    definition: String3DCustomMaterialDefinition,
    initialUniforms?: Record<string, any>
  ): IMaterialInstance {
    const uniforms = this.buildUniforms(definition, initialUniforms);

    let material: any;

    if (definition.extends === "shader" || (!definition.extends && definition.vertexShader)) {
      material = this.createShaderMaterial(definition, uniforms);
    } else {
      material = this.createExtendedMaterial(definition, uniforms);
    }

    this.applyMaterialProperties(material, definition);

    const update = (newUniforms: Record<string, any>) => {
      this.updateUniforms(material, definition, newUniforms);
    };

    const dispose = () => {
      material.dispose();
    };

    return { material, definition, update, dispose };
  }

  parseUniformsFromCSS(
    definition: String3DCustomMaterialDefinition,
    element: HTMLElement,
    style: CSSStyleDeclaration
  ): Record<string, any> {
    return collectUniformsFromCSS(definition, element, style);
  }

  private buildUniforms(
    definition: String3DCustomMaterialDefinition,
    initialValues?: Record<string, any>
  ): Record<string, { value: any }> {
    const result: Record<string, { value: any }> = {};

    if (definition.uniforms) {
      for (const [key, def] of Object.entries(definition.uniforms)) {
        let value = initialValues?.[key] ?? def.value;
        value = this.convertUniformValue(def.type, value);
        result[key] = { value };
      }
    }

    return result;
  }

  private convertUniformValue(type: string, value: any): any {
    switch (type) {
      case "vec2":
        if (Array.isArray(value)) {
          return new this.THREE.Vector2(value[0], value[1]);
        }
        return value;
      case "vec3":
        if (Array.isArray(value)) {
          return new this.THREE.Vector3(value[0], value[1], value[2]);
        }
        return value;
      case "vec4":
        if (Array.isArray(value)) {
          return new this.THREE.Vector4(value[0], value[1], value[2], value[3]);
        }
        return value;
      case "color":
        if (Array.isArray(value)) {
          return new this.THREE.Color(value[0], value[1], value[2]);
        }
        if (typeof value === "string") {
          return new this.THREE.Color(value);
        }
        return value;
      case "texture":
        if (typeof value === "string" && value) {
          return this.loadTexture(value);
        }
        return value;
      default:
        return value;
    }
  }

  private loadTexture(url: string): any {
    if (this.textureCache.has(url)) {
      return this.textureCache.get(url);
    }
    const texture = this.textureLoader.load(url);
    this.textureCache.set(url, texture);
    return texture;
  }

  private createShaderMaterial(
    definition: String3DCustomMaterialDefinition,
    uniforms: Record<string, { value: any }>
  ): any {
    const material = new this.THREE.ShaderMaterial({
      uniforms,
      vertexShader: definition.vertexShader || this.getDefaultVertexShader(),
      fragmentShader: definition.fragmentShader || this.getDefaultFragmentShader(),
      lights: definition.lights ?? false,
      transparent: definition.properties?.transparent ?? false,
    });
    material.userData.customUniforms = uniforms;
    material.userData.definition = definition;
    return material;
  }

  private createExtendedMaterial(
    definition: String3DCustomMaterialDefinition,
    uniforms: Record<string, { value: any }>
  ): any {
    const baseType = definition.extends || "standard";
    let BaseMaterial: any;

    switch (baseType) {
      case "basic":
        BaseMaterial = this.THREE.MeshBasicMaterial;
        break;
      case "physical":
        BaseMaterial = this.THREE.MeshPhysicalMaterial;
        break;
      case "standard":
      default:
        BaseMaterial = this.THREE.MeshStandardMaterial;
        break;
    }

    const material = new BaseMaterial({
      transparent: definition.properties?.transparent ?? false,
    });

    if (definition.injections && definition.injections.length > 0) {
      const injectionMap = mergeInjections(definition.injections);

      material.onBeforeCompile = (shader: any) => {
        Object.assign(shader.uniforms, uniforms);

        shader.vertexShader = this.injectVertexShader(shader.vertexShader, injectionMap, uniforms);
        shader.fragmentShader = this.injectFragmentShader(
          shader.fragmentShader,
          injectionMap,
          uniforms
        );

        material.userData.shader = shader;
      };
    }

    material.userData.customUniforms = uniforms;
    material.userData.definition = definition;

    return material;
  }

  private injectVertexShader(
    shader: string,
    injections: Map<string, string>,
    uniforms: Record<string, { value: any }>
  ): string {
    let result = shader;

    const pars = injections.get("vertex_pars");
    if (pars) {
      result = result.replace("#include <common>", `#include <common>\n${pars}`);
    }

    const header = injections.get("vertex_header");
    if (header) {
      const uniformDeclarations = this.generateUniformDeclarations(uniforms);
      result = result.replace("void main() {", `${uniformDeclarations}\n${header}\nvoid main() {`);
    }

    const transform = injections.get("vertex_transform");
    if (transform) {
      result = result.replace("#include <begin_vertex>", `#include <begin_vertex>\n${transform}`);
    }

    const output = injections.get("vertex_output");
    if (output) {
      result = result.replace("#include <project_vertex>", `${output}\n#include <project_vertex>`);
    }

    return result;
  }

  private injectFragmentShader(
    shader: string,
    injections: Map<string, string>,
    uniforms: Record<string, { value: any }>
  ): string {
    let result = shader;

    const pars = injections.get("fragment_pars");
    if (pars) {
      result = result.replace("#include <common>", `#include <common>\n${pars}`);
    }

    const header = injections.get("fragment_header");
    if (header) {
      const uniformDeclarations = this.generateUniformDeclarations(uniforms);
      result = result.replace("void main() {", `${uniformDeclarations}\n${header}\nvoid main() {`);
    }

    const color = injections.get("fragment_color");
    if (color) {
      result = result.replace("#include <color_fragment>", `#include <color_fragment>\n${color}`);
    }

    const normal = injections.get("fragment_normal");
    if (normal) {
      result = result.replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>\n${normal}`
      );
    }

    const emissive = injections.get("fragment_emissive");
    if (emissive) {
      result = result.replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>\n${emissive}`
      );
    }

    const output = injections.get("fragment_output");
    if (output) {
      result = result.replace(
        "#include <dithering_fragment>",
        `${output}\n#include <dithering_fragment>`
      );
    }

    return result;
  }

  private generateUniformDeclarations(uniforms: Record<string, { value: any }>): string {
    const lines: string[] = [];

    for (const [name, uniform] of Object.entries(uniforms)) {
      const type = this.inferGLSLType(uniform.value);
      lines.push(`uniform ${type} ${name};`);
    }

    return lines.join("\n");
  }

  private inferGLSLType(value: any): string {
    if (typeof value === "number") return "float";
    if (typeof value === "boolean") return "bool";
    if (value instanceof this.THREE.Vector2) return "vec2";
    if (value instanceof this.THREE.Vector3) return "vec3";
    if (value instanceof this.THREE.Vector4) return "vec4";
    if (value instanceof this.THREE.Color) return "vec3";
    if (value instanceof this.THREE.Matrix3) return "mat3";
    if (value instanceof this.THREE.Matrix4) return "mat4";
    if (value?.isTexture) return "sampler2D";
    return "float";
  }

  private applyMaterialProperties(
    material: any,
    definition: String3DCustomMaterialDefinition
  ): void {
    const props = definition.properties;
    if (!props) return;

    if (props.transparent !== undefined) {
      material.transparent = props.transparent;
    }

    if (props.side !== undefined) {
      switch (props.side) {
        case "front":
          material.side = this.THREE.FrontSide;
          break;
        case "back":
          material.side = this.THREE.BackSide;
          break;
        case "double":
          material.side = this.THREE.DoubleSide;
          break;
      }
    }

    if (props.depthWrite !== undefined) {
      material.depthWrite = props.depthWrite;
    }

    if (props.depthTest !== undefined) {
      material.depthTest = props.depthTest;
    }

    if (props.blending !== undefined) {
      switch (props.blending) {
        case "additive":
          material.blending = this.THREE.AdditiveBlending;
          break;
        case "subtractive":
          material.blending = this.THREE.SubtractiveBlending;
          break;
        case "multiply":
          material.blending = this.THREE.MultiplyBlending;
          break;
        default:
          material.blending = this.THREE.NormalBlending;
      }
    }

    if (props.wireframe !== undefined) {
      material.wireframe = props.wireframe;
    }
  }

  private updateUniforms(
    material: any,
    definition: String3DCustomMaterialDefinition,
    newValues: Record<string, any>
  ): void {
    const shader = material.userData?.shader;
    const customUniforms = material.userData?.customUniforms;

    if (shader?.uniforms) {
      for (const [key, value] of Object.entries(newValues)) {
        const uniformDef = definition.uniforms?.[key];
        if (uniformDef && shader.uniforms[key]) {
          shader.uniforms[key].value = this.convertUniformValue(uniformDef.type, value);
        }
      }
    } else if (customUniforms) {
      for (const [key, value] of Object.entries(newValues)) {
        const uniformDef = definition.uniforms?.[key];
        if (uniformDef && customUniforms[key]) {
          customUniforms[key].value = this.convertUniformValue(uniformDef.type, value);
        }
      }
    }

    if (material.uniforms) {
      for (const [key, value] of Object.entries(newValues)) {
        const uniformDef = definition.uniforms?.[key];
        if (uniformDef && material.uniforms[key]) {
          material.uniforms[key].value = this.convertUniformValue(uniformDef.type, value);
        }
      }
    }
  }

  private getDefaultVertexShader(): string {
    return `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPosition;

      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vPosition = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
  }

  private getDefaultFragmentShader(): string {
    return `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPosition;

      void main() {
        gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
      }
    `;
  }

  dispose(): void {
    this.textureCache.forEach((texture) => texture.dispose());
    this.textureCache.clear();
  }
}
