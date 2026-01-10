import {
  I3DEngine,
  I3DVector3,
  I3DVector2,
  I3DQuaternion,
  I3DEuler,
  I3DMatrix4,
  I3DBox3,
  I3DScene,
  I3DRenderer,
  I3DPerspectiveCamera,
  I3DOrthographicCamera,
  I3DObject,
  I3DMesh,
  I3DGeometry,
  I3DMaterial,
  I3DRenderTarget,
  I3DLight,
  I3DTextureLoader,
  I3DModelLoader,
  ParticleSystemConfig,
  I3DParticleSystem,
} from "../core/abstractions/I3DEngine";
import { I3DEngineProvider } from "../core/abstractions/I3DEngineProvider";
import { IMaterialFactory } from "../core/materials";
import { ThreeJSMaterialFactory } from "./ThreeJSMaterialFactory";
import { FontConverter } from "../core/text";

export class ThreeJSEngine implements I3DEngine {
  private THREE: any;
  private loaders: Record<string, any>;
  private materialFactory: ThreeJSMaterialFactory | null = null;
  private particleModelCache: Map<string, any> = new Map();
  private particleModelPromiseCache: Map<string, Promise<any>> = new Map();
  private fontCache: Map<string, any> = new Map();
  private fontPromiseCache: Map<string, Promise<any>> = new Map();
  private fontMetricsCache: Map<string, { ascent: number; descent: number }> = new Map();

  constructor(THREE: any, loaders: Record<string, any> = {}) {
    this.THREE = THREE;
    this.loaders = loaders;
    this.materialFactory = new ThreeJSMaterialFactory(THREE);
  }

  getMaterialFactory(): IMaterialFactory | null {
    return this.materialFactory;
  }

  createVector3(x = 0, y = 0, z = 0): I3DVector3 {
    return new this.THREE.Vector3(x, y, z);
  }

  createVector2(x = 0, y = 0): I3DVector2 {
    return new this.THREE.Vector2(x, y);
  }

  createQuaternion(x = 0, y = 0, z = 0, w = 1): I3DQuaternion {
    return new this.THREE.Quaternion(x, y, z, w);
  }

  createEuler(x = 0, y = 0, z = 0, order = "XYZ"): I3DEuler {
    return new this.THREE.Euler(x, y, z, order);
  }

  createMatrix4(): I3DMatrix4 {
    return new this.THREE.Matrix4();
  }

  createBox3(min?: I3DVector3, max?: I3DVector3): I3DBox3 {
    return new this.THREE.Box3(min, max);
  }

  createScene(): I3DScene {
    return new this.THREE.Scene();
  }

  createRenderer(options?: {
    antialias?: boolean;
    alpha?: boolean;
    logarithmicDepthBuffer?: boolean;
  }): I3DRenderer {
    const renderer = new this.THREE.WebGLRenderer(options);
    renderer.outputEncoding = this.THREE.sRGBEncoding;
    return renderer;
  }

  createPerspectiveCamera(fov = 45, aspect = 1, near = 0.1, far = 2000): I3DPerspectiveCamera {
    return new this.THREE.PerspectiveCamera(fov, aspect, near, far);
  }

  createOrthographicCamera(
    left: number,
    right: number,
    top: number,
    bottom: number,
    near = 0.1,
    far = 10000
  ): I3DOrthographicCamera {
    return new this.THREE.OrthographicCamera(left, right, top, bottom, near, far);
  }

  createGroup(): I3DObject {
    return new this.THREE.Group();
  }

  createMesh(geometry: I3DGeometry, material: I3DMaterial): I3DMesh {
    return new this.THREE.Mesh(geometry, material);
  }

  createBoxGeometry(width: number, height: number, depth: number): I3DGeometry {
    return new this.THREE.BoxGeometry(width, height, depth);
  }

  createSphereGeometry(radius: number, widthSegments = 32, heightSegments = 32): I3DGeometry {
    return new this.THREE.SphereGeometry(radius, widthSegments, heightSegments);
  }

  createPlaneGeometry(width: number, height: number): I3DGeometry {
    return new this.THREE.PlaneGeometry(width, height);
  }

  createCylinderGeometry(
    radiusTop: number,
    radiusBottom: number,
    height: number,
    segments = 32
  ): I3DGeometry {
    return new this.THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments);
  }

  createMeshBasicMaterial(params?: any): I3DMaterial {
    return new this.THREE.MeshBasicMaterial(params);
  }

  createMeshStandardMaterial(params?: any): I3DMaterial {
    return new this.THREE.MeshStandardMaterial(params);
  }

  createShaderMaterial(params?: any): I3DMaterial {
    return new this.THREE.ShaderMaterial(params);
  }
  createPointLight(color?: string | number, intensity = 1, distance = 0, decay = 2): I3DLight {
    return new this.THREE.PointLight(color, intensity, distance, decay);
  }

  createSpotLight(
    color?: string | number,
    intensity = 1,
    distance = 0,
    angle = Math.PI / 3,
    penumbra = 0,
    decay = 1
  ): I3DLight {
    return new this.THREE.SpotLight(color, intensity, distance, angle, penumbra, decay);
  }

  createHemisphereLight(
    skyColor?: string | number,
    groundColor?: string | number,
    intensity = 1
  ): I3DLight {
    return new this.THREE.HemisphereLight(skyColor, groundColor, intensity);
  }

  createAmbientLight(color?: string | number, intensity = 1): I3DLight {
    return new this.THREE.AmbientLight(color, intensity);
  }

  createDirectionalLight(color?: string | number, intensity = 1): I3DLight {
    return new this.THREE.DirectionalLight(color, intensity);
  }

  createTextureLoader(): I3DTextureLoader {
    return new this.THREE.TextureLoader();
  }

  createModelLoader(type: string): I3DModelLoader {
    const LoaderClass = this.loaders[type];
    if (!LoaderClass) {
      throw new Error(`[ThreeJSEngine] Model loader "${type}" not registered`);
    }
    return new LoaderClass();
  }

  createRenderTarget(width: number, height: number, options: any = {}): I3DRenderTarget {
    const defaults = {
      minFilter: this.THREE.LinearFilter,
      magFilter: this.THREE.LinearFilter,
      format: this.THREE.RGBAFormat,
      depthBuffer: true,
      stencilBuffer: false,
    };
    return new this.THREE.WebGLRenderTarget(width, height, { ...defaults, ...options });
  }

  loadFont(url: string): Promise<any> {
    const normalized = url.trim();
    if (!normalized || normalized === "none") {
      return Promise.resolve(null);
    }
    if (this.fontCache.has(normalized)) {
      return Promise.resolve(this.fontCache.get(normalized));
    }
    const cachedPromise = this.fontPromiseCache.get(normalized);
    if (cachedPromise) return cachedPromise;

    // Determine if this is a font file (TTF/OTF/WOFF) or typeface.json
    const isFontFile = FontConverter.isFontFile(normalized);

    let promise: Promise<any>;

    if (isFontFile) {
      // Use FontConverter for TTF/OTF/WOFF/WOFF2 files
      promise = this.loadFontWithConverter(normalized);
    } else {
      // Use FontLoader for typeface.json files
      promise = this.loadFontWithLoader(normalized);
    }

    this.fontPromiseCache.set(normalized, promise);
    return promise;
  }

  private async loadFontWithConverter(url: string): Promise<any> {
    try {
      const fontData = await FontConverter.load(url);
      // Convert FontData to Three.js Font format
      const font = this.createFontFromData(fontData);
      this.fontCache.set(url, font);
      return font;
    } catch (error) {
      console.warn("[String3D] Font conversion error:", error);
      return null;
    }
  }

  private loadFontWithLoader(url: string): Promise<any> {
    const LoaderClass = this.loaders.font || this.loaders.FontLoader;
    if (!LoaderClass) {
      console.warn("[String3D] No FontLoader registered.");
      return Promise.resolve(null);
    }

    const loader = new LoaderClass();
    return new Promise<any>((resolve) => {
      loader.load(
        url,
        (font: any) => {
          this.fontCache.set(url, font);
          resolve(font);
        },
        undefined,
        (error: any) => {
          console.warn("[String3D] Font loading error:", error);
          resolve(null);
        }
      );
    });
  }

  /**
   * Create a Three.js-compatible Font object from FontData
   */
  private createFontFromData(fontData: any): any {
    // Create a font object compatible with Three.js Font class
    // Three.js Font expects a specific structure with generateShapes method
    const font = {
      data: fontData,
      generateShapes: (text: string, size: number) => {
        return this.generateShapesFromFontData(fontData, text, size);
      },
    };
    return font;
  }

  /**
   * Generate Three.js Shapes from FontData for given text
   * This generates shapes for a SINGLE character only (used by buildLineShapes)
   */
  private generateShapesFromFontData(fontData: any, text: string, size: number): any[] {
    const shapes: any[] = [];
    const scale = size / fontData.resolution;

    // Only process first character - buildLineShapes handles positioning
    const char = text[0];
    if (!char) return shapes;

    const glyph = fontData.glyphs[char];
    if (!glyph || !glyph.o) return shapes;

    const charShapes = this.parseOutlineToShapes(glyph.o, scale, 0);
    shapes.push(...charShapes);

    return shapes;
  }

  private parseOutlineToShapes(outline: string, scale: number, offsetX: number = 0): any[] {
    if (!outline) return [];

    const shapePath = new this.THREE.ShapePath();

    const commands = outline.split(" ");
    let i = 0;

    while (i < commands.length) {
      const cmd = commands[i];

      switch (cmd) {
        case "m": 
          {
            const mx = parseFloat(commands[i + 1]) * scale + offsetX;
            const my = -parseFloat(commands[i + 2]) * scale;
            shapePath.moveTo(mx, my);
            i += 3;
          }
          break;

        case "l": 
          {
            const lx = parseFloat(commands[i + 1]) * scale + offsetX;
            const ly = -parseFloat(commands[i + 2]) * scale;
            shapePath.lineTo(lx, ly);
            i += 3;
          }
          break;

        case "q": 
          {
            const qx = parseFloat(commands[i + 3]) * scale + offsetX;
            const qy = -parseFloat(commands[i + 4]) * scale;
            shapePath.quadraticCurveTo(
              parseFloat(commands[i + 1]) * scale + offsetX,
              -parseFloat(commands[i + 2]) * scale,
              qx,
              qy
            );
            i += 5;
          }
          break;

        case "b": 
          {
            const bx = parseFloat(commands[i + 5]) * scale + offsetX;
            const by = -parseFloat(commands[i + 6]) * scale;
            shapePath.bezierCurveTo(
              parseFloat(commands[i + 1]) * scale + offsetX,
              -parseFloat(commands[i + 2]) * scale,
              parseFloat(commands[i + 3]) * scale + offsetX,
              -parseFloat(commands[i + 4]) * scale,
              bx,
              by
            );
            i += 7;
          }
          break;
        case "z":
          {
            if (typeof shapePath.closePath === "function") {
              shapePath.closePath();
            } else if (shapePath.currentPath && typeof shapePath.currentPath.closePath === "function") {
              shapePath.currentPath.closePath();
            }
            i += 1;
          }
          break;

        default:
          i++;
          break;
      }
    }

    const shapes = shapePath.toShapes(true);
    return shapes;
  }
  
  private reversePath(path: any): any {
      const newPath = new this.THREE.Path();
      if (!path.curves || path.curves.length === 0) return newPath;
      
      // Start at the END of the last curve
      const lastCurve = path.curves[path.curves.length - 1];
      const endPoint = lastCurve.v2 || lastCurve.v3 || (lastCurve.getPoint ? lastCurve.getPoint(1) : null);
      if (endPoint) {
          newPath.moveTo(endPoint.x, endPoint.y);
      }
      
      // Iterate backwards
      for (let i = path.curves.length - 1; i >= 0; i--) {
          const curve = path.curves[i];
          // Check type
          if (curve.isLineCurve || curve.type === 'LineCurve' || curve.type === 'LineCurve3') {
              newPath.lineTo(curve.v1.x, curve.v1.y);
          } else if (curve.isQuadraticBezierCurve || curve.type === 'QuadraticBezierCurve' || curve.type === 'QuadraticBezierCurve3') {
              newPath.quadraticCurveTo(curve.v1.x, curve.v1.y, curve.v0.x, curve.v0.y);
          } else if (curve.isCubicBezierCurve || curve.type === 'CubicBezierCurve' || curve.type === 'CubicBezierCurve3') {
              newPath.bezierCurveTo(curve.v2.x, curve.v2.y, curve.v1.x, curve.v1.y, curve.v0.x, curve.v0.y);
          }
      }
      
      return newPath;
  }

  createTextGeometry(text: string, font: any, options: any): I3DGeometry | null {
    if (!text || !font) return null;

    const size = Math.max(0.001, options.size || 16);
    const height = Math.max(0, options.height || 0);
    const lineHeight = Math.max(0.001, options.lineHeight || size * 1.2);
    const letterSpacing = Number.isFinite(options.letterSpacing) ? options.letterSpacing : 0;
    const align = options.align || "left";
    const bevelEnabled = !!options.bevelEnabled;
    const bevelThickness = Math.max(0, options.bevelThickness || 0);
    const bevelSize = Math.max(0, options.bevelSize || 0);
    const bevelOffset = options.bevelOffset || 0;
    const bevelSegments = Math.max(0, options.bevelSegments || 0);
    const curveSegments = Math.max(1, Math.round(options.curveSegments || 8));
    const useCanvasText =
      options.useCanvasText && typeof options.fontCss === "string" && options.fontCss.length > 0;

    if (useCanvasText && typeof document !== "undefined" && document.fonts) {
      const fontCss = options.fontCss as string;
      if (!document.fonts.check(fontCss, text)) {
        document.fonts.load(fontCss, text).catch(() => null);
        return null;
      }
    }

    const lines = String(text).split(/\r?\n/);
    const shapes: any[] = [];
    lines.forEach((line, index) => {
      // If explicit layout is provided, use it instead of line-based logic for this line?
      // Actually, if layout is provided, we should probably ignore the `text` splitting logic or apply it differently.
      // But let's look at how we want to use it.
      // If options.layout is provided, we should probably skip the line splitting and just use the layout items.
    });

    const fontMetrics = useCanvasText ? this.measureFontMetrics(options.fontCss) : null;

    if (options.layout) {
      options.layout.forEach((item: any) => {
        const charShapes = useCanvasText
          ? this.buildGlyphShapesFromCanvas(item.char, options.fontCss, options.pixelRatio)
          : [];
        const resolvedShapes = useCanvasText
          ? charShapes
          : this.buildLineShapes(
              item.char,
              font,
              size,
              0 // No spacing needed as we position manually
            ).shapes;
        // Layout coordinates are typically top-left relative.
        // In 3D:
        // x = item.x
        // y = -item.y (inverted)
        const offsetX = item.x;
        const baselineOffset = useCanvasText
          ? Number.isFinite(item.height) && fontMetrics
            ? Math.max(0, item.height - fontMetrics.descent)
            : fontMetrics?.ascent || 0
          : 0;
        const offsetY = useCanvasText ? -(item.y + baselineOffset) : -item.y;

        resolvedShapes.forEach((shape) => {
          let finalShape = this.translateShape(shape, offsetX, offsetY);
          if (item.scale && item.scale !== 1) {
            // We need to scale the shape.
            // Shape manipulation for scale is harder.
            // Easier to scale the geometry later? No, we needed a single geometry.
            // We can scale the points of the shape.
            finalShape = this.scaleShape(finalShape, item.scale);
          }
          shapes.push(finalShape);
        });
      });
    } else {
      // Fallback to legacy line-based logic
      lines.forEach((line, index) => {
        const { shapes: lineShapes, width } = this.buildLineShapes(line, font, size, letterSpacing);
        let offsetX = 0;
        if (align === "center") {
          offsetX = -width * 0.5;
        } else if (align === "right") {
          offsetX = -width;
        }
        const offsetY = -index * lineHeight;
        lineShapes.forEach((shape) => {
          shapes.push(this.translateShape(shape, offsetX, offsetY));
        });
      });
    }

    if (!shapes.length) {
      return null;
    }

    const geometry = new this.THREE.ExtrudeGeometry(shapes, {
      depth: height,
      curveSegments,
      bevelEnabled,
      bevelThickness,
      bevelSize,
      bevelOffset,
      bevelSegments,
    });
    geometry.computeBoundingBox();
    return geometry;
  }

  private buildLineShapes(
    line: string,
    font: any,
    size: number,
    letterSpacing: number
  ): { shapes: any[]; width: number } {
    const shapes: any[] = [];
    let x = 0;
    const chars = Array.from(line);

    // Debug first call only
    const debugAdvances: { char: string; advance: number }[] = [];

    chars.forEach((char, index) => {
      const charShapes = font.generateShapes(char, size);
      charShapes.forEach((shape: any) => {
        const translated = this.translateShape(shape, x, 0);
        shapes.push(translated);
      });
      const advance = this.getGlyphAdvance(font, char, size);

      if (debugAdvances.length < 10) {
        debugAdvances.push({ char, advance });
      }

      x += advance;
      if (letterSpacing !== 0 && index < chars.length - 1) {
        x += letterSpacing;
      }
    });

    return { shapes, width: x };
  }

  private getGlyphAdvance(font: any, char: string, size: number): number {
    const data = font?.data;
    const glyphs = data?.glyphs || {};
    const glyph = glyphs[char] || glyphs[char.charCodeAt(0)] || glyphs["?"];
    const ha = glyph?.ha ?? data?.ha;
    const resolution = data?.resolution || 1000;
    if (typeof ha === "number") {
      return (ha / resolution) * size;
    }
    return size * 0.5;
  }

  private translateShape(shape: any, x: number, y: number): any {
    if (!shape || (!x && !y)) return shape;
    if (typeof shape.translate === "function") {
      shape.translate(x, y);
      return shape;
    }
    if (typeof shape.applyMatrix4 === "function") {
      const matrix = new this.THREE.Matrix4().makeTranslation(x, y, 0);
      shape.applyMatrix4(matrix);
      return shape;
    }
    if (typeof shape.extractPoints === "function") {
      const { shape: points, holes } = shape.extractPoints(12);
      const toVec2 = (pt: any) => new this.THREE.Vector2((pt.x || 0) + x, (pt.y || 0) + y);
      const newShape = new this.THREE.Shape(points.map(toVec2));
      if (Array.isArray(holes)) {
        holes.forEach((hole: any[]) => {
          const holePath = new this.THREE.Path();
          holePath.setFromPoints(hole.map(toVec2));
          newShape.holes.push(holePath);
        });
      }
      return newShape;
    }
    return shape;
  }

  private scaleShape(shape: any, s: number): any {
    if (s === 1) return shape;
    if (typeof shape.scale === "function") {
      shape.scale(s, s);
      return shape;
    }
     // Fallback if shape object doesn't have scale (THREE.Shape doesn't usually have .scale())
     // applying matrix
    if (typeof shape.applyMatrix4 === "function") {
       const matrix = new this.THREE.Matrix4().makeScale(s, s, 1);
       shape.applyMatrix4(matrix);
       return shape;
    }

     // Manual point scaling
    if (typeof shape.extractPoints === "function") {
      const { shape: points, holes } = shape.extractPoints(12);
      const toVec2 = (pt: any) => new this.THREE.Vector2((pt.x || 0) * s, (pt.y || 0) * s);
      const newShape = new this.THREE.Shape(points.map(toVec2));
      if (Array.isArray(holes)) {
        holes.forEach((hole: any[]) => {
          const holePath = new this.THREE.Path();
          holePath.setFromPoints(hole.map(toVec2));
          newShape.holes.push(holePath);
        });
      }
      return newShape;
    }
    return shape;
  }

  private buildGlyphShapesFromCanvas(
    char: string,
    fontCss: string,
    pixelRatio?: number
  ): any[] {
    if (!char || !fontCss) return [];
    if (!char.trim()) return [];
    if (typeof document === "undefined") return [];

    const ratio =
      typeof pixelRatio === "number"
        ? Math.max(1, Math.min(3, pixelRatio))
        : typeof window !== "undefined"
        ? Math.max(1, Math.min(3, window.devicePixelRatio || 1))
        : 1;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return [];

    ctx.font = fontCss;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";

    const metrics = ctx.measureText(char);
    const leftBearingPx = Number.isFinite(metrics.actualBoundingBoxLeft)
      ? metrics.actualBoundingBoxLeft * ratio
      : 0;
    const ascentPx = Number.isFinite(metrics.actualBoundingBoxAscent)
      ? metrics.actualBoundingBoxAscent * ratio
      : 0;

    const glyphWidth = Math.max(
      1,
      Math.ceil(((metrics.actualBoundingBoxLeft || 0) + (metrics.actualBoundingBoxRight || 0)) * ratio)
    );
    const glyphHeight = Math.max(
      1,
      Math.ceil(((metrics.actualBoundingBoxAscent || 0) + (metrics.actualBoundingBoxDescent || 0)) * ratio)
    );

    const pad = Math.ceil(2 * ratio);
    canvas.width = glyphWidth + pad * 2;
    canvas.height = glyphHeight + pad * 2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = fontCss;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    ctx.fillStyle = "#000";

    const drawX = pad + leftBearingPx;
    const drawY = pad + ascentPx;
    ctx.fillText(char, drawX, drawY);

    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const contours = this.traceContoursFromAlpha(image.data, canvas.width, canvas.height, 16);
    if (!contours.length) return [];

    const scale = 1 / ratio;
    return this.contoursToShapes(contours, scale, pad + leftBearingPx, pad + ascentPx);
  }

  private measureFontMetrics(fontCss: string): { ascent: number; descent: number } {
    if (!fontCss) return { ascent: 0, descent: 0 };
    const cached = this.fontMetricsCache.get(fontCss);
    if (cached) return cached;
    if (typeof document === "undefined") {
      const fallback = { ascent: 0, descent: 0 };
      this.fontMetricsCache.set(fontCss, fallback);
      return fallback;
    }
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      const fallback = { ascent: 0, descent: 0 };
      this.fontMetricsCache.set(fontCss, fallback);
      return fallback;
    }
    ctx.font = fontCss;
    ctx.textBaseline = "alphabetic";
    const metrics = ctx.measureText("Mg");
    const ascent = Number.isFinite(metrics.actualBoundingBoxAscent)
      ? metrics.actualBoundingBoxAscent
      : 0;
    const descent = Number.isFinite(metrics.actualBoundingBoxDescent)
      ? metrics.actualBoundingBoxDescent
      : 0;
    const result = { ascent, descent };
    this.fontMetricsCache.set(fontCss, result);
    return result;
  }

  private traceContoursFromAlpha(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    threshold: number
  ): Array<Array<{ x: number; y: number }>> {
    const inside = (x: number, y: number): boolean => {
      if (x < 0 || y < 0 || x >= width || y >= height) return false;
      const idx = (y * width + x) * 4 + 3;
      return data[idx] >= threshold;
    };

    const edgesFrom = new Map<string, string[]>();
    const edgeKeys: string[] = [];
    const addEdge = (x1: number, y1: number, x2: number, y2: number): void => {
      const k1 = `${x1},${y1}`;
      const k2 = `${x2},${y2}`;
      let list = edgesFrom.get(k1);
      if (!list) {
        list = [];
        edgesFrom.set(k1, list);
      }
      list.push(k2);
      edgeKeys.push(`${k1}|${k2}`);
    };

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (!inside(x, y)) continue;
        if (!inside(x, y - 1)) {
          addEdge(x + 1, y, x, y);
        }
        if (!inside(x + 1, y)) {
          addEdge(x + 1, y + 1, x + 1, y);
        }
        if (!inside(x, y + 1)) {
          addEdge(x, y + 1, x + 1, y + 1);
        }
        if (!inside(x - 1, y)) {
          addEdge(x, y, x, y + 1);
        }
      }
    }

    const used = new Set<string>();
    const contours: Array<Array<{ x: number; y: number }>> = [];
    const parsePoint = (key: string): { x: number; y: number } => {
      const [sx, sy] = key.split(",");
      return { x: Number(sx), y: Number(sy) };
    };

    for (const edgeKey of edgeKeys) {
      if (used.has(edgeKey)) continue;
      const [startKey, endKey] = edgeKey.split("|");
      const loop: Array<{ x: number; y: number }> = [];
      used.add(edgeKey);
      loop.push(parsePoint(startKey));
      let currentKey = endKey;
      let guard = 0;

      while (currentKey !== startKey && guard < width * height * 4) {
        loop.push(parsePoint(currentKey));
        const nextList = edgesFrom.get(currentKey);
        if (!nextList || nextList.length === 0) break;
        let nextKey: string | null = null;
        for (const candidate of nextList) {
          const candEdge = `${currentKey}|${candidate}`;
          if (!used.has(candEdge)) {
            nextKey = candidate;
            used.add(candEdge);
            break;
          }
        }
        if (!nextKey) break;
        currentKey = nextKey;
        guard += 1;
      }

    if (loop.length >= 3) {
        const cleaned = this.simplifyCollinear(loop);
        const simplified = this.simplifyRdp(cleaned, 0.75);
        if (simplified.length >= 3) {
          contours.push(simplified);
        }
      }
    }

    return contours;
  }

  private simplifyCollinear(points: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
    if (points.length < 4) return points;
    const result: Array<{ x: number; y: number }> = [];
    const len = points.length;
    for (let i = 0; i < len; i += 1) {
      const prev = points[(i - 1 + len) % len];
      const curr = points[i];
      const next = points[(i + 1) % len];
      const dx1 = curr.x - prev.x;
      const dy1 = curr.y - prev.y;
      const dx2 = next.x - curr.x;
      const dy2 = next.y - curr.y;
      const cross = dx1 * dy2 - dy1 * dx2;
      if (Math.abs(cross) > 0) {
        result.push(curr);
      }
    }
    return result;
  }

  private simplifyRdp(
    points: Array<{ x: number; y: number }>,
    epsilon: number
  ): Array<{ x: number; y: number }> {
    if (points.length < 3) return points;
    const last = points.length - 1;
    let maxDist = 0;
    let index = 0;
    const start = points[0];
    const end = points[last];
    for (let i = 1; i < last; i += 1) {
      const d = this.pointLineDistance(points[i], start, end);
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }
    if (maxDist <= epsilon) {
      return [start, end];
    }
    const left = this.simplifyRdp(points.slice(0, index + 1), epsilon);
    const right = this.simplifyRdp(points.slice(index), epsilon);
    return left.slice(0, -1).concat(right);
  }

  private pointLineDistance(
    point: { x: number; y: number },
    start: { x: number; y: number },
    end: { x: number; y: number }
  ): number {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    if (dx === 0 && dy === 0) {
      const px = point.x - start.x;
      const py = point.y - start.y;
      return Math.sqrt(px * px + py * py);
    }
    const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy);
    const clamped = Math.max(0, Math.min(1, t));
    const projX = start.x + clamped * dx;
    const projY = start.y + clamped * dy;
    const ox = point.x - projX;
    const oy = point.y - projY;
    return Math.sqrt(ox * ox + oy * oy);
  }

  private contoursToShapes(
    contours: Array<Array<{ x: number; y: number }>>,
    scale: number,
    offsetX: number = 0,
    offsetY: number = 0
  ): any[] {
    if (!contours.length) return [];
    const solids: Array<{ shape: any; points: Array<{ x: number; y: number }> }> = [];
    const holes: Array<{ path: any; point: { x: number; y: number } }> = [];

    const signedArea = (pts: Array<{ x: number; y: number }>): number => {
      let area = 0;
      for (let i = 0; i < pts.length; i += 1) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        area += a.x * b.y - b.x * a.y;
      }
      return area * 0.5;
    };

    const toScaled = (pts: Array<{ x: number; y: number }>) =>
      pts.map((p) => ({ x: (p.x - offsetX) * scale, y: -(p.y - offsetY) * scale }));

    for (const contour of contours) {
      if (contour.length < 3) continue;
      const pts = toScaled(contour);
      const area = signedArea(pts);

      if (area >= 0) {
        const shape = new this.THREE.Shape();
        shape.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i += 1) {
          shape.lineTo(pts[i].x, pts[i].y);
        }
        if (typeof shape.closePath === "function") {
          shape.closePath();
        }
        solids.push({ shape, points: pts });
      } else {
        const path = new this.THREE.Path();
        path.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i += 1) {
          path.lineTo(pts[i].x, pts[i].y);
        }
        if (typeof path.closePath === "function") {
          path.closePath();
        }
        holes.push({ path, point: pts[0] });
      }
    }

    const pointInPoly = (pt: { x: number; y: number }, poly: Array<{ x: number; y: number }>) => {
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i].x;
        const yi = poly[i].y;
        const xj = poly[j].x;
        const yj = poly[j].y;
        const intersect =
          yi > pt.y !== yj > pt.y &&
          pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi + Number.EPSILON) + xi;
        if (intersect) inside = !inside;
      }
      return inside;
    };

    for (const hole of holes) {
      let assigned = false;
      for (const solid of solids) {
        if (pointInPoly(hole.point, solid.points)) {
          solid.shape.holes.push(hole.path);
          assigned = true;
          break;
        }
      }
      if (!assigned && solids.length > 0) {
        solids[0].shape.holes.push(hole.path);
      }
    }

    return solids.map((s) => s.shape);
  }

  private resolveParticleModelGeometry(
    modelUrl: string,
    loaderType?: string,
    nodeName?: string
  ): Promise<any | null> {
    const url = modelUrl.trim();
    if (!url || url === "none") {
      return Promise.resolve(null);
    }

    const normalizedLoader =
      loaderType && loaderType !== "none"
        ? loaderType
        : this.loaders.gltf
        ? "gltf"
        : Object.keys(this.loaders)[0];
    if (!normalizedLoader) {
      console.warn("[String3D] No model loader registered for particle models.");
      return Promise.resolve(null);
    }

    const nodeKey = (nodeName || "").trim();
    const cacheKey = `${normalizedLoader}|${url}|${nodeKey}`;
    if (this.particleModelCache.has(cacheKey)) {
      return Promise.resolve(this.particleModelCache.get(cacheKey));
    }
    const cachedPromise = this.particleModelPromiseCache.get(cacheKey);
    if (cachedPromise) {
      return cachedPromise;
    }

    const promise = new Promise<any | null>((resolve) => {
      let loader: I3DModelLoader | null = null;
      try {
        loader = this.createModelLoader(normalizedLoader);
      } catch (error) {
        console.warn("[String3D] Failed to create model loader:", error);
        resolve(null);
        return;
      }

      loader.load(
        url,
        (gltf: any) => {
          const root = gltf?.scene || gltf?.object || gltf;
          if (!root) {
            resolve(null);
            return;
          }
          let mesh: any = null;
          if (nodeKey) {
            if (root.getObjectByName) {
              const found = root.getObjectByName(nodeKey);
              if (found?.isMesh) mesh = found;
            }
            if (!mesh && root.traverse) {
              root.traverse((child: any) => {
                if (mesh) return;
                if (child?.isMesh && child?.name === nodeKey) {
                  mesh = child;
                }
              });
            }
          }
          if (!mesh) {
            if (root.isMesh) {
              mesh = root;
            } else if (root.traverse) {
              root.traverse((child: any) => {
                if (!mesh && child?.isMesh) {
                  mesh = child;
                }
              });
            }
          }

          const geometry = mesh?.geometry || null;
          if (!geometry) {
            resolve(null);
            return;
          }
          this.particleModelCache.set(cacheKey, geometry);
          resolve(geometry);
        },
        undefined,
        (error: any) => {
          console.warn("[String3D] Particle model loading error:", error);
          resolve(null);
        }
      );
    });

    this.particleModelPromiseCache.set(cacheKey, promise);
    return promise;
  }

  createParticleSystem(config: ParticleSystemConfig): I3DParticleSystem {
    const THREE = this.THREE;
    const engine = this;

    const makeRng = (seed: number) => {
      let s = Math.max(1, seed | 0);
      return () => {
        s ^= s << 13;
        s ^= s >> 17;
        s ^= s << 5;
        return ((s >>> 0) % 100000) / 100000;
      };
    };

    class ParticleSystem extends THREE.Object3D {
      private cfg: ParticleSystemConfig;
      private rng = makeRng(config.seed);
      private points: any = null;
      private instanced: any = null;
      private positions: Float32Array = new Float32Array(0);
      private velocities: Float32Array = new Float32Array(0);
      private life: Float32Array = new Float32Array(0);
      private colors: Float32Array = new Float32Array(0);
      private sizeFactors: Float32Array = new Float32Array(0);
      private alive = 0;
      private emitRemainder = 0;
      private pendingBurst = 0;
      private basePositions: Float32Array = new Float32Array(0);
      private baseScales: Float32Array = new Float32Array(0);
      private baseJitter: Float32Array = new Float32Array(0);
      private basePhase: Float32Array = new Float32Array(0);
      private elapsed = 0;
      private modelGeometry: any = null;
      private modelKey = "";
      private instancedUsesSharedGeometry = false;
      private distributionGeometry: any = null;
      private distributionKey = "";
      private materialOverride: any = null;
      private materialOverrideForPoints: any = null;
      private defaultEmitterMaterial: any = null;
      private defaultInstancedMaterial: any = null;

      constructor(cfg: ParticleSystemConfig) {
        super();
        this.cfg = { ...cfg };
        this.refreshModelGeometry();
        this.rebuild();
      }

      setConfig(config: ParticleSystemConfig): void {
        const prev = this.cfg;
        this.cfg = { ...config };
        const emitterReset =
          this.cfg.mode === "emitter" &&
          (prev.emitRate !== this.cfg.emitRate ||
            prev.emitBurst !== this.cfg.emitBurst ||
            prev.particleLife !== this.cfg.particleLife ||
            prev.particleSpeed !== this.cfg.particleSpeed ||
            !this.isVec3Equal(prev.particleDirection, this.cfg.particleDirection) ||
            !this.isVec3Equal(prev.particleGravity, this.cfg.particleGravity) ||
            prev.particleDrag !== this.cfg.particleDrag ||
            prev.particleSizeVariation !== this.cfg.particleSizeVariation ||
            prev.particleColorVariation !== this.cfg.particleColorVariation ||
            prev.color !== this.cfg.color);
        const needsRebuild =
          prev.mode !== this.cfg.mode ||
          prev.count !== this.cfg.count ||
          prev.seed !== this.cfg.seed ||
          prev.spread !== this.cfg.spread ||
          prev.particleShape !== this.cfg.particleShape ||
          prev.particleModelUrl !== this.cfg.particleModelUrl ||
          prev.particleModelLoader !== this.cfg.particleModelLoader ||
          prev.particleModelNode !== this.cfg.particleModelNode ||
          prev.instanceShape !== this.cfg.instanceShape ||
          prev.instanceModelUrl !== this.cfg.instanceModelUrl ||
          prev.instanceModelLoader !== this.cfg.instanceModelLoader ||
          prev.instanceModelNode !== this.cfg.instanceModelNode ||
          prev.instanceScale !== this.cfg.instanceScale ||
          prev.instanceScaleVariation !== this.cfg.instanceScaleVariation;
        if (needsRebuild) {
          this.refreshModelGeometry();
          this.refreshDistributionGeometry();
          this.rebuild();
          return;
        }
        if (emitterReset) {
          this.resetEmitter();
        }
        if (this.points) {
          const uniforms = this.points.material.uniforms;
          if (uniforms) {
            if (uniforms.uOpacity) {
              uniforms.uOpacity.value = this.cfg.opacity;
            }
            if (uniforms.uSize) {
              uniforms.uSize.value = this.cfg.size;
            }
            if (uniforms.uSizeVar) {
              uniforms.uSizeVar.value = this.cfg.particleSizeVariation;
            }
            if (uniforms.uPointSize) {
              uniforms.uPointSize.value = this.cfg.size;
            }
          }
        }
        if (this.instanced) {
          this.instanced.material.opacity = this.cfg.opacity;
          this.instanced.material.color = new THREE.Color(this.cfg.color);
        }
        this.pendingBurst = this.cfg.emitBurst;
      }

      update(dt: number): void {
        if (dt <= 0) return;
        this.elapsed += dt;
        if (this.cfg.mode === "emitter") {
          this.updateEmitter(dt);
        } else {
          this.updateInstanced(this.elapsed);
        }
      }

      dispose(): void {
        if (this.points) {
          this.points.geometry.dispose();
          this.points.material.dispose();
        }
        if (this.instanced) {
          if (!this.instancedUsesSharedGeometry) {
            this.instanced.geometry.dispose();
          }
          this.instanced.material.dispose();
        }
      }

      private rebuild(): void {
        if (this.points) {
          this.remove(this.points);
          this.points.geometry.dispose();
          this.points.material.dispose();
          this.points = null;
        }
        if (this.instanced) {
          this.remove(this.instanced);
          if (!this.instancedUsesSharedGeometry) {
            this.instanced.geometry.dispose();
          }
          this.instanced.material.dispose();
          this.instanced = null;
        }
        this.elapsed = 0;

        if (this.cfg.mode === "emitter") {
          this.buildEmitter();
        } else {
          this.refreshDistributionGeometry();
          this.buildInstanced();
        }
        this.applyMaterialOverrides();
      }

      private buildEmitter(): void {
        const count = Math.max(1, this.cfg.count);
        this.positions = new Float32Array(count * 3);
        this.velocities = new Float32Array(count * 3);
        this.life = new Float32Array(count);
        this.colors = new Float32Array(count * 3);
        this.sizeFactors = new Float32Array(count);
        const hide = 1e6;
        for (let i = 0; i < count; i += 1) {
          const i3 = i * 3;
          this.positions[i3] = hide;
          this.positions[i3 + 1] = hide;
          this.positions[i3 + 2] = hide;
        }
        this.alive = 0;
        this.emitRemainder = 0;
        this.pendingBurst = this.cfg.emitBurst;

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
        geometry.setAttribute("color", new THREE.BufferAttribute(this.colors, 3));
        geometry.setAttribute("sizeFactor", new THREE.BufferAttribute(this.sizeFactors, 1));
        const material = new THREE.ShaderMaterial({
          transparent: this.cfg.opacity < 1,
          depthWrite: false,
          uniforms: {
            uOpacity: { value: this.cfg.opacity },
            uSize: { value: this.cfg.size },
            uSizeVar: { value: this.cfg.particleSizeVariation },
          },
          vertexShader: `
            attribute vec3 color;
            attribute float sizeFactor;
            varying vec3 vColor;
            uniform float uSize;
            uniform float uSizeVar;
            void main() {
              vColor = color;
              float size = uSize * mix(1.0 - uSizeVar, 1.0, sizeFactor);
              gl_PointSize = size;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: `
            varying vec3 vColor;
            uniform float uOpacity;
            void main() {
              float dist = length(gl_PointCoord - vec2(0.5));
              if (dist > 0.5) discard;
              gl_FragColor = vec4(vColor, uOpacity);
            }
          `,
        });
        this.points = new THREE.Points(geometry, material);
        this.defaultEmitterMaterial = material;
        this.add(this.points);
      }

      private buildInstanced(): void {
        const count = Math.max(1, this.cfg.count);
        const useSharedGeometry = this.cfg.particleShape === "model" && this.modelGeometry;
        const geometry =
          this.cfg.particleShape === "model" && this.modelGeometry
            ? this.modelGeometry
            : this.cfg.particleShape === "box"
            ? new THREE.BoxGeometry(1, 1, 1)
            : new THREE.SphereGeometry(0.5, 8, 8);
        this.instancedUsesSharedGeometry = useSharedGeometry;
        const material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(this.cfg.color),
          transparent: this.cfg.opacity < 1,
          opacity: this.cfg.opacity,
        });
        this.defaultInstancedMaterial = material;
        this.instanced = new THREE.InstancedMesh(geometry, material, count);
        this.basePositions = new Float32Array(count * 3);
        this.baseScales = new Float32Array(count);
        this.baseJitter = new Float32Array(count * 3);
        this.basePhase = new Float32Array(count);
        this.fillBasePositions(count);
        this.applyInstancedTransforms(0);
        this.add(this.instanced);
      }

      setMaterial(
        material: any | null,
        options: { points?: boolean; meshes?: boolean } = {}
      ): void {
        const setPoints = options.points ?? true;
        const setMeshes = options.meshes ?? true;
        if (setMeshes) {
          this.materialOverride = material;
        }
        if (setPoints) {
          this.materialOverrideForPoints = material;
        }
        this.applyMaterialOverrides();
      }

      private updateEmitter(dt: number): void {
        const count = this.cfg.count;
        const dir = this.normalize(this.cfg.particleDirection);
        const gravity = this.cfg.particleGravity;
        const drag = Math.max(0, Math.min(1, this.cfg.particleDrag));
        const emitRate = this.cfg.emitRate;
        const totalToEmit = emitRate * dt + this.emitRemainder;
        const emitCount = Math.floor(totalToEmit);
        this.emitRemainder = totalToEmit - emitCount;
        let colorDirty = false;
        const hide = 1e6;

        for (let i = 0; i < emitCount; i += 1) {
          this.spawnParticle(dir);
        }
        while (this.pendingBurst > 0) {
          this.spawnParticle(dir);
          this.pendingBurst -= 1;
        }

        for (let i = 0; i < count; i += 1) {
          if (this.life[i] <= 0) continue;
          this.life[i] -= dt;
          if (this.life[i] <= 0) {
            this.life[i] = 0;
            const i3 = i * 3;
            this.positions[i3] = hide;
            this.positions[i3 + 1] = hide;
            this.positions[i3 + 2] = hide;
            this.colors[i3] = 0;
            this.colors[i3 + 1] = 0;
            this.colors[i3 + 2] = 0;
            colorDirty = true;
            continue;
          }
          const idx = i * 3;
          this.velocities[idx] += gravity[0] * dt;
          this.velocities[idx + 1] += gravity[1] * dt;
          this.velocities[idx + 2] += gravity[2] * dt;
          this.velocities[idx] *= 1 - drag * dt;
          this.velocities[idx + 1] *= 1 - drag * dt;
          this.velocities[idx + 2] *= 1 - drag * dt;
          this.positions[idx] += this.velocities[idx] * dt;
          this.positions[idx + 1] += this.velocities[idx + 1] * dt;
          this.positions[idx + 2] += this.velocities[idx + 2] * dt;
        }

        if (this.points) {
          this.points.geometry.attributes.position.needsUpdate = true;
          if (colorDirty) {
            this.points.geometry.attributes.color.needsUpdate = true;
          }
        }
      }

      private spawnParticle(dir: [number, number, number]): void {
        const count = this.cfg.count;
        let idx = -1;
        for (let i = 0; i < count; i += 1) {
          if (this.life[i] <= 0) {
            idx = i;
            break;
          }
        }
        if (idx === -1) return;

        const pos = this.randomInSphere(this.cfg.spread);
        const speed =
          this.cfg.particleSpeed *
          (1 - this.cfg.particleSizeVariation + this.rng() * this.cfg.particleSizeVariation);
        const vel = [
          dir[0] * speed + (this.rng() - 0.5) * speed * 0.2,
          dir[1] * speed + (this.rng() - 0.5) * speed * 0.2,
          dir[2] * speed + (this.rng() - 0.5) * speed * 0.2,
        ];

        const i3 = idx * 3;
        this.positions.set(pos, i3);
        this.velocities.set(vel, i3);
        this.life[idx] = this.cfg.particleLife;
        this.sizeFactors[idx] = this.rng();

        const color = new THREE.Color(this.cfg.color);
        if (this.cfg.particleColorVariation > 0) {
          color.offsetHSL((this.rng() - 0.5) * this.cfg.particleColorVariation, 0, 0);
        }
        this.colors[i3] = color.r;
        this.colors[i3 + 1] = color.g;
        this.colors[i3 + 2] = color.b;
        if (this.points) {
          this.points.geometry.attributes.color.needsUpdate = true;
          this.points.geometry.attributes.sizeFactor.needsUpdate = true;
        }
      }

      private updateInstanced(time: number): void {
        this.applyInstancedTransforms(time);
        if (this.instanced) {
          this.instanced.instanceMatrix.needsUpdate = true;
        }
      }

      private applyInstancedTransforms(time: number): void {
        if (!this.instanced) return;
        const count = this.cfg.count;
        const jitter = this.cfg.instanceJitter;
        const flow = this.cfg.instanceFlow;
        const disperse = Math.max(0, this.cfg.instanceDisperse);
        const scatter = Math.max(0, this.cfg.instanceDisperseScatter);
        const scatterX =
          this.cfg.instanceDisperseScatterX > 0 ? this.cfg.instanceDisperseScatterX : scatter;
        const scatterY =
          this.cfg.instanceDisperseScatterY > 0 ? this.cfg.instanceDisperseScatterY : scatter;
        const scatterZ =
          this.cfg.instanceDisperseScatterZ > 0 ? this.cfg.instanceDisperseScatterZ : scatter;
        const rotSpeed = this.cfg.instanceRotationSpeed;
        const temp = new THREE.Object3D();
        for (let i = 0; i < count; i += 1) {
          const i3 = i * 3;
          const baseX = this.basePositions[i3];
          const baseY = this.basePositions[i3 + 1];
          const baseZ = this.basePositions[i3 + 2];
          const phase = this.basePhase[i];
          const driftX = Math.sin((baseY + time * 1.4) * 0.7 + phase) * flow * this.cfg.spread;
          const driftY = Math.cos((baseX - time * 1.1) * 0.6 + phase) * flow * this.cfg.spread;
          const driftZ = Math.sin((baseZ + time * 1.2) * 0.8 + phase) * flow * this.cfg.spread;
          const jitterX = Math.sin(time * 2.1 + phase + this.baseJitter[i3] * 2.5) * jitter;
          const jitterY = Math.cos(time * 1.7 + phase + this.baseJitter[i3 + 1] * 2.5) * jitter;
          const jitterZ = Math.sin(time * 1.9 + phase + this.baseJitter[i3 + 2] * 2.5) * jitter;
          const dispersal = 1 + disperse;
          const dirX = this.baseJitter[i3];
          const dirY = this.baseJitter[i3 + 1];
          const dirZ = this.baseJitter[i3 + 2];
          const dirLen = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ) || 1;
          const scatterScale = disperse * this.cfg.spread;
          const scatterOffsetX = (dirX / dirLen) * scatterX * scatterScale;
          const scatterOffsetY = (dirY / dirLen) * scatterY * scatterScale;
          const scatterOffsetZ = (dirZ / dirLen) * scatterZ * scatterScale;
          temp.position.set(
            baseX * dispersal + scatterOffsetX + driftX + jitterX,
            baseY * dispersal + scatterOffsetY + driftY + jitterY,
            baseZ * dispersal + scatterOffsetZ + driftZ + jitterZ
          );
          temp.rotation.set(
            this.baseJitter[i3] * 0.5,
            time * rotSpeed + i * 0.1,
            this.baseJitter[i3 + 2] * 0.5
          );
          const scale = this.baseScales[i] * this.cfg.size;
          temp.scale.set(scale, scale, scale);
          temp.updateMatrix();
          this.instanced.setMatrixAt(i, temp.matrix);
        }
      }

      private applyMaterialOverrides(): void {
        if (this.points) {
          const next = this.materialOverrideForPoints || this.defaultEmitterMaterial;
          if (next && this.points.material !== next) {
            this.points.material = next;
            this.ensurePointMaterial(next);
          }
        }
        if (this.instanced) {
          const next = this.materialOverride || this.defaultInstancedMaterial;
          if (next && this.instanced.material !== next) {
            this.instanced.material = next;
          }
        }
      }

      private ensurePointMaterial(material: any): void {
        if (!material?.isShaderMaterial) return;
        if (!material.uniforms) {
          material.uniforms = {};
        }
        if (!material.uniforms.uPointSize) {
          material.uniforms.uPointSize = { value: this.cfg.size };
        }
        if (!material.uniforms.uOpacity) {
          material.uniforms.uOpacity = { value: this.cfg.opacity };
        }
        if (!material.vertexShader.includes("gl_PointSize")) {
          if (!material.vertexShader.includes("uPointSize")) {
            material.vertexShader = `uniform float uPointSize;\n${material.vertexShader}`;
          }
          material.vertexShader = material.vertexShader.replace(
            /void\\s+main\\s*\\(\\)\\s*\\{/,
            "void main() {\\n  gl_PointSize = uPointSize;"
          );
          material.needsUpdate = true;
        }
      }

      private refreshModelGeometry(): void {
        if (this.cfg.particleShape !== "model") {
          this.modelGeometry = null;
          this.modelKey = "";
          return;
        }
        const url = this.cfg.particleModelUrl?.trim();
        if (!url || url === "none") {
          this.modelGeometry = null;
          this.modelKey = "";
          return;
        }
        const key = `${this.cfg.particleModelLoader}|${url}|${this.cfg.particleModelNode}`;
        if (this.modelKey === key && this.modelGeometry) {
          return;
        }
        this.modelKey = key;
        engine
          .resolveParticleModelGeometry(
            url,
            this.cfg.particleModelLoader,
            this.cfg.particleModelNode
          )
          .then((geometry) => {
            if (!geometry) return;
            if (this.modelKey !== key) return;
            this.modelGeometry = geometry;
            if (this.cfg.mode === "instanced" && this.cfg.particleShape === "model") {
              this.rebuild();
            }
          });
      }

      private refreshDistributionGeometry(): void {
        if (this.cfg.instanceShape !== "model") {
          this.distributionGeometry = null;
          this.distributionKey = "";
          return;
        }
        const url = this.cfg.instanceModelUrl?.trim();
        if (!url || url === "none") {
          this.distributionGeometry = null;
          this.distributionKey = "";
          return;
        }
        const key = `${this.cfg.instanceModelLoader}|${url}|${this.cfg.instanceModelNode}`;
        if (this.distributionKey === key && this.distributionGeometry) {
          return;
        }
        this.distributionKey = key;
        engine
          .resolveParticleModelGeometry(
            url,
            this.cfg.instanceModelLoader,
            this.cfg.instanceModelNode
          )
          .then((geometry) => {
            if (!geometry) return;
            if (this.distributionKey !== key) return;
            this.distributionGeometry = geometry;
            if (this.cfg.mode === "instanced" && this.cfg.instanceShape === "model") {
              this.rebuild();
            }
          });
      }

      private fillBasePositions(count: number): void {
        const useModel = this.cfg.instanceShape === "model" && this.distributionGeometry;
        if (useModel) {
          this.fillFromModel(count, this.distributionGeometry);
        } else {
          for (let i = 0; i < count; i += 1) {
            const pos =
              this.cfg.instanceShape === "box"
                ? this.randomInBox(this.cfg.spread)
                : this.randomInSphere(this.cfg.spread);
            this.basePositions.set(pos, i * 3);
          }
        }

        for (let i = 0; i < count; i += 1) {
          const i3 = i * 3;
          this.baseJitter[i3] = this.rng() * 2 - 1;
          this.baseJitter[i3 + 1] = this.rng() * 2 - 1;
          this.baseJitter[i3 + 2] = this.rng() * 2 - 1;
          this.basePhase[i] = this.rng() * Math.PI * 2;
          const scale =
            this.cfg.instanceScale *
            (1 - this.cfg.instanceScaleVariation + this.rng() * this.cfg.instanceScaleVariation);
          this.baseScales[i] = scale;
        }
      }

      private fillFromModel(count: number, geometry: any): void {
        const attr = geometry?.attributes?.position;
        if (!attr?.array || attr.itemSize < 3) {
          for (let i = 0; i < count; i += 1) {
            const pos = this.randomInSphere(this.cfg.spread);
            this.basePositions.set(pos, i * 3);
          }
          return;
        }

        const array = attr.array as ArrayLike<number>;
        const itemSize = attr.itemSize;
        const vertexCount = Math.floor(array.length / itemSize);
        if (vertexCount <= 0) {
          return;
        }

        const indexArray = geometry?.index?.array as ArrayLike<number> | undefined;
        const triangleCount = indexArray
          ? Math.floor(indexArray.length / 3)
          : Math.floor(vertexCount / 3);
        if (triangleCount <= 0) {
          return;
        }

        let minX = Infinity;
        let minY = Infinity;
        let minZ = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        let maxZ = -Infinity;
        for (let i = 0; i < vertexCount; i += 1) {
          const idx = i * itemSize;
          const x = array[idx];
          const y = array[idx + 1];
          const z = array[idx + 2];
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          minZ = Math.min(minZ, z);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
          maxZ = Math.max(maxZ, z);
        }
        const sizeX = Math.max(1e-6, maxX - minX);
        const sizeY = Math.max(1e-6, maxY - minY);
        const sizeZ = Math.max(1e-6, maxZ - minZ);
        const maxSize = Math.max(sizeX, sizeY, sizeZ);
        const targetSize = this.cfg.spread * 2;
        const scale = targetSize > 0 ? targetSize / maxSize : 1;
        const centerX = (minX + maxX) * 0.5;
        const centerY = (minY + maxY) * 0.5;
        const centerZ = (minZ + maxZ) * 0.5;

        const cumulativeAreas = new Float32Array(triangleCount);
        let totalArea = 0;
        for (let i = 0; i < triangleCount; i += 1) {
          const base = i * 3;
          const ia = indexArray ? indexArray[base] : base;
          const ib = indexArray ? indexArray[base + 1] : base + 1;
          const ic = indexArray ? indexArray[base + 2] : base + 2;
          const a = ia * itemSize;
          const b = ib * itemSize;
          const c = ic * itemSize;
          const ax = array[a];
          const ay = array[a + 1];
          const az = array[a + 2];
          const bx = array[b];
          const by = array[b + 1];
          const bz = array[b + 2];
          const cx = array[c];
          const cy = array[c + 1];
          const cz = array[c + 2];
          const abx = bx - ax;
          const aby = by - ay;
          const abz = bz - az;
          const acx = cx - ax;
          const acy = cy - ay;
          const acz = cz - az;
          const crossX = aby * acz - abz * acy;
          const crossY = abz * acx - abx * acz;
          const crossZ = abx * acy - aby * acx;
          const area = Math.sqrt(crossX * crossX + crossY * crossY + crossZ * crossZ) * 0.5;
          totalArea += area;
          cumulativeAreas[i] = totalArea;
        }
        if (totalArea <= 0) {
          for (let i = 0; i < count; i += 1) {
            const pos = this.randomInSphere(this.cfg.spread);
            this.basePositions.set(pos, i * 3);
          }
          return;
        }

        for (let i = 0; i < count; i += 1) {
          const r = this.rng() * totalArea;
          let lo = 0;
          let hi = triangleCount - 1;
          while (lo < hi) {
            const mid = Math.floor((lo + hi) / 2);
            if (r <= cumulativeAreas[mid]) {
              hi = mid;
            } else {
              lo = mid + 1;
            }
          }
          const base = lo * 3;
          const ia = indexArray ? indexArray[base] : base;
          const ib = indexArray ? indexArray[base + 1] : base + 1;
          const ic = indexArray ? indexArray[base + 2] : base + 2;
          const a = ia * itemSize;
          const b = ib * itemSize;
          const c = ic * itemSize;
          const ax = array[a];
          const ay = array[a + 1];
          const az = array[a + 2];
          const bx = array[b];
          const by = array[b + 1];
          const bz = array[b + 2];
          const cx = array[c];
          const cy = array[c + 1];
          const cz = array[c + 2];
          const u = this.rng();
          const v = this.rng();
          const su = Math.sqrt(u);
          const w1 = 1 - su;
          const w2 = su * (1 - v);
          const w3 = su * v;
          const x = (ax * w1 + bx * w2 + cx * w3 - centerX) * scale;
          const y = (ay * w1 + by * w2 + cy * w3 - centerY) * scale;
          const z = (az * w1 + bz * w2 + cz * w3 - centerZ) * scale;
          this.basePositions[i * 3] = x;
          this.basePositions[i * 3 + 1] = y;
          this.basePositions[i * 3 + 2] = z;
        }
      }

      private resetEmitter(): void {
        if (!this.points) return;
        const hide = 1e6;
        for (let i = 0; i < this.positions.length; i += 3) {
          this.positions[i] = hide;
          this.positions[i + 1] = hide;
          this.positions[i + 2] = hide;
        }
        this.velocities.fill(0);
        this.life.fill(0);
        this.colors.fill(0);
        this.sizeFactors.fill(0);
        this.alive = 0;
        this.emitRemainder = 0;
        this.pendingBurst = this.cfg.emitBurst;
        this.points.geometry.attributes.position.needsUpdate = true;
        this.points.geometry.attributes.color.needsUpdate = true;
        this.points.geometry.attributes.sizeFactor.needsUpdate = true;
      }

      private normalize(vec: [number, number, number]): [number, number, number] {
        const len = Math.sqrt(vec[0] * vec[0] + vec[1] * vec[1] + vec[2] * vec[2]) || 1;
        return [vec[0] / len, vec[1] / len, vec[2] / len];
      }

      private isVec3Equal(a: [number, number, number], b: [number, number, number]): boolean {
        return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
      }

      private randomInSphere(radius: number): [number, number, number] {
        const u = this.rng();
        const v = this.rng();
        const theta = u * Math.PI * 2;
        const phi = Math.acos(2 * v - 1);
        const r = Math.cbrt(this.rng()) * radius;
        return [
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.sin(phi) * Math.sin(theta),
          r * Math.cos(phi),
        ];
      }

      private randomInBox(size: number): [number, number, number] {
        const half = size * 0.5;
        return [
          (this.rng() * 2 - 1) * half,
          (this.rng() * 2 - 1) * half,
          (this.rng() * 2 - 1) * half,
        ];
      }
    }

    return new ParticleSystem(config) as unknown as I3DParticleSystem;
  }

  simplifyGeometry(geometry: I3DGeometry, quality: number): I3DGeometry | null {
    const Modifier = (this.THREE as any)?.SimplifyModifier;
    if (!Modifier) return null;
    const anyGeom: any = geometry as any;
    const count = anyGeom?.attributes?.position?.count;
    if (!Number.isFinite(count)) return null;
    const clamped = Math.max(0.05, Math.min(1, quality));
    const target = Math.max(3, Math.floor(count * clamped));
    if (target >= count) return geometry;
    try {
      const modifier = new Modifier();
      return modifier.modify(anyGeom, target);
    } catch {
      return null;
    }
  }

  degToRad(degrees: number): number {
    return this.THREE.MathUtils.degToRad(degrees);
  }

  radToDeg(radians: number): number {
    return this.THREE.MathUtils.radToDeg(radians);
  }

  computeBoundingBoxRecursively(object: I3DObject): I3DBox3 {
    const boundingBox = new this.THREE.Box3();
    let hasBox = false;

    if (object.traverse) {
      object.traverse((child: any) => {
        if (!child.visible) return;
        if (child.geometry) {
          if (typeof child.geometry.computeBoundingBox === "function") {
            child.geometry.computeBoundingBox();
          }
          const box = child.geometry.boundingBox;
          if (box) {
            const childBox = box.clone().applyMatrix4(child.matrixWorld);
            boundingBox.union(childBox);
            hasBox = true;
          }
        }
      });
    }

    return hasBox ? boundingBox : new this.THREE.Box3();
  }
}

export class ThreeJSProvider implements I3DEngineProvider {
  private engine: ThreeJSEngine;

  constructor(THREE: any, loaders: Record<string, any> = {}) {
    this.engine = new ThreeJSEngine(THREE, loaders);
  }

  getEngine(): I3DEngine {
    return this.engine;
  }

  getName(): string {
    return "Three.js";
  }
}
