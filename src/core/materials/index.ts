export { String3DCustomMaterialRegistry } from "./String3DCustomMaterial";
export type {
  String3DCustomMaterialDefinition,
  UniformType,
  UniformDefinition,
  ShaderInjection,
  ShaderInjectionPoint,
  MaterialBlendMode,
  MaterialSide,
} from "./String3DCustomMaterial";

export type { IMaterialInstance, IMaterialFactory } from "./MaterialFactory";
export { parseUniformValue, collectUniformsFromCSS, mergeInjections } from "./MaterialFactory";
