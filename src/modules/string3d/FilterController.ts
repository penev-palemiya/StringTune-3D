import { String3DObject } from "../../core/String3DObject";
import { String3DCustomFilterRegistry } from "../../core/filters/String3DCustomFilter";
import {
  String3DFilterChain,
  String3DFilterEffect,
  String3DFilterTarget,
} from "../../core/filters/String3DFilterTypes";
import { readFilterRaw } from "./styleUtils";

type FilterTransitionState = {
  raw: string;
  effects: String3DFilterChain;
  animating: boolean;
  from: String3DFilterChain;
  to: String3DFilterChain;
  startTime: number;
  duration: number;
  easing: (t: number) => number;
  clearOnComplete: boolean;
  lastDuration: number;
  lastDelay: number;
  lastEasing: (t: number) => number;
  pendingRaw?: string;
  pendingEffects?: String3DFilterChain;
  effectsKey?: string;
};

export class FilterController {
  private filterStates: WeakMap<HTMLElement, FilterTransitionState> = new WeakMap();
  private filterWarnings: WeakMap<HTMLElement, string> = new WeakMap();

  constructor(private easingParser?: (value: string) => (t: number) => number) {}

  collectTargets(
    rootObjects: String3DObject[],
    now: number,
    useDirtySync: boolean,
    dirtySet: Set<HTMLElement> | null
  ): String3DFilterTarget[] {
    const targets: String3DFilterTarget[] = [];
    const walk = (obj: String3DObject): void => {
      const el = obj.el as HTMLElement | undefined;
      if (el) {
        const animating = this.filterStates.get(el)?.animating === true;
        const shouldReadStyle = !useDirtySync || !dirtySet || dirtySet.has(el) || animating;
        const chain = this.readFilterChain(el, now, shouldReadStyle);
        if (chain && chain.length > 0) {
          const dirty = !useDirtySync || !dirtySet || dirtySet.has(el) || animating;
          const effectsKey =
            this.filterStates.get(el)?.effectsKey || this.stringifyFilterChain(chain);
          targets.push({
            object: obj,
            effects: chain,
            effectsKey,
            dirty,
          });
          return;
        }
      }
      obj.children.forEach((child) => walk(child));
    };
    rootObjects.forEach((obj) => walk(obj));
    return targets;
  }

  clear(): void {
    this.filterStates = new WeakMap();
    this.filterWarnings = new WeakMap();
  }

  private readFilterChain(
    el: HTMLElement,
    now: number,
    shouldReadStyle: boolean
  ): String3DFilterChain | null {
    const existing = this.filterStates.get(el);
    if (!shouldReadStyle && existing) {
      if (existing.animating) {
        return this.sampleTransition(existing, now);
      }
      return existing.effects;
    }

    const raw = readFilterRaw(el);
    if (!raw || raw === "none") {
      if (existing) {
        if (existing.animating && existing.clearOnComplete) {
          const current = this.sampleTransition(existing, now);
          if (!existing.animating) {
            this.filterStates.delete(el);
            return null;
          }
          return current;
        }
        let { duration, delay, easing } = this.getFilterTransition(el);
        if (duration <= 0 && existing.lastDuration > 0) {
          duration = existing.lastDuration;
          delay = existing.lastDelay;
          easing = existing.lastEasing;
        }
        if (duration > 0) {
          const zero = this.makeZeroChain(existing.effects);
          existing.from = existing.effects;
          existing.to = zero;
          existing.startTime = now + delay;
          existing.duration = duration;
          existing.easing = easing;
          existing.animating = true;
          existing.clearOnComplete = true;
          existing.lastDuration = duration;
          existing.lastDelay = delay;
          existing.lastEasing = easing;
          return this.sampleTransition(existing, now);
        }
      }
      this.filterStates.delete(el);
      return null;
    }

    const { effects, warnings } = this.parseFilterChain(raw);
    this.warnFilterIssues(el, raw, warnings);
    if (effects.length === 0) return null;

    const state = this.filterStates.get(el);
    if (!state) {
      const { duration, delay, easing } = this.getFilterTransition(el);
      if (duration > 0) {
        const zero = this.makeZeroChain(effects);
        const newState: FilterTransitionState = {
          raw,
          effects,
          animating: true,
          from: zero,
          to: effects,
          startTime: now + delay,
          duration,
          easing,
          clearOnComplete: false,
          lastDuration: duration,
          lastDelay: delay,
          lastEasing: easing,
        };
        newState.effectsKey = this.stringifyFilterChain(effects);
        this.filterStates.set(el, newState);
        return this.sampleTransition(newState, now);
      }
      this.filterStates.set(el, {
        raw,
        effects,
        animating: false,
        from: effects,
        to: effects,
        startTime: 0,
        duration: 0,
        easing: (t) => t,
        clearOnComplete: false,
        lastDuration: 0,
        lastDelay: 0,
        lastEasing: (t) => t,
        effectsKey: this.stringifyFilterChain(effects),
      });
      return effects;
    }

    if (state.raw === raw) {
      if (state.animating) {
        const current = this.sampleTransition(state, now);
        if (!state.animating && state.clearOnComplete) {
          this.filterStates.delete(el);
          return null;
        }
        return current;
      }
      return state.effects;
    }

    state.pendingEffects = undefined;
    state.pendingRaw = undefined;

    let { duration, delay, easing } = this.getFilterTransition(el);
    if (duration <= 0 && state.lastDuration > 0) {
      duration = state.lastDuration;
      delay = state.lastDelay;
      easing = state.lastEasing;
    }
    if (duration > 0) {
      const canTween = this.canInterpolate(state.effects, effects);
      const current = state.animating ? this.getCurrentChain(state, now) : state.effects;
      if (!canTween && this.isZeroChain(effects)) {
        state.pendingRaw = raw;
        state.pendingEffects = effects;
        state.raw = raw;
        state.effects = current;
        state.from = current;
        state.to = this.makeZeroChain(current);
        state.startTime = now + delay;
        state.duration = duration;
        state.easing = easing;
        state.animating = true;
        state.clearOnComplete = false;
        state.lastDuration = duration;
        state.lastDelay = delay;
        state.lastEasing = easing;
        state.effectsKey = this.stringifyFilterChain(effects);
        return this.sampleTransition(state, now);
      }

      const fromChain = canTween ? current : this.makeZeroChain(effects);
      state.raw = raw;
      state.effects = effects;
      state.from = fromChain;
      state.to = effects;
      state.startTime = now + delay;
      state.duration = duration;
      state.easing = easing;
      state.animating = true;
      state.clearOnComplete = false;
      state.lastDuration = duration;
      state.lastDelay = delay;
      state.lastEasing = easing;
      state.effectsKey = this.stringifyFilterChain(effects);
      return this.sampleTransition(state, now);
    }

    state.raw = raw;
    state.effects = effects;
    state.animating = false;
    state.clearOnComplete = false;
    state.effectsKey = this.stringifyFilterChain(effects);
    return effects;
  }

  private warnFilterIssues(el: HTMLElement, raw: string, warnings: string[]): void {
    if (warnings.length === 0) return;
    const lastRaw = this.filterWarnings.get(el);
    if (lastRaw === raw) return;
    warnings.forEach((warning) => console.warn(warning, el));
    this.filterWarnings.set(el, raw);
  }

  private parseFilterChain(raw: string): { effects: String3DFilterChain; warnings: string[] } {
    const warnings: string[] = [];
    const effects: String3DFilterChain = [];

    const parseNumber = (value: string): number | null => {
      const cleaned = value.trim().toLowerCase();
      const match = cleaned.match(/^(-?\d*\.?\d+)(px)?$/);
      if (!match) return null;
      const num = Number.parseFloat(match[1]);
      return Number.isFinite(num) ? num : null;
    };

    const parseRatio = (value: string): number | null => {
      const cleaned = value.trim().toLowerCase();
      if (!cleaned) return null;
      if (cleaned.endsWith("%")) {
        const num = Number.parseFloat(cleaned.slice(0, -1));
        return Number.isFinite(num) ? num / 100 : null;
      }
      const num = Number.parseFloat(cleaned);
      return Number.isFinite(num) ? num : null;
    };

    const parseAngle = (value: string): number | null => {
      const cleaned = value.trim().toLowerCase();
      if (!cleaned) return null;
      if (cleaned.endsWith("rad")) {
        const num = Number.parseFloat(cleaned.slice(0, -3));
        return Number.isFinite(num) ? num : null;
      }
      const stripped = cleaned.endsWith("deg") ? cleaned.slice(0, -3) : cleaned;
      const num = Number.parseFloat(stripped);
      return Number.isFinite(num) ? (num * Math.PI) / 180 : null;
    };

    const parseBloom = (value: string): { intensity: number; threshold: number } | null => {
      const parts = value.split(",").map((part) => part.trim());
      const intensity = parseNumber(parts[0] || "");
      if (intensity === null) return null;
      const threshold = parts[1] ? parseRatio(parts[1]) : null;
      return {
        intensity: Math.max(0, intensity),
        threshold: threshold === null ? 0.8 : Math.max(0, Math.min(1, threshold)),
      };
    };

    const parseAmount = (value: string, name: string, allowZero = false): number | null => {
      const amount = parseNumber(value);
      if (amount === null) {
        warnings.push(`[String3D] Invalid ${name} value "${value}".`);
        return null;
      }
      if (!allowZero && amount <= 0) {
        warnings.push(`[String3D] ${name} must be > 0.`);
        return null;
      }
      return amount;
    };

    const parseRatioAmount = (value: string, name: string): number | null => {
      const amount = parseRatio(value);
      if (amount === null) {
        warnings.push(`[String3D] Invalid ${name} value "${value}".`);
        return null;
      }
      return amount;
    };

    const re = /([a-zA-Z-]+)\(([^)]*)\)/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(raw))) {
      const name = match[1].toLowerCase();
      const args = (match[2] || "").trim();

      if (name === "blur") {
        const amount = parseAmount(args, "blur", true);
        if (amount !== null) effects.push({ type: "blur", amount });
      } else if (name === "pixel" || name === "pixelate") {
        const size = parseAmount(args, "pixel", true);
        if (size !== null) effects.push({ type: "pixel", size });
      } else if (name === "bloom") {
        const bloom = parseBloom(args);
        if (bloom) effects.push({ type: "bloom", ...bloom });
        else warnings.push(`[String3D] Invalid bloom value "${args}".`);
      } else if (name === "brightness") {
        const amount = parseRatioAmount(args, "brightness");
        if (amount !== null) effects.push({ type: "brightness", amount: Math.max(0, amount) });
      } else if (name === "contrast") {
        const amount = parseRatioAmount(args, "contrast");
        if (amount !== null) effects.push({ type: "contrast", amount: Math.max(0, amount) });
      } else if (name === "saturate") {
        const amount = parseRatioAmount(args, "saturate");
        if (amount !== null) effects.push({ type: "saturate", amount: Math.max(0, amount) });
      } else if (name === "grayscale") {
        const amount = parseRatioAmount(args, "grayscale");
        if (amount !== null)
          effects.push({ type: "grayscale", amount: Math.max(0, Math.min(1, amount)) });
      } else if (name === "sepia") {
        const amount = parseRatioAmount(args, "sepia");
        if (amount !== null)
          effects.push({ type: "sepia", amount: Math.max(0, Math.min(1, amount)) });
      } else if (name === "invert") {
        const amount = parseRatioAmount(args, "invert");
        if (amount !== null)
          effects.push({ type: "invert", amount: Math.max(0, Math.min(1, amount)) });
      } else if (name === "hue-rotate") {
        const angle = parseAngle(args);
        if (angle !== null) effects.push({ type: "hue-rotate", angle });
        else warnings.push(`[String3D] Invalid hue-rotate value "${args}".`);
      } else if (name) {
        const custom = String3DCustomFilterRegistry.get(name);
        if (custom) {
          const parsed = custom.parse ? custom.parse(args) : {};
          if (parsed === null) {
            warnings.push(`[String3D] Invalid custom filter "${name}" args "${args}".`);
          } else {
            effects.push({ type: "custom", name, uniforms: parsed });
          }
        } else {
          warnings.push(`[String3D] Unknown filter "${name}".`);
        }
      }
    }

    if (effects.length === 0) {
      warnings.push("[String3D] No valid filters parsed from --filter.");
    }

    return { effects, warnings };
  }

  private getFilterTransition(el: HTMLElement): {
    duration: number;
    delay: number;
    easing: (t: number) => number;
  } {
    const style = getComputedStyle(el);
    const properties = this.splitTransitionList(style.transitionProperty);
    const durations = this.splitTransitionList(style.transitionDuration);
    const delays = this.splitTransitionList(style.transitionDelay);
    const timings = this.splitTransitionList(style.transitionTimingFunction);

    const index = this.findTransitionIndex(properties, "--filter");
    if (index === -1) {
      const shorthand = this.parseTransitionShorthand(style.transition);
      const fallback = shorthand.get("--filter") || shorthand.get("all");
      if (fallback) {
        return fallback;
      }
      return { duration: 0, delay: 0, easing: (t) => t };
    }

    const duration = this.parseTime(durations[index] || durations[durations.length - 1] || "0s");
    const delay = this.parseTime(delays[index] || delays[delays.length - 1] || "0s");
    const easingRaw = timings[index] || timings[timings.length - 1] || "linear";
    return { duration, delay, easing: this.parseEasing(easingRaw) };
  }

  private splitTransitionList(value: string): string[] {
    const result: string[] = [];
    let current = "";
    let depth = 0;
    for (let i = 0; i < value.length; i += 1) {
      const ch = value[i];
      if (ch === "(") depth += 1;
      if (ch === ")") depth = Math.max(0, depth - 1);
      if (ch === "," && depth === 0) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    if (current.trim()) result.push(current.trim());
    return result.length > 0 ? result : ["all"];
  }

  private findTransitionIndex(properties: string[], name: string): number {
    const normalized = properties.map((prop) => prop.trim().toLowerCase());
    let index = normalized.indexOf(name);
    if (index === -1) {
      index = normalized.indexOf("all");
    }
    return index;
  }

  private parseTime(value: string): number {
    const raw = value.trim().toLowerCase();
    if (raw.endsWith("ms")) {
      const num = Number.parseFloat(raw.slice(0, -2));
      return Number.isFinite(num) ? num : 0;
    }
    if (raw.endsWith("s")) {
      const num = Number.parseFloat(raw.slice(0, -1));
      return Number.isFinite(num) ? num * 1000 : 0;
    }
    const num = Number.parseFloat(raw);
    return Number.isFinite(num) ? num : 0;
  }

  private parseTransitionShorthand(
    value: string
  ): Map<string, { duration: number; delay: number; easing: (t: number) => number }> {
    const map = new Map<
      string,
      { duration: number; delay: number; easing: (t: number) => number }
    >();
    const parts = this.splitTransitionList(value);
    parts.forEach((part) => {
      if (!part) return;
      const tokens = part.trim().split(/\s+(?![^()]*\))/g);
      let prop = "";
      let duration = "";
      let delay = "";
      let easing = "";
      tokens.forEach((token) => {
        const lower = token.toLowerCase();
        if (lower.endsWith("ms") || lower.endsWith("s") || /^[0-9.]+$/.test(lower)) {
          if (!duration) duration = lower;
          else if (!delay) delay = lower;
        } else if (
          lower.startsWith("cubic-bezier") ||
          lower.startsWith("steps") ||
          lower === "linear" ||
          lower === "ease" ||
          lower === "ease-in" ||
          lower === "ease-out" ||
          lower === "ease-in-out"
        ) {
          easing = token;
        } else if (!prop) {
          prop = token;
        }
      });
      if (!prop) return;
      map.set(prop.trim().toLowerCase(), {
        duration: this.parseTime(duration || "0s"),
        delay: this.parseTime(delay || "0s"),
        easing: this.parseEasing(easing || "linear"),
      });
    });
    return map;
  }

  private parseEasing(value: string): (t: number) => number {
    const raw = value.trim();
    if (!raw) return (t) => t;
    if (!this.easingParser) return (t) => t;
    try {
      const fn = this.easingParser(raw);
      return typeof fn === "function" ? fn : (t) => t;
    } catch {
      return (t) => t;
    }
  }

  private canInterpolate(from: String3DFilterChain, to: String3DFilterChain): boolean {
    if (from.length !== to.length) return false;
    return from.every((effect, index) => {
      const other = to[index];
      if (effect.type !== other.type) return false;
      if (effect.type === "custom" && other.type === "custom") {
        if (effect.name !== other.name) return false;
        const keys = Object.keys(effect.uniforms || {});
        const otherKeys = Object.keys(other.uniforms || {});
        if (keys.length !== otherKeys.length) return false;
        return keys.every(
          (key) => key in (other.uniforms || {}) && this.isNumeric(effect.uniforms?.[key])
        );
      }
      return true;
    });
  }

  private makeZeroChain(chain: String3DFilterChain): String3DFilterChain {
    return chain.map((effect) => {
      switch (effect.type) {
        case "blur":
          return { type: "blur", amount: 0 };
        case "pixel":
          return { type: "pixel", size: 0 };
        case "bloom":
          return { type: "bloom", intensity: 0, threshold: effect.threshold };
        case "brightness":
          return { type: "brightness", amount: 1 };
        case "contrast":
          return { type: "contrast", amount: 1 };
        case "saturate":
          return { type: "saturate", amount: 1 };
        case "grayscale":
          return { type: "grayscale", amount: 0 };
        case "sepia":
          return { type: "sepia", amount: 0 };
        case "invert":
          return { type: "invert", amount: 0 };
        case "hue-rotate":
          return { type: "hue-rotate", angle: 0 };
        case "custom": {
          const uniforms: Record<string, any> = {};
          Object.entries(effect.uniforms || {}).forEach(([key, value]) => {
            uniforms[key] = this.isNumeric(value) ? 0 : value;
          });
          return { type: "custom", name: effect.name, uniforms };
        }
        default:
          return effect;
      }
    });
  }

  private sampleTransition(state: FilterTransitionState, now: number): String3DFilterChain {
    if (!state.animating) return state.effects;
    if (now < state.startTime) {
      return state.from;
    }
    const elapsed = now - state.startTime;
    const duration = Math.max(1, state.duration);
    const t = Math.min(1, Math.max(0, elapsed / duration));
    const eased = state.easing(t);
    const interpolated = this.interpolateChain(state.from, state.to, eased);
    if (t >= 1) {
      state.animating = false;
      state.from = state.to;
      if (state.pendingEffects && state.pendingRaw === state.raw) {
        state.effects = state.pendingEffects;
        state.raw = state.pendingRaw || state.raw;
        state.pendingEffects = undefined;
        state.pendingRaw = undefined;
      } else if (state.pendingEffects) {
        state.pendingEffects = undefined;
        state.pendingRaw = undefined;
      }
    }
    return interpolated;
  }

  private getCurrentChain(state: FilterTransitionState, now: number): String3DFilterChain {
    if (!state.animating) return state.effects;
    if (now < state.startTime) return state.from;
    const elapsed = now - state.startTime;
    const duration = Math.max(1, state.duration);
    const t = Math.min(1, Math.max(0, elapsed / duration));
    const eased = state.easing(t);
    return this.interpolateChain(state.from, state.to, eased);
  }

  private interpolateChain(
    from: String3DFilterChain,
    to: String3DFilterChain,
    t: number
  ): String3DFilterChain {
    if (!this.canInterpolate(from, to)) return to;
    return from.map((effect, index) => this.interpolateEffect(effect, to[index], t));
  }

  private interpolateEffect(
    from: String3DFilterEffect,
    to: String3DFilterEffect,
    t: number
  ): String3DFilterEffect {
    const lerp = (a: number, b: number) => a + (b - a) * t;
    if (from.type === "blur" && to.type === "blur") {
      return { type: "blur", amount: lerp(from.amount, to.amount) };
    }
    if (from.type === "pixel" && to.type === "pixel") {
      return { type: "pixel", size: lerp(from.size, to.size) };
    }
    if (from.type === "bloom" && to.type === "bloom") {
      return {
        type: "bloom",
        intensity: lerp(from.intensity, to.intensity),
        threshold: lerp(from.threshold, to.threshold),
      };
    }
    if (from.type === "brightness" && to.type === "brightness") {
      return { type: "brightness", amount: lerp(from.amount, to.amount) };
    }
    if (from.type === "contrast" && to.type === "contrast") {
      return { type: "contrast", amount: lerp(from.amount, to.amount) };
    }
    if (from.type === "saturate" && to.type === "saturate") {
      return { type: "saturate", amount: lerp(from.amount, to.amount) };
    }
    if (from.type === "grayscale" && to.type === "grayscale") {
      return { type: "grayscale", amount: lerp(from.amount, to.amount) };
    }
    if (from.type === "sepia" && to.type === "sepia") {
      return { type: "sepia", amount: lerp(from.amount, to.amount) };
    }
    if (from.type === "invert" && to.type === "invert") {
      return { type: "invert", amount: lerp(from.amount, to.amount) };
    }
    if (from.type === "hue-rotate" && to.type === "hue-rotate") {
      return { type: "hue-rotate", angle: lerp(from.angle, to.angle) };
    }
    if (from.type === "custom" && to.type === "custom" && from.name === to.name) {
      const uniforms: Record<string, any> = {};
      Object.entries(to.uniforms || {}).forEach(([key, value]) => {
        const fromValue = from.uniforms?.[key];
        if (this.isNumeric(fromValue) && this.isNumeric(value)) {
          uniforms[key] = lerp(fromValue, value);
        } else {
          uniforms[key] = value;
        }
      });
      return { type: "custom", name: to.name, uniforms };
    }
    return to;
  }

  private stringifyFilterChain(chain: String3DFilterChain): string {
    const parts = chain.map((effect) => {
      if (effect.type === "blur") return `blur:${effect.amount}`;
      if (effect.type === "pixel") return `pixel:${effect.size}`;
      if (effect.type === "bloom") return `bloom:${effect.intensity},${effect.threshold}`;
      if (effect.type === "brightness") return `brightness:${effect.amount}`;
      if (effect.type === "contrast") return `contrast:${effect.amount}`;
      if (effect.type === "saturate") return `saturate:${effect.amount}`;
      if (effect.type === "grayscale") return `grayscale:${effect.amount}`;
      if (effect.type === "sepia") return `sepia:${effect.amount}`;
      if (effect.type === "invert") return `invert:${effect.amount}`;
      if (effect.type === "hue-rotate") return `hue-rotate:${effect.angle}`;
      if (effect.type === "custom") {
        const uniforms = Object.keys(effect.uniforms || {})
          .sort()
          .map((key) => `${key}=${(effect.uniforms as any)[key]}`)
          .join(",");
        return `custom:${effect.name}:${uniforms}`;
      }
      return "unknown";
    });
    return parts.join("|");
  }

  private isNumeric(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
  }

  private isZeroChain(chain: String3DFilterChain): boolean {
    return chain.every((effect) => {
      switch (effect.type) {
        case "blur":
          return effect.amount <= 0;
        case "pixel":
          return effect.size <= 0;
        case "bloom":
          return effect.intensity <= 0;
        case "brightness":
          return effect.amount === 1;
        case "contrast":
          return effect.amount === 1;
        case "saturate":
          return effect.amount === 1;
        case "grayscale":
          return effect.amount === 0;
        case "sepia":
          return effect.amount === 0;
        case "invert":
          return effect.amount === 0;
        case "hue-rotate":
          return effect.angle === 0;
        case "custom":
          return false;
        default:
          return false;
      }
    });
  }
}
