import { String3DObject } from "../../core/String3DObject";

export class DirtySyncManager {
  private readonly attributeFilter: string[];
  private readonly handleScrollBound = () => this.handleScroll();
  private dirtyElements: Set<HTMLElement> = new Set();
  private observedElements: Set<HTMLElement> = new Set();
  private resizeObserver: ResizeObserver | null = null;
  private mutationObserver: MutationObserver | null = null;
  private enabled = false;
  private domVersion = 0;

  constructor(attributeFilter: string[]) {
    this.attributeFilter = attributeFilter;
  }

  enable(): void {
    if (this.enabled) return;
    this.enabled = true;
    this.setupObservers();
    this.setupScrollListeners();
  }

  disable(): void {
    if (!this.enabled) return;
    this.enabled = false;
    this.removeScrollListeners();
    this.resizeObserver?.disconnect();
    this.mutationObserver?.disconnect();
    this.dirtyElements.clear();
    this.observedElements.clear();
  }

  observeElement(el: HTMLElement): void {
    if (!this.enabled || this.observedElements.has(el)) return;
    this.observedElements.add(el);
    this.resizeObserver?.observe(el);
    this.mutationObserver?.observe(el, {
      attributes: true,
      attributeFilter: this.attributeFilter,
    });
  }

  observeScene(rootObjects: String3DObject[]): void {
    if (!this.enabled) return;
    rootObjects.forEach((obj) => this.observeRecursive(obj));
  }

  markDirty(el: HTMLElement): void {
    if (!this.enabled) return;
    this.dirtyElements.add(el);
    this.bumpVersion();
  }

  markAllDirty(): void {
    if (!this.enabled) return;
    this.observedElements.forEach((el) => this.dirtyElements.add(el));
    this.bumpVersion();
  }

  getDirtySet(): Set<HTMLElement> | null {
    return this.enabled ? this.dirtyElements : null;
  }

  clearDirty(): void {
    this.dirtyElements.clear();
  }

  getVersion(): number {
    return this.domVersion;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private observeRecursive(object: String3DObject): void {
    if (object.el instanceof HTMLElement) {
      this.observeElement(object.el);
    }
    object.children.forEach((child) => this.observeRecursive(child));
  }

  private handleScroll(): void {
    this.markAllDirty();
  }

  private setupObservers(): void {
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.target instanceof HTMLElement) {
            this.markDirty(entry.target);
          }
        });
      });
    }

    if (typeof MutationObserver !== "undefined") {
      this.mutationObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.target instanceof HTMLElement) {
            this.markDirty(mutation.target);
          }
        });
      });
    }
  }

  private setupScrollListeners(): void {
    window.addEventListener("scroll", this.handleScrollBound, { passive: true });
    window.addEventListener("resize", this.handleScrollBound, { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener("scroll", this.handleScrollBound, { passive: true });
      window.visualViewport.addEventListener("resize", this.handleScrollBound, { passive: true });
    }
  }

  private removeScrollListeners(): void {
    window.removeEventListener("scroll", this.handleScrollBound);
    window.removeEventListener("resize", this.handleScrollBound);
    if (window.visualViewport) {
      window.visualViewport.removeEventListener("scroll", this.handleScrollBound);
      window.visualViewport.removeEventListener("resize", this.handleScrollBound);
    }
  }

  private bumpVersion(): void {
    this.domVersion += 1;
  }
}
