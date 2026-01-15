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

    const isFontFile = FontConverter.isFontFile(normalized);

    let promise: Promise<any>;

    if (isFontFile) {
      promise = this.loadFontWithConverter(normalized);
    } else {
      promise = this.loadFontWithLoader(normalized);
    }

    this.fontPromiseCache.set(normalized, promise);
    return promise;
  }

  private async loadFontWithConverter(url: string): Promise<any> {
    try {
      const fontData = await FontConverter.load(url);
      const font = this.createFontFromData(fontData);
      this.fontCache.set(url, font);
      return font;
    } catch (error) {
      return null;
    }
  }

  private loadFontWithLoader(url: string): Promise<any> {
    const LoaderClass = this.loaders.font || this.loaders.FontLoader;
    if (!LoaderClass) {
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
        () => {
          resolve(null);
        }
      );
    });
  }

  private createFontFromData(fontData: any): any {
    const LoaderClass = this.loaders.font || this.loaders.FontLoader;
    if (LoaderClass && LoaderClass.utils && LoaderClass.utils.convert) {
      const loader = new LoaderClass();
      if (loader.parse) {
        return loader.parse(fontData);
      }
    }

    const font = {
      data: fontData,
      isFont: true,
      generateShapes: (text: string, size: number) => {
        return this.generateShapesFromFontData(fontData, text, size, false);
      },
      generateNormalizedShapes: (text: string, size: number) => {
        return this.generateShapesFromFontData(fontData, text, size, true);
      },
    };
    return font;
  }

  private generateShapesFromFontData(
    fontData: any,
    text: string,
    size: number,
    normalizePosition: boolean = false
  ): any[] {
    const shapes: any[] = [];
    const scale = size / fontData.resolution;

    const char = text[0];
    if (!char) return shapes;

    const glyph = fontData.glyphs[char];
    if (!glyph || !glyph.o) return shapes;

    let xOffset = 0;
    if (normalizePosition) {
      const xMin = this.getOutlineXMin(glyph.o);
      xOffset = -xMin * scale;
    }

    const charShapes = this.parseOutlineToShapes(glyph.o, scale, xOffset, fontData?.outlineFormat);
    shapes.push(...charShapes);

    return shapes;
  }

  private getOutlineXMin(outline: string): number {
    const commands = outline.split(" ");
    let minX = Infinity;
    let i = 0;

    while (i < commands.length) {
      const cmd = commands[i];
      switch (cmd) {
        case "m":
        case "l":
          minX = Math.min(minX, parseFloat(commands[i + 1]) || 0);
          i += 3;
          break;
        case "q":
          minX = Math.min(minX, parseFloat(commands[i + 1]) || 0);
          minX = Math.min(minX, parseFloat(commands[i + 3]) || 0);
          i += 5;
          break;
        case "b":
          minX = Math.min(minX, parseFloat(commands[i + 1]) || 0);
          minX = Math.min(minX, parseFloat(commands[i + 3]) || 0);
          minX = Math.min(minX, parseFloat(commands[i + 5]) || 0);
          i += 7;
          break;
        default:
          i++;
          break;
      }
    }

    return minX === Infinity ? 0 : minX;
  }

  private getOutlineXMax(outline: string): number {
    const commands = outline.split(" ");
    let maxX = -Infinity;
    let i = 0;

    while (i < commands.length) {
      const cmd = commands[i];
      switch (cmd) {
        case "m":
        case "l":
          maxX = Math.max(maxX, parseFloat(commands[i + 1]) || 0);
          i += 3;
          break;
        case "q":
          maxX = Math.max(maxX, parseFloat(commands[i + 1]) || 0);
          maxX = Math.max(maxX, parseFloat(commands[i + 3]) || 0);
          i += 5;
          break;
        case "b":
          maxX = Math.max(maxX, parseFloat(commands[i + 1]) || 0);
          maxX = Math.max(maxX, parseFloat(commands[i + 3]) || 0);
          maxX = Math.max(maxX, parseFloat(commands[i + 5]) || 0);
          i += 7;
          break;
        default:
          i++;
          break;
      }
    }

    return maxX === -Infinity ? 0 : maxX;
  }

  private getOutlineYMin(outline: string): number {
    const commands = outline.split(" ");
    let minY = Infinity;
    let i = 0;

    while (i < commands.length) {
      const cmd = commands[i];
      switch (cmd) {
        case "m":
        case "l":
          minY = Math.min(minY, parseFloat(commands[i + 2]) || 0);
          i += 3;
          break;
        case "q":
          minY = Math.min(minY, parseFloat(commands[i + 2]) || 0);
          minY = Math.min(minY, parseFloat(commands[i + 4]) || 0);
          i += 5;
          break;
        case "b":
          minY = Math.min(minY, parseFloat(commands[i + 2]) || 0);
          minY = Math.min(minY, parseFloat(commands[i + 4]) || 0);
          minY = Math.min(minY, parseFloat(commands[i + 6]) || 0);
          i += 7;
          break;
        default:
          i++;
          break;
      }
    }

    return minY === Infinity ? 0 : minY;
  }

  private pointInPolygon(
    px: number,
    py: number,
    polygon: Array<{ x: number; y: number }>
  ): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x;
      const yi = polygon[i].y;
      const xj = polygon[j].x;
      const yj = polygon[j].y;

      if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
    return inside;
  }

  private samplePathPoints(path: any, numSamples: number = 80): Array<{ x: number; y: number }> {
    if (!path?.getPoints) return [];
    return path.getPoints(numSamples).map((p: any) => ({ x: p.x, y: p.y }));
  }

  private getBoundingBox(points: Array<{ x: number; y: number }>): {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    area: number;
  } {
    if (points.length === 0) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0, area: 0 };
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    return { minX, maxX, minY, maxY, area: (maxX - minX) * (maxY - minY) };
  }

  private getInteriorPoint(points: Array<{ x: number; y: number }>): { x: number; y: number } {
    if (points.length < 3) return points[0] || { x: 0, y: 0 };
    const contour = points.map((p) => new this.THREE.Vector2(p.x, p.y));
    const triangles = this.THREE.ShapeUtils.triangulateShape(contour, []);
    for (const tri of triangles) {
      const a = contour[tri[0]];
      const b = contour[tri[1]];
      const c = contour[tri[2]];
      const cx = (a.x + b.x + c.x) / 3;
      const cy = (a.y + b.y + c.y) / 3;
      if (this.pointInPolygon(cx, cy, points)) {
        return { x: cx, y: cy };
      }
    }
    return points[0];
  }

  private parseOutlineToShapes(
    outline: string,
    scale: number,
    offsetX: number = 0,
    outlineFormat?: string
  ): any[] {
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
            } else if (
              shapePath.currentPath &&
              typeof shapePath.currentPath.closePath === "function"
            ) {
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

    const subPaths = shapePath.subPaths;
    if (!subPaths || subPaths.length === 0) return [];

    const paths = subPaths.map((sp: any) => {
      const points = sp.getPoints();
      const area = this.THREE.ShapeUtils.area(points);
      const bbox = this.getBoundingBox(points.map((p: any) => ({ x: p.x, y: p.y })));
      return {
        path: sp,
        points,
        area: Math.abs(area),
        signedArea: area,
        bbox,
      };
    });

    paths.sort((a: any, b: any) => b.area - a.area);

    const finalShapes: any[] = [];
    const used = new Set<number>();

    for (let i = 0; i < paths.length; i++) {
      if (used.has(i)) continue;

      const outerPath = paths[i];
      const shape = new this.THREE.Shape(outerPath.points);
      used.add(i);

      for (let j = 0; j < paths.length; j++) {
        if (used.has(j) || i === j) continue;

        const innerPath = paths[j];

        if (
          innerPath.bbox.minX < outerPath.bbox.minX ||
          innerPath.bbox.maxX > outerPath.bbox.maxX ||
          innerPath.bbox.minY < outerPath.bbox.minY ||
          innerPath.bbox.maxY > outerPath.bbox.maxY
        ) {
          continue;
        }

        let allPointsInside = true;
        const testPoints = [
          innerPath.points[0],
          innerPath.points[Math.floor(innerPath.points.length / 2)],
        ];

        for (const testPoint of testPoints) {
          if (
            !testPoint ||
            !this.pointInPolygon(
              testPoint.x,
              testPoint.y,
              outerPath.points.map((p: any) => ({ x: p.x, y: p.y }))
            )
          ) {
            allPointsInside = false;
            break;
          }
        }

        if (allPointsInside) {
          shape.holes.push(new this.THREE.Path(innerPath.points));
          used.add(j);
        }
      }

      finalShapes.push(shape);
    }

    return finalShapes.length > 0 ? finalShapes : shapePath.toShapes(true);
  }

  private reversePath(path: any): any {
    const newPath = new this.THREE.Path();
    if (!path.curves || path.curves.length === 0) return newPath;

    const lastCurve = path.curves[path.curves.length - 1];
    const endPoint =
      lastCurve.v2 || lastCurve.v3 || (lastCurve.getPoint ? lastCurve.getPoint(1) : null);
    if (endPoint) {
      newPath.moveTo(endPoint.x, endPoint.y);
    }

    for (let i = path.curves.length - 1; i >= 0; i--) {
      const curve = path.curves[i];
      if (curve.isLineCurve || curve.type === "LineCurve" || curve.type === "LineCurve3") {
        newPath.lineTo(curve.v1.x, curve.v1.y);
      } else if (
        curve.isQuadraticBezierCurve ||
        curve.type === "QuadraticBezierCurve" ||
        curve.type === "QuadraticBezierCurve3"
      ) {
        newPath.quadraticCurveTo(curve.v1.x, curve.v1.y, curve.v0.x, curve.v0.y);
      } else if (
        curve.isCubicBezierCurve ||
        curve.type === "CubicBezierCurve" ||
        curve.type === "CubicBezierCurve3"
      ) {
        newPath.bezierCurveTo(
          curve.v2.x,
          curve.v2.y,
          curve.v1.x,
          curve.v1.y,
          curve.v0.x,
          curve.v0.y
        );
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

    const lines = String(text).split(/\r?\n/);
    const shapes: any[] = [];

    const fontData = font?.data;
    const resolution = fontData?.resolution || 1000;
    if (options.layout && options.layout.length > 0) {
      const fontAscender = fontData?.ascender || resolution * 0.8;
      const fontDescender = fontData?.descender || -resolution * 0.2;
      const fontEmHeight = fontAscender - fontDescender;
      const baselineRatio = fontAscender / fontEmHeight;

      const elementWidth = options.elementWidth || 0;
      const elementHeight = options.elementHeight || 0;
      const centerOffsetX = 0;
      const centerOffsetY = 0;

      options.layout.forEach((item: any) => {
        const charShapes = font.generateShapes(item.char, size);

        const offsetX = item.x + centerOffsetX;

        const charHeight = item.height || size;
        const baselineFromTop = charHeight * baselineRatio;
        const offsetY = -(item.y + centerOffsetY) - baselineFromTop;

        charShapes.forEach((shape: any) => {
          let finalShape = this.translateShape(shape, offsetX, offsetY);
          if (item.scale && item.scale !== 1) {
            finalShape = this.scaleShape(finalShape, item.scale);
          }
          shapes.push(finalShape);
        });
      });
    } else {
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

    chars.forEach((char, index) => {
      const charShapes = font.generateShapes(char, size);
      charShapes.forEach((shape: any) => {
        const translated = this.translateShape(shape, x, 0);
        shapes.push(translated);
      });
      const advance = this.getGlyphAdvance(font, char, size);

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
    if (typeof shape.applyMatrix4 === "function") {
      const matrix = new this.THREE.Matrix4().makeScale(s, s, 1);
      shape.applyMatrix4(matrix);
      return shape;
    }

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
        () => {
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
      private transitionStartTime = 0;
      private transitionDuration = 0;
      private isTransitioning = false;
      private transitionFromPositions: Float32Array = new Float32Array(0);
      private transitionToPositions: Float32Array = new Float32Array(0);
      private pendingTransition = false;
      private pendingTransitionKey = "";
      private pendingDistributionLoad = false;

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
          const isParticleModelChange =
            this.cfg.mode === "instanced" &&
            this.instanced &&
            this.cfg.modelTransitionDuration > 0 &&
            (prev.particleModelUrl !== this.cfg.particleModelUrl ||
              prev.particleModelLoader !== this.cfg.particleModelLoader ||
              prev.particleModelNode !== this.cfg.particleModelNode ||
              prev.particleShape !== this.cfg.particleShape);

          const isInstanceModelChange =
            this.cfg.mode === "instanced" &&
            this.instanced &&
            this.cfg.modelTransitionDuration > 0 &&
            (prev.instanceModelUrl !== this.cfg.instanceModelUrl ||
              prev.instanceModelLoader !== this.cfg.instanceModelLoader ||
              prev.instanceModelNode !== this.cfg.instanceModelNode ||
              prev.instanceShape !== this.cfg.instanceShape);

          if (isParticleModelChange || isInstanceModelChange) {
            this.startModelTransition();
          } else {
            this.refreshModelGeometry();
            this.refreshDistributionGeometry();
            this.rebuild();
          }
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

      private startModelTransition(): void {
        this.transitionFromPositions = new Float32Array(this.basePositions);
        this.transitionDuration = this.cfg.modelTransitionDuration;

        const url = this.cfg.instanceModelUrl?.trim();
        const key = `${this.cfg.instanceModelLoader}|${url}|${this.cfg.instanceModelNode}`;
        this.pendingTransition = true;
        this.pendingTransitionKey = key;

        this.refreshModelGeometry();
        this.refreshDistributionGeometryForTransition();
      }

      private refreshDistributionGeometryForTransition(): void {
        if (this.cfg.instanceShape !== "model") {
          this.startMorphTransition();
          return;
        }
        const url = this.cfg.instanceModelUrl?.trim();
        if (!url || url === "none") {
          this.startMorphTransition();
          return;
        }
        const key = `${this.cfg.instanceModelLoader}|${url}|${this.cfg.instanceModelNode}`;

        if (this.distributionKey === key && this.distributionGeometry) {
          this.startMorphTransition();
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
            if (!this.pendingTransition || this.pendingTransitionKey !== key) return;

            this.distributionGeometry = geometry;
            this.startMorphTransition();
          });
      }

      private startMorphTransition(): void {
        this.pendingTransition = false;
        this.pendingTransitionKey = "";

        const count = Math.max(1, this.cfg.count);
        this.transitionToPositions = new Float32Array(count * 3);

        const useModel = this.cfg.instanceShape === "model" && this.distributionGeometry;
        if (useModel) {
          this.fillFromModelToArray(count, this.distributionGeometry, this.transitionToPositions);
        } else {
          for (let i = 0; i < count; i += 1) {
            const pos =
              this.cfg.instanceShape === "box"
                ? this.randomInBox(this.cfg.spread)
                : this.randomInSphere(this.cfg.spread);
            this.transitionToPositions.set(pos, i * 3);
          }
        }

        this.transitionStartTime = this.elapsed;
        this.isTransitioning = true;
      }

      private cleanupOutgoing(): void {
        this.isTransitioning = false;
        this.pendingTransition = false;
        this.pendingTransitionKey = "";
        this.transitionFromPositions = new Float32Array(0);
        this.transitionToPositions = new Float32Array(0);
      }

      private updateTransition(): void {
        if (!this.isTransitioning) return;

        const elapsed = this.elapsed - this.transitionStartTime;
        const progress = Math.min(1, elapsed / this.transitionDuration);

        const eased =
          progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        const count = Math.min(
          this.transitionFromPositions.length / 3,
          this.transitionToPositions.length / 3,
          this.basePositions.length / 3
        );

        for (let i = 0; i < count; i += 1) {
          const i3 = i * 3;
          this.basePositions[i3] =
            this.transitionFromPositions[i3] +
            (this.transitionToPositions[i3] - this.transitionFromPositions[i3]) * eased;
          this.basePositions[i3 + 1] =
            this.transitionFromPositions[i3 + 1] +
            (this.transitionToPositions[i3 + 1] - this.transitionFromPositions[i3 + 1]) * eased;
          this.basePositions[i3 + 2] =
            this.transitionFromPositions[i3 + 2] +
            (this.transitionToPositions[i3 + 2] - this.transitionFromPositions[i3 + 2]) * eased;
        }

        if (progress >= 1) {
          for (let i = 0; i < count * 3; i += 1) {
            this.basePositions[i] = this.transitionToPositions[i];
          }
          this.cleanupOutgoing();
        }
      }

      private fillFromModelToArray(count: number, geometry: any, targetArray: Float32Array): void {
        const attr = geometry?.attributes?.position;
        if (!attr?.array || attr.itemSize < 3) {
          for (let i = 0; i < count; i += 1) {
            const pos = this.randomInSphere(this.cfg.spread);
            targetArray.set(pos, i * 3);
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
        const targetX = (this.cfg.spreadX > 0 ? this.cfg.spreadX : this.cfg.spread) * 2;
        const targetY = (this.cfg.spreadY > 0 ? this.cfg.spreadY : this.cfg.spread) * 2;
        const scaleX = targetX > 0 ? targetX / sizeX : 1;
        const scaleY = targetY > 0 ? targetY / sizeY : 1;
        const scale = Math.min(scaleX, scaleY);
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
            targetArray.set(pos, i * 3);
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
          targetArray[i * 3] = x;
          targetArray[i * 3 + 1] = y;
          targetArray[i * 3 + 2] = z;
        }
      }

      update(dt: number): void {
        if (dt <= 0) return;
        this.elapsed += dt;

        this.updateTransition();

        if (this.cfg.mode === "emitter") {
          this.updateEmitter(dt);
        } else {
          this.updateInstanced(this.elapsed);
        }
      }

      dispose(): void {
        this.cleanupOutgoing();
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
          const needsModel = this.cfg.instanceShape === "model";
          const hasModel = this.distributionGeometry !== null;
          if (needsModel && !hasModel) {
            this.pendingDistributionLoad = true;
            this.refreshDistributionGeometry();
            return;
          }
          this.pendingDistributionLoad = false;
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
              if (this.pendingDistributionLoad) {
                this.pendingDistributionLoad = false;
                this.buildInstanced();
                this.applyMaterialOverrides();
              } else {
                this.rebuild();
              }
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
        const targetX = (this.cfg.spreadX > 0 ? this.cfg.spreadX : this.cfg.spread) * 2;
        const targetY = (this.cfg.spreadY > 0 ? this.cfg.spreadY : this.cfg.spread) * 2;
        const scaleX = targetX > 0 ? targetX / sizeX : 1;
        const scaleY = targetY > 0 ? targetY / sizeY : 1;
        const scale = Math.min(scaleX, scaleY);
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
