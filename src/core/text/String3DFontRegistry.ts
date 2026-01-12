export type String3DFontEntry = {
  name: string;
  url: string;
};

export class String3DFontRegistry {
  private static fonts: Map<string, String3DFontEntry> = new Map();
  private static defaultFont: string | null = null;

  static register(name: string, url: string): void {
    const normalized = name.trim();
    if (!normalized) return;
    this.fonts.set(normalized, { name: normalized, url });
  }

  static setDefault(name: string): void {
    const normalized = name.trim();
    if (!normalized) return;
    this.defaultFont = normalized;
  }

  static get(name: string): String3DFontEntry | undefined {
    return this.fonts.get(name.trim());
  }

  static list(): String3DFontEntry[] {
    return Array.from(this.fonts.values());
  }

  static resolveFontFamily(fontFamily: string): String3DFontEntry | null {
    if (!fontFamily) {
      return this.getDefault();
    }

    const families = fontFamily
      .split(",")
      .map((value) => value.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);

    for (const family of families) {
      const entry = this.fonts.get(family);
      if (entry) return entry;
    }

    return this.getDefault();
  }

  private static getDefault(): String3DFontEntry | null {
    if (!this.defaultFont) return null;
    return this.fonts.get(this.defaultFont) || null;
  }
}
