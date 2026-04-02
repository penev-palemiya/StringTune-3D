export interface SVGTransformMatrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

export interface ParsedSVGPath {
  d: string;
  transform: SVGTransformMatrix | null;
}

export interface ParsedSVGData {
  paths: ParsedSVGPath[];
  viewBox: { x: number; y: number; width: number; height: number } | null;
  naturalWidth: number;
  naturalHeight: number;
}

interface SVGRenderState {
  displayNone: boolean;
  visibilityHidden: boolean;
  opacity: number;
  fill: string;
  fillOpacity: number;
}

const IDENTITY: SVGTransformMatrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
const DEFAULT_RENDER_STATE: SVGRenderState = {
  displayNone: false,
  visibilityHidden: false,
  opacity: 1,
  fill: "#000",
  fillOpacity: 1,
};

function isIdentity(m: SVGTransformMatrix): boolean {
  return m.a === 1 && m.b === 0 && m.c === 0 && m.d === 1 && m.e === 0 && m.f === 0;
}

function multiplyMatrices(m1: SVGTransformMatrix, m2: SVGTransformMatrix): SVGTransformMatrix {
  return {
    a: m1.a * m2.a + m1.c * m2.b,
    b: m1.b * m2.a + m1.d * m2.b,
    c: m1.a * m2.c + m1.c * m2.d,
    d: m1.b * m2.c + m1.d * m2.d,
    e: m1.a * m2.e + m1.c * m2.f + m1.e,
    f: m1.b * m2.e + m1.d * m2.f + m1.f,
  };
}

function parseTransformAttribute(transform: string): SVGTransformMatrix {
  let result: SVGTransformMatrix = { ...IDENTITY };
  const parts = transform.match(/(\w+)\s*\(([^)]*)\)/g) || [];

  for (const part of parts) {
    const match = part.match(/(\w+)\s*\(([^)]*)\)/);
    if (!match) continue;
    const type = match[1];
    const args = match[2]
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    let mat: SVGTransformMatrix = { ...IDENTITY };

    switch (type) {
      case "translate":
        mat = { a: 1, b: 0, c: 0, d: 1, e: args[0] || 0, f: args[1] || 0 };
        break;
      case "scale": {
        const sx = args[0] ?? 1;
        const sy = args[1] ?? sx;
        mat = { a: sx, b: 0, c: 0, d: sy, e: 0, f: 0 };
        break;
      }
      case "rotate": {
        const angle = ((args[0] || 0) * Math.PI) / 180;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const cx = args[1] || 0;
        const cy = args[2] || 0;
        mat = {
          a: cos,
          b: sin,
          c: -sin,
          d: cos,
          e: cx - cos * cx + sin * cy,
          f: cy - sin * cx - cos * cy,
        };
        break;
      }
      case "matrix":
        if (args.length >= 6) {
          mat = { a: args[0], b: args[1], c: args[2], d: args[3], e: args[4], f: args[5] };
        }
        break;
      case "skewX": {
        const angle = ((args[0] || 0) * Math.PI) / 180;
        mat = { a: 1, b: 0, c: Math.tan(angle), d: 1, e: 0, f: 0 };
        break;
      }
      case "skewY": {
        const angle = ((args[0] || 0) * Math.PI) / 180;
        mat = { a: 1, b: Math.tan(angle), c: 0, d: 1, e: 0, f: 0 };
        break;
      }
    }

    result = multiplyMatrices(result, mat);
  }

  return result;
}

function getElementTransformMatrix(el: Element): SVGTransformMatrix {
  const transform = el.getAttribute("transform");
  if (!transform) return { ...IDENTITY };
  return parseTransformAttribute(transform);
}

function parseStyleAttribute(style: string | null): Map<string, string> {
  const entries = new Map<string, string>();
  if (!style) return entries;

  for (const chunk of style.split(";")) {
    const colonIndex = chunk.indexOf(":");
    if (colonIndex === -1) continue;
    const key = chunk.slice(0, colonIndex).trim().toLowerCase();
    const value = chunk.slice(colonIndex + 1).trim();
    if (key) entries.set(key, value);
  }

  return entries;
}

function getPresentationValue(el: Element, name: string): string | null {
  const styleValue = parseStyleAttribute(el.getAttribute("style")).get(name);
  if (styleValue != null && styleValue !== "") return styleValue;
  const attrValue = el.getAttribute(name);
  return attrValue != null && attrValue !== "" ? attrValue : null;
}

function parseNumericValue(value: string | null, fallback: number): number {
  if (value == null) return fallback;
  const normalized = value.trim();
  if (!normalized) return fallback;
  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function computeRenderState(el: Element, parentState: SVGRenderState): SVGRenderState {
  const display = (getPresentationValue(el, "display") || "").trim().toLowerCase();
  const visibility = (getPresentationValue(el, "visibility") || "").trim().toLowerCase();
  const opacity = parseNumericValue(getPresentationValue(el, "opacity"), 1);
  const fill = getPresentationValue(el, "fill") ?? parentState.fill;
  const fillOpacity = parseNumericValue(
    getPresentationValue(el, "fill-opacity"),
    parentState.fillOpacity,
  );

  return {
    displayNone: parentState.displayNone || display === "none",
    visibilityHidden:
      parentState.visibilityHidden || visibility === "hidden" || visibility === "collapse",
    opacity: parentState.opacity * Math.max(0, opacity),
    fill,
    fillOpacity: Math.max(0, fillOpacity),
  };
}

function shouldCollectGeometry(
  tag: string,
  d: string | null,
  renderState: SVGRenderState,
): d is string {
  if (!d || !d.trim()) return false;
  if (tag === "g" || tag === "svg" || tag === "symbol" || tag === "a") return false;
  if (renderState.displayNone || renderState.visibilityHidden) return false;
  if (renderState.opacity <= 0 || renderState.fillOpacity <= 0) return false;
  return renderState.fill.trim().toLowerCase() !== "none";
}

function rectToPath(el: Element): string {
  const x = parseFloat(el.getAttribute("x") || "0");
  const y = parseFloat(el.getAttribute("y") || "0");
  const w = parseFloat(el.getAttribute("width") || "0");
  const h = parseFloat(el.getAttribute("height") || "0");
  if (w <= 0 || h <= 0) return "";

  const rxRaw = parseFloat(el.getAttribute("rx") || "");
  const ryRaw = parseFloat(el.getAttribute("ry") || "");
  const rx = isNaN(rxRaw) ? (isNaN(ryRaw) ? 0 : ryRaw) : rxRaw;
  const ry = isNaN(ryRaw) ? rx : ryRaw;

  if (rx <= 0 && ry <= 0) {
    return `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;
  }

  const rx2 = Math.min(rx, w / 2);
  const ry2 = Math.min(ry, h / 2);
  return [
    `M ${x + rx2} ${y}`,
    `H ${x + w - rx2}`,
    `A ${rx2} ${ry2} 0 0 1 ${x + w} ${y + ry2}`,
    `V ${y + h - ry2}`,
    `A ${rx2} ${ry2} 0 0 1 ${x + w - rx2} ${y + h}`,
    `H ${x + rx2}`,
    `A ${rx2} ${ry2} 0 0 1 ${x} ${y + h - ry2}`,
    `V ${y + ry2}`,
    `A ${rx2} ${ry2} 0 0 1 ${x + rx2} ${y}`,
    "Z",
  ].join(" ");
}

function circleToPath(el: Element): string {
  const cx = parseFloat(el.getAttribute("cx") || "0");
  const cy = parseFloat(el.getAttribute("cy") || "0");
  const r = parseFloat(el.getAttribute("r") || "0");
  if (r <= 0) return "";
  return `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy} A ${r} ${r} 0 0 1 ${cx - r} ${cy} Z`;
}

function ellipseToPath(el: Element): string {
  const cx = parseFloat(el.getAttribute("cx") || "0");
  const cy = parseFloat(el.getAttribute("cy") || "0");
  const rx = parseFloat(el.getAttribute("rx") || "0");
  const ry = parseFloat(el.getAttribute("ry") || "0");
  if (rx <= 0 || ry <= 0) return "";
  return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 0 1 ${cx + rx} ${cy} A ${rx} ${ry} 0 0 1 ${cx - rx} ${cy} Z`;
}

function polygonToPath(el: Element, close: boolean): string {
  const points = (el.getAttribute("points") || "").trim();
  if (!points) return "";
  const coords = points.split(/[\s,]+/).filter(Boolean);
  const pairs: string[] = [];
  for (let i = 0; i + 1 < coords.length; i += 2) {
    pairs.push(`${i === 0 ? "M" : "L"} ${coords[i]} ${coords[i + 1]}`);
  }
  return pairs.join(" ") + (close ? " Z" : "");
}

function lineToPath(el: Element): string {
  const x1 = el.getAttribute("x1") || "0";
  const y1 = el.getAttribute("y1") || "0";
  const x2 = el.getAttribute("x2") || "0";
  const y2 = el.getAttribute("y2") || "0";
  return `M ${x1} ${y1} L ${x2} ${y2}`;
}

function elementToPathD(el: Element): string | null {
  const tag = el.tagName.toLowerCase().replace(/^svg:/, "");
  switch (tag) {
    case "path":
      return el.getAttribute("d");
    case "rect":
      return rectToPath(el);
    case "circle":
      return circleToPath(el);
    case "ellipse":
      return ellipseToPath(el);
    case "polygon":
      return polygonToPath(el, true);
    case "polyline":
      return polygonToPath(el, false);
    case "line":
      return lineToPath(el);
    default:
      return null;
  }
}

function walkElement(
  el: Element,
  parentMatrix: SVGTransformMatrix,
  parentState: SVGRenderState,
  paths: ParsedSVGPath[],
): void {
  const tag = el.tagName.toLowerCase().replace(/^svg:/, "");

  if (tag === "defs" || tag === "title" || tag === "desc" || tag === "style" || tag === "script") {
    return;
  }

  const localMatrix = getElementTransformMatrix(el);
  const accumulated = isIdentity(localMatrix)
    ? parentMatrix
    : multiplyMatrices(parentMatrix, localMatrix);
  const renderState = computeRenderState(el, parentState);

  const d = elementToPathD(el);
  if (shouldCollectGeometry(tag, d, renderState)) {
    const pathData = d.trim();
    paths.push({
      d: pathData,
      transform: isIdentity(accumulated) ? null : accumulated,
    });
  }

  if (tag === "g" || tag === "svg" || tag === "symbol" || tag === "a" || d === null) {
    for (const child of Array.from(el.children)) {
      walkElement(child, accumulated, renderState, paths);
    }
  }
}

function parseViewBox(
  svgEl: Element,
): { x: number; y: number; width: number; height: number } | null {
  const vb = svgEl.getAttribute("viewBox");
  if (vb) {
    const parts = vb
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (parts.length >= 4 && parts[2] > 0 && parts[3] > 0) {
      return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
    }
  }
  const w = parseFloat(svgEl.getAttribute("width") || "0");
  const h = parseFloat(svgEl.getAttribute("height") || "0");
  if (w > 0 && h > 0) {
    return { x: 0, y: 0, width: w, height: h };
  }
  return null;
}

export class SVGParser {
  static fromElement(svgEl: SVGSVGElement): ParsedSVGData {
    const viewBox = parseViewBox(svgEl);
    const naturalWidth = viewBox?.width || parseFloat(svgEl.getAttribute("width") || "0") || 100;
    const naturalHeight = viewBox?.height || parseFloat(svgEl.getAttribute("height") || "0") || 100;

    const paths: ParsedSVGPath[] = [];

    for (const child of Array.from(svgEl.children)) {
      walkElement(child, { ...IDENTITY }, computeRenderState(svgEl, DEFAULT_RENDER_STATE), paths);
    }

    return { paths, viewBox, naturalWidth, naturalHeight };
  }

  static fromString(svgString: string): ParsedSVGData | null {
    if (typeof DOMParser === "undefined") return null;
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString.trim(), "image/svg+xml");
    const parseError = doc.querySelector("parsererror");
    if (parseError) return null;
    const svgEl = doc.querySelector("svg");
    if (!svgEl) return null;
    return SVGParser.fromElement(svgEl as SVGSVGElement);
  }
}
