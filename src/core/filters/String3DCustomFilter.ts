import type { I3DBackend } from "../abstractions/I3DEngine";

export type String3DCustomFilterImplementation = {
  kind: "shader";
  language: "glsl" | "wgsl" | "custom";
  stage?: "fragment" | "pipeline";
  code: string;
  vertexCode?: string;
  entryPoint?: string;
  metadata?: Record<string, any>;
};

export type String3DCustomFilterDefinition = {
  name: string;
  implementations?: Partial<Record<I3DBackend, String3DCustomFilterImplementation>>;
  /**
   * @deprecated Use `implementations.webgl` instead.
   */
  fragmentShader?: string;
  uniforms?: Record<string, any>;
  parse?: (args: string) => Record<string, any> | null;
};

export class String3DCustomFilterRegistry {
  private static filters: Map<string, String3DCustomFilterDefinition> = new Map();

  static register(definition: String3DCustomFilterDefinition): void {
    const name = definition.name.trim().toLowerCase();
    if (!name) {
      throw new Error("[String3D] Custom filter name is required.");
    }
    this.filters.set(name, { ...definition, name });
  }

  static get(name: string): String3DCustomFilterDefinition | undefined {
    return this.filters.get(name.trim().toLowerCase());
  }

  static has(name: string): boolean {
    return this.filters.has(name.trim().toLowerCase());
  }

  static list(): String3DCustomFilterDefinition[] {
    return Array.from(this.filters.values());
  }

  static getImplementation(
    name: string,
    backend: I3DBackend,
  ): String3DCustomFilterImplementation | undefined {
    const def = this.get(name);
    if (!def) return undefined;
    const impl = def.implementations?.[backend] || def.implementations?.custom;
    if (impl) return impl;
    if (def.fragmentShader && backend === "webgl") {
      return {
        kind: "shader",
        language: "glsl",
        stage: "fragment",
        code: def.fragmentShader,
      };
    }
    return undefined;
  }
}
