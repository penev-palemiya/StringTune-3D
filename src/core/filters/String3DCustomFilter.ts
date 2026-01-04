export type String3DCustomFilterDefinition = {
  name: string;
  fragmentShader: string;
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
}
