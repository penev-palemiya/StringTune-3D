export interface FontData {
  glyphs: Record<string, GlyphData>;
  familyName: string;
  ascender: number;
  descender: number;
  underlinePosition: number;
  underlineThickness: number;
  boundingBox: { xMin: number; xMax: number; yMin: number; yMax: number };
  resolution: number;
  original_font_information: Record<string, any>;
}

export interface GlyphData {
  ha: number;
  x_min: number;
  x_max: number;
  o: string;
}

export type FontSource = string | ArrayBuffer | Uint8Array;

let opentypePromise: Promise<any> | null = null;
let opentypeModule: any = null;

let woff2Promise: Promise<any> | null = null;
let woff2Module: any = null;

async function loadOpentype(): Promise<any> {
  if (opentypeModule) {
    return opentypeModule;
  }

  if (!opentypePromise) {
    opentypePromise = (async () => {
      if (typeof window !== "undefined" && (window as any).opentype) {
        opentypeModule = (window as any).opentype;
        return opentypeModule;
      }

      return new Promise((resolve, reject) => {
        if (typeof document === "undefined") {
          reject(new Error("[FontConverter] Cannot load opentype.js in non-browser environment"));
          return;
        }
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/opentype.js@1.3.4/dist/opentype.min.js";
        script.onload = () => {
          opentypeModule = (window as any).opentype;
          resolve(opentypeModule);
        };
        script.onerror = () => reject(new Error("[FontConverter] Failed to load opentype.js"));
        document.head.appendChild(script);
      });
    })();
  }
  return opentypePromise;
}

async function loadWoff2Decoder(): Promise<any> {
  if (woff2Module) {
    return woff2Module;
  }

  if (!woff2Promise) {
    woff2Promise = (async () => {
      if (typeof window !== "undefined" && (window as any).Module?.decompress) {
        woff2Module = (window as any).Module;
        return woff2Module;
      }

      return new Promise((resolve, reject) => {
        if (typeof document === "undefined") {
          reject(new Error("[FontConverter] Cannot load woff2 decoder in non-browser environment"));
          return;
        }
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/wawoff2@2.0.1/build/decompress_binding.js";
        script.onload = () => {
          let attempts = 0;
          const maxAttempts = 500;
          const checkReady = () => {
            attempts++;
            const win = window as any;
            if (win.Module?.decompress) {
              woff2Module = win.Module;
              resolve(woff2Module);
            } else if (attempts >= maxAttempts) {
              reject(new Error("[FontConverter] woff2 decoder initialization timeout"));
            } else {
              setTimeout(checkReady, 10);
            }
          };
          checkReady();
        };
        script.onerror = () => {
          reject(new Error("[FontConverter] Failed to load woff2 decoder"));
        };
        document.head.appendChild(script);
      });
    })();
  }
  return woff2Promise;
}

async function decompressWoff2(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  const woff2 = await loadWoff2Decoder();
  const inputArray = new Uint8Array(buffer);
  const outputArray = woff2.decompress(inputArray);

  if (outputArray instanceof Uint8Array) {
    const newBuffer = new ArrayBuffer(outputArray.length);
    const newArray = new Uint8Array(newBuffer);
    newArray.set(outputArray);
    return newBuffer;
  }

  return outputArray.buffer;
}

function isWoff2(buffer: ArrayBuffer): boolean {
  const view = new DataView(buffer);
  return view.getUint32(0, false) === 0x774f4632;
}

function isWoff(buffer: ArrayBuffer): boolean {
  const view = new DataView(buffer);
  return view.getUint32(0, false) === 0x774f4646;
}

export class FontConverter {
  private static cache: Map<string, FontData> = new Map();
  private static loadingPromises: Map<string, Promise<FontData>> = new Map();

  static async load(source: FontSource): Promise<FontData> {
    const cacheKey = typeof source === "string" ? source : "buffer-" + Date.now();

    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const loading = this.loadingPromises.get(cacheKey);
    if (loading) return loading;

    const promise = this.doLoad(source, cacheKey);
    this.loadingPromises.set(cacheKey, promise);

    try {
      const result = await promise;
      this.cache.set(cacheKey, result);
      return result;
    } finally {
      this.loadingPromises.delete(cacheKey);
    }
  }

  private static async doLoad(source: FontSource, cacheKey: string): Promise<FontData> {
    const opentype = await loadOpentype();

    let buffer: ArrayBuffer;

    if (typeof source === "string") {
      const response = await fetch(source);
      buffer = await response.arrayBuffer();
    } else if (source instanceof ArrayBuffer) {
      buffer = source;
    } else if (source instanceof Uint8Array) {
      buffer = source.buffer as ArrayBuffer;
    } else {
      throw new Error("[FontConverter] Invalid font source");
    }

    if (isWoff2(buffer)) {
      buffer = await decompressWoff2(buffer);
    }

    const font = opentype.parse(buffer);

    if (!font) {
      throw new Error("[FontConverter] Failed to parse font");
    }

    return this.convertToTypeFace(font);
  }

  private static convertToTypeFace(font: any): FontData {
    const scale = 1000 / font.unitsPerEm;

    const glyphs: Record<string, GlyphData> = {};

    for (let i = 0; i < font.glyphs.length; i++) {
      const glyph = font.glyphs.get(i);
      if (!glyph.unicode) continue;

      const char = String.fromCharCode(glyph.unicode);
      const path = glyph.getPath(0, 0, font.unitsPerEm);
      const outline = this.pathToOutline(path, scale);

      const advanceWidth = glyph.advanceWidth ?? glyph.xMax ?? font.unitsPerEm * 0.5;

      glyphs[char] = {
        ha: Math.round(advanceWidth * scale),
        x_min: glyph.xMin !== undefined ? Math.round(glyph.xMin * scale) : 0,
        x_max: glyph.xMax !== undefined ? Math.round(glyph.xMax * scale) : 0,
        o: outline,
      };
    }

    if (!glyphs[" "]) {
      const spaceGlyph = font.charToGlyph(" ");
      glyphs[" "] = {
        ha: Math.round((spaceGlyph?.advanceWidth || font.unitsPerEm * 0.25) * scale),
        x_min: 0,
        x_max: 0,
        o: "",
      };
    }

    return {
      glyphs,
      familyName: font.names.fontFamily?.en || font.names.fullName?.en || "Unknown",
      ascender: Math.round(font.ascender * scale),
      descender: Math.round(font.descender * scale),
      underlinePosition: Math.round((font.tables.post?.underlinePosition || -100) * scale),
      underlineThickness: Math.round((font.tables.post?.underlineThickness || 50) * scale),
      boundingBox: {
        xMin: Math.round((font.tables.head?.xMin || 0) * scale),
        xMax: Math.round((font.tables.head?.xMax || 1000) * scale),
        yMin: Math.round((font.tables.head?.yMin || -200) * scale),
        yMax: Math.round((font.tables.head?.yMax || 800) * scale),
      },
      resolution: 1000,
      original_font_information: {
        format: 0,
        copyright: font.names.copyright?.en || "",
        fontFamily: font.names.fontFamily?.en || "",
        fontSubfamily: font.names.fontSubfamily?.en || "",
        uniqueID: font.names.uniqueID?.en || "",
        fullName: font.names.fullName?.en || "",
        version: font.names.version?.en || "",
        postScriptName: font.names.postScriptName?.en || "",
      },
    };
  }

  private static pathToOutline(path: any, scale: number): string {
    const commands: string[] = [];

    for (const cmd of path.commands) {
      switch (cmd.type) {
        case "M":
          commands.push(`m ${this.round(cmd.x * scale)} ${this.round(cmd.y * scale)}`);
          break;
        case "L":
          commands.push(`l ${this.round(cmd.x * scale)} ${this.round(cmd.y * scale)}`);
          break;
        case "Q":
          commands.push(
            `q ${this.round(cmd.x1 * scale)} ${this.round(cmd.y1 * scale)} ${this.round(
              cmd.x * scale
            )} ${this.round(cmd.y * scale)}`
          );
          break;
        case "C":
          commands.push(
            `b ${this.round(cmd.x1 * scale)} ${this.round(cmd.y1 * scale)} ${this.round(
              cmd.x2 * scale
            )} ${this.round(cmd.y2 * scale)} ${this.round(cmd.x * scale)} ${this.round(
              cmd.y * scale
            )}`
          );
          break;
        case "Z":
          commands.push("z");
          break;
      }
    }

    return commands.join(" ");
  }

  private static round(value: number): number {
    return Math.round(value * 100) / 100;
  }

  static isTypefaceJson(url: string): boolean {
    const lower = url.toLowerCase();
    return lower.endsWith(".json") || lower.includes("typeface");
  }

  static isFontFile(url: string): boolean {
    const lower = url.toLowerCase();
    return (
      lower.endsWith(".ttf") ||
      lower.endsWith(".otf") ||
      lower.endsWith(".woff") ||
      lower.endsWith(".woff2")
    );
  }

  static clearCache(): void {
    this.cache.clear();
  }
}
