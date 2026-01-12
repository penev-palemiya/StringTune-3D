export type UniformType =
  | "float"
  | "int"
  | "vec2"
  | "vec3"
  | "vec4"
  | "color"
  | "texture"
  | "mat3"
  | "mat4";

export type UniformDefinition = {
  type: UniformType;
  value: any;
  css?: string;
};

export type ShaderInjectionPoint =
  | "vertex_pars"
  | "vertex_header"
  | "vertex_transform"
  | "vertex_output"
  | "fragment_pars"
  | "fragment_header"
  | "fragment_color"
  | "fragment_normal"
  | "fragment_emissive"
  | "fragment_output";

export type ShaderInjection = {
  point: ShaderInjectionPoint;
  code: string;
  order?: number;
};

export type MaterialBlendMode = "normal" | "additive" | "subtractive" | "multiply";
export type MaterialSide = "front" | "back" | "double";

export type String3DCustomMaterialDefinition = {
  name: string;

  extends?: "basic" | "standard" | "physical" | "shader";

  vertexShader?: string;
  fragmentShader?: string;

  injections?: ShaderInjection[];

  uniforms?: Record<string, UniformDefinition>;

  properties?: {
    transparent?: boolean;
    side?: MaterialSide;
    depthWrite?: boolean;
    depthTest?: boolean;
    blending?: MaterialBlendMode;
    wireframe?: boolean;
  };

  lights?: boolean;

  parse?: (element: HTMLElement, style: CSSStyleDeclaration) => Record<string, any>;
};

export class String3DCustomMaterialRegistry {
  private static materials: Map<string, String3DCustomMaterialDefinition> = new Map();
  private static registeredCssVars: Set<string> = new Set();

  static register(definition: String3DCustomMaterialDefinition): void {
    const name = definition.name.trim().toLowerCase();
    if (!name) {
      throw new Error("[String3D] Custom material name is required.");
    }
    this.materials.set(name, { ...definition, name });
    this.registerCssVarsForMaterial(definition);
  }

  private static registerCssVarsForMaterial(definition: String3DCustomMaterialDefinition): void {
    const css = (globalThis as any).CSS;
    if (!css?.registerProperty) return;

    const uniforms = definition.uniforms || {};
    for (const def of Object.values(uniforms)) {
      const cssVar = def.css?.trim();
      if (!cssVar || !cssVar.startsWith("--")) continue;
      if (this.registeredCssVars.has(cssVar)) continue;

      const syntax = this.resolveCssSyntax(def.type);

      try {
        css.registerProperty({
          name: cssVar,
          syntax,
          inherits: false,
          initialValue: this.defaultCssInitialValue(def),
        });
        this.registeredCssVars.add(cssVar);
      } catch (err) {}
    }
  }

  private static resolveCssSyntax(type: UniformType): string {
    switch (type) {
      case "color":
        return "<color>";
      case "float":
      case "int":
        return "<number>";
      default:
        return "*";
    }
  }

  private static defaultCssInitialValue(def: UniformDefinition): string {
    if (def.type === "color") {
      if (typeof def.value === "string") return def.value;
      return "#000000";
    }
    if (def.type === "float" || def.type === "int") {
      return typeof def.value === "number" ? String(def.value) : "0";
    }
    return "initial";
  }

  static get(name: string): String3DCustomMaterialDefinition | undefined {
    return this.materials.get(name.trim().toLowerCase());
  }

  static has(name: string): boolean {
    return this.materials.has(name.trim().toLowerCase());
  }

  static list(): String3DCustomMaterialDefinition[] {
    return Array.from(this.materials.values());
  }

  static unregister(name: string): boolean {
    return this.materials.delete(name.trim().toLowerCase());
  }
}
