export class StyleReader {
  private styleMap: any;
  private style: CSSStyleDeclaration;

  constructor(el: HTMLElement) {
    this.styleMap = (el as any).computedStyleMap?.();
    this.style = getComputedStyle(el);
  }

  readNumber(prop: string, fallback: number): number {
    const mapValue = this.styleMap?.get?.(prop);
    if (mapValue !== undefined && mapValue !== null) {
      const val = typeof mapValue === "object" ? (mapValue as any).value : mapValue;
      const num = typeof val === "number" ? val : Number.parseFloat(val);
      if (!Number.isNaN(num)) return num;
    }
    const num = Number.parseFloat(this.style.getPropertyValue(prop));
    return Number.isNaN(num) ? fallback : num;
  }

  readString(prop: string, fallback = ""): string {
    const mapValue = this.styleMap?.get?.(prop);
    const val = mapValue && typeof mapValue === "object" ? (mapValue as any).value : mapValue;
    if (typeof val === "string") return this.stripQuotes(val.trim()) || fallback;
    const raw = this.style.getPropertyValue(prop).trim();
    return this.stripQuotes(raw) || fallback;
  }

  private stripQuotes(value: string): string {
    if (
      (value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith('"') && value.endsWith('"'))
    ) {
      return value.slice(1, -1);
    }
    return value;
  }

  readBoolean(prop: string, fallback = false): boolean {
    const raw = this.readString(prop, "");
    if (!raw) return fallback;
    const norm = raw.toLowerCase();
    return norm === "true" || norm === "1" || norm === "yes"
      ? true
      : norm === "false" || norm === "0" || norm === "no"
      ? false
      : fallback;
  }
}

export function readNumberStyle(el: HTMLElement, prop: string, fallback: number): number {
  const styleMap = (el as any).computedStyleMap?.();
  const mapValue = styleMap?.get?.(prop);
  if (mapValue !== undefined) {
    if (typeof mapValue === "number") return mapValue;
    if (typeof mapValue === "string") {
      const parsed = Number.parseFloat(mapValue);
      if (!Number.isNaN(parsed)) return parsed;
    }
    if (mapValue && typeof mapValue === "object") {
      const value = (mapValue as any).value;
      if (typeof value === "number") return value;
      if (typeof value === "string") {
        const parsed = Number.parseFloat(value);
        if (!Number.isNaN(parsed)) return parsed;
      }
    }
  }

  const style = getComputedStyle(el);
  const raw = style.getPropertyValue(prop);
  const parsed = Number.parseFloat(raw);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function stripQuotes(value: string): string {
  if (
    (value.startsWith("'") && value.endsWith("'")) ||
    (value.startsWith('"') && value.endsWith('"'))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

export function readStringStyle(el: HTMLElement, prop: string, fallback = ""): string {
  const styleMap = (el as any).computedStyleMap?.();
  const mapValue = styleMap?.get?.(prop);
  if (typeof mapValue === "string") {
    return stripQuotes(mapValue.trim());
  }
  if (mapValue && typeof mapValue === "object") {
    const value = (mapValue as any).value;
    if (typeof value === "string") {
      return stripQuotes(value.trim());
    }
  }
  const style = getComputedStyle(el).getPropertyValue(prop);
  const result = style ? stripQuotes(style.trim()) : "";
  return result || fallback;
}

export function readBooleanStyle(el: HTMLElement, prop: string, fallback = false): boolean {
  const raw = readStringStyle(el, prop, "");
  if (!raw) return fallback;
  const normalized = raw.toLowerCase().trim();
  if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
  if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  return fallback;
}

export function readFilterRaw(el: HTMLElement): string {
  const styleMap = (el as any).computedStyleMap?.();
  let raw = "";
  const mapValue = styleMap?.get?.("--filter");
  if (mapValue !== undefined) {
    if (typeof mapValue === "string") {
      raw = mapValue;
    } else if (mapValue && typeof mapValue === "object") {
      const value = (mapValue as any).value;
      if (typeof value === "string") raw = value;
    }
  }
  if (!raw) {
    raw = getComputedStyle(el).getPropertyValue("--filter") || "";
  }
  raw = raw.trim();
  return raw;
}
