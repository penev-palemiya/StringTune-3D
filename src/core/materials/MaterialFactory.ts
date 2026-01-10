import type {
  String3DCustomMaterialDefinition,
  UniformDefinition,
  ShaderInjection,
} from "./String3DCustomMaterial";

export type MaterialUpdateCallback = (uniforms: Record<string, any>) => void;

export interface IMaterialInstance {
  material: any;
  definition: String3DCustomMaterialDefinition;
  update: MaterialUpdateCallback;
  dispose: () => void;
}

export interface IMaterialFactory {
  supports(definition: String3DCustomMaterialDefinition): boolean;

  create(
    definition: String3DCustomMaterialDefinition,
    initialUniforms?: Record<string, any>
  ): IMaterialInstance;

  parseUniformsFromCSS(
    definition: String3DCustomMaterialDefinition,
    element: HTMLElement,
    style: CSSStyleDeclaration
  ): Record<string, any>;
}

export function parseUniformValue(
  def: UniformDefinition,
  cssValue: string | null | undefined
): any {
  if (cssValue === null || cssValue === undefined || cssValue === "" || cssValue === "none") {
    return def.value;
  }

  const trimmed = cssValue.trim();

  switch (def.type) {
    case "float":
    case "int": {
      const num = parseFloat(trimmed);
      return isNaN(num) ? def.value : num;
    }
    case "vec2": {
      const parts = trimmed.split(/[\s,]+/).map((s) => parseFloat(s.trim()));
      if (parts.length >= 2 && parts.every((n) => !isNaN(n))) {
        return [parts[0], parts[1]];
      }
      return def.value;
    }
    case "vec3": {
      const parts = trimmed.split(/[\s,]+/).map((s) => parseFloat(s.trim()));
      if (parts.length >= 3 && parts.every((n) => !isNaN(n))) {
        return [parts[0], parts[1], parts[2]];
      }
      return def.value;
    }
    case "vec4": {
      const parts = trimmed.split(/[\s,]+/).map((s) => parseFloat(s.trim()));
      if (parts.length >= 4 && parts.every((n) => !isNaN(n))) {
        return [parts[0], parts[1], parts[2], parts[3]];
      }
      return def.value;
    }
    case "color": {
      return parseColorValue(trimmed) ?? def.value;
    }
    case "texture": {
      const match = trimmed.match(/url\(['"]?(.*?)['"]?\)/);
      return match ? match[1] : trimmed || def.value;
    }
    default:
      return def.value;
  }
}

function parseColorValue(value: string): [number, number, number] | null {
  if (value.startsWith("#")) {
    const hex = value.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16) / 255;
      const g = parseInt(hex[1] + hex[1], 16) / 255;
      const b = parseInt(hex[2] + hex[2], 16) / 255;
      return [r, g, b];
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16) / 255;
      const g = parseInt(hex.slice(2, 4), 16) / 255;
      const b = parseInt(hex.slice(4, 6), 16) / 255;
      return [r, g, b];
    }
  }

  const rgbMatch = value.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) {
    return [parseInt(rgbMatch[1]) / 255, parseInt(rgbMatch[2]) / 255, parseInt(rgbMatch[3]) / 255];
  }

  return null;
}

export function collectUniformsFromCSS(
  definition: String3DCustomMaterialDefinition,
  element: HTMLElement,
  style: CSSStyleDeclaration
): Record<string, any> {
  const result: Record<string, any> = {};

  if (definition.parse) {
    const parsed = definition.parse(element, style);
    Object.assign(result, parsed);
  }

  if (definition.uniforms) {
    for (const [key, def] of Object.entries(definition.uniforms)) {
      if (def.css) {
        const cssValue = style.getPropertyValue(def.css).trim();
        result[key] = parseUniformValue(def, cssValue);
      } else if (!(key in result)) {
        result[key] = def.value;
      }
    }
  }

  return result;
}

export function mergeInjections(injections: ShaderInjection[]): Map<string, string> {
  const grouped = new Map<string, ShaderInjection[]>();

  for (const injection of injections) {
    const list = grouped.get(injection.point) || [];
    list.push(injection);
    grouped.set(injection.point, list);
  }

  const result = new Map<string, string>();

  for (const [point, list] of grouped) {
    const sorted = list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    result.set(point, sorted.map((i) => i.code).join("\n"));
  }

  return result;
}
