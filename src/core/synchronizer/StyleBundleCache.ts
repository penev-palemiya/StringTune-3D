import type { SyncContext } from "./SyncContext";

export class StyleBundleCache<T> {
  private cache: WeakMap<HTMLElement, T> = new WeakMap();
  private meta: WeakMap<HTMLElement, { time: number }> = new WeakMap();

  get(el: HTMLElement, ctx: SyncContext, reader: (el: HTMLElement) => T): T {
    const canUseCache = !!ctx.dirtySet && ctx.forceSync === false && !ctx.dirtySet.has(el);
    if (canUseCache) {
      const cached = this.cache.get(el);
      if (cached) return cached;
    }

    const now = performance.now();
    const interval = Math.max(0, ctx.styleReadIntervalMs ?? 0);
    if (interval > 0) {
      const metaData = this.meta.get(el);
      const cached = this.cache.get(el);
      if (metaData && cached && now - metaData.time < interval) {
        return cached;
      }
    }

    const bundle = reader(el);
    this.cache.set(el, bundle);
    this.meta.set(el, { time: now });
    return bundle;
  }

  clear(): void {
    this.cache = new WeakMap();
    this.meta = new WeakMap();
  }
}
