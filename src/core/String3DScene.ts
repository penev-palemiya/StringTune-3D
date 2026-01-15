import {
  I3DEngine,
  I3DScene,
  I3DLight,
  I3DMaterial,
  I3DModelLoader,
  I3DVector3,
} from "./abstractions/I3DEngine";
import { String3DObject } from "./String3DObject";
import { StringObject } from "@fiddle-digital/string-tune";
import { readBooleanStyle, readNumberStyle, readStringStyle } from "../modules/string3d/styleUtils";
import { String3DCustomMaterialRegistry, IMaterialInstance } from "./materials";
import type { String3DSynchronizer } from "./synchronizer/String3DSynchronizer";

export interface String3DSceneOptions {
  modelLoader?: I3DModelLoader;
  modelLoaderFactory?: (engine: I3DEngine, type?: string) => I3DModelLoader;
}

export class String3DScene {
  private _scene: I3DScene;
  private _objects: Map<string, String3DObject> = new Map();
  private _rootObjects: String3DObject[] = [];
  private _elementMap: Map<string, HTMLElement> = new Map();
  private _materialInstances: Map<string, IMaterialInstance> = new Map();
  private engine: I3DEngine;
  private _modelLoader?: I3DModelLoader;
  private _modelLoaderFactory?: (engine: I3DEngine, type?: string) => I3DModelLoader;
  private _modelLoaderCache: Map<string, I3DModelLoader> = new Map();
  private _synchronizer?: String3DSynchronizer;

  public get rootObjects(): String3DObject[] {
    return this._rootObjects;
  }

  constructor(engine: I3DEngine, options: String3DSceneOptions = {}) {
    this.engine = engine;
    this._modelLoader = options.modelLoader;
    this._modelLoaderFactory = options.modelLoaderFactory;
    this._scene = engine.createScene();
  }

  public setSynchronizer(synchronizer: String3DSynchronizer): void {
    this._synchronizer = synchronizer;
  }

  public getScene(): I3DScene {
    return this._scene;
  }

  public getObject(id: string): String3DObject | undefined {
    return this._objects.get(id);
  }

  public getObjectForElement(element: HTMLElement): String3DObject | undefined {
    for (const [id, el] of this._elementMap) {
      if (el === element) {
        return this._objects.get(id);
      }
    }
    return undefined;
  }

  public getAllObjects(): String3DObject[] {
    const result: String3DObject[] = [];
    const walk = (obj: String3DObject): void => {
      result.push(obj);
      obj.children.forEach((child) => walk(child));
    };
    this._rootObjects.forEach((obj) => walk(obj));
    return result;
  }

  public hasObject(id: string): boolean {
    return this._objects.has(id);
  }

  public deleteObject(id: string): boolean {
    const obj = this._objects.get(id);
    if (obj) {
      const element = this._elementMap.get(id);
      if (element && this._synchronizer) {
        this._synchronizer.cleanupElement(element, obj);
      }

      this._scene.remove(obj.object);
      this._objects.delete(id);
      this._elementMap.delete(id);
      this._rootObjects = this._rootObjects.filter((root) => root !== obj);
      obj.destroy();
      return true;
    }
    return false;
  }

  public createFromElement(object: StringObject): void {
    const type = object.getProperty<string>("3d");
    if (!type) return;

    const element = object.htmlElement;
    if (!element) return;

    const onAdd = (added3DObject: String3DObject) => {
      if (added3DObject) {
        const parentId = object.getProperty<string>("parentId");
        if (parentId == null) {
          this._scene.add(added3DObject.object);
          this._rootObjects.push(added3DObject);
        } else {
          this._objects.get(parentId)?.addChild(added3DObject);
        }
        this._objects.set(object.id, added3DObject);
        this._elementMap.set(object.id, element);
        added3DObject.el = element;
      }
    };

    switch (type) {
      case "group":
        this.createGroup(object, onAdd);
        break;
      case "pointLight":
        this.createLight(object, "point", onAdd);
        break;
      case "ambientLight":
        this.createLight(object, "ambient", onAdd);
        break;
      case "directionalLight":
        this.createLight(object, "directional", onAdd);
        break;
      case "spotLight":
        this.createLight(object, "spot", onAdd);
        break;
      case "hemisphereLight":
        this.createLight(object, "hemisphere", onAdd);
        break;
      case "model":
        this.createModel(object, onAdd);
        break;
      case "box":
        this.createBox(object, onAdd);
        break;
      case "sphere":
        this.createSphere(object, onAdd);
        break;
      case "plane":
        this.createPlane(object, onAdd);
        break;
      case "cylinder":
        this.createCylinder(object, onAdd);
        break;
      case "particles":
        this.createParticles(object, onAdd);
        break;
      case "text":
        this.createText(object, onAdd);
        break;
    }
  }

  private createGroup(object: StringObject, onAdd: (obj: String3DObject) => void): String3DObject {
    const group = this.engine.createGroup();
    const obj = new String3DObject(object.id, "group", group, this.engine);
    onAdd(obj);
    return obj;
  }

  private createLight(
    object: StringObject,
    kind: "point" | "ambient" | "directional" | "spot" | "hemisphere",
    onAdd: (obj: String3DObject) => void
  ): String3DObject {
    const element = object.htmlElement;
    const colorRaw = element ? readStringStyle(element, "--light-color", "#ffffff") : "#ffffff";
    const color = colorRaw && colorRaw !== "none" ? colorRaw : "#ffffff";
    const intensity = element ? readNumberStyle(element, "--light-intensity", 1) : 1;

    let light: I3DLight;
    if (kind === "point") {
      const distance = element ? readNumberStyle(element, "--light-distance", 1000) : 1000;
      const decay = element ? readNumberStyle(element, "--light-decay", 0) : 0;
      light = this.engine.createPointLight(color, intensity, distance, decay);
    } else if (kind === "directional") {
      light = this.engine.createDirectionalLight(color, intensity);
    } else if (kind === "spot") {
      const distance = element ? readNumberStyle(element, "--light-distance", 0) : 0;
      const angle = element ? readNumberStyle(element, "--light-angle", Math.PI / 3) : Math.PI / 3;
      const penumbra = element ? readNumberStyle(element, "--light-penumbra", 0) : 0;
      const decay = element ? readNumberStyle(element, "--light-decay", 1) : 1;
      light = this.engine.createSpotLight(color, intensity, distance, angle, penumbra, decay);
    } else if (kind === "hemisphere") {
      const groundRaw = element
        ? readStringStyle(element, "--light-ground-color", "#ffffff")
        : "#ffffff";
      const groundColor = groundRaw && groundRaw !== "none" ? groundRaw : "#ffffff";
      light = this.engine.createHemisphereLight(color, groundColor, intensity);
    } else {
      light = this.engine.createAmbientLight(color, intensity);
    }

    const castShadow = element ? readBooleanStyle(element, "--shadow-cast", false) : false;
    if (castShadow && light.shadow) {
      light.castShadow = true;
      const bias = element ? readNumberStyle(element, "--shadow-bias", 0) : 0;
      const mapSize = element ? readNumberStyle(element, "--shadow-map-size", 512) : 512;
      light.shadow.bias = bias;
      light.shadow.mapSize.width = mapSize;
      light.shadow.mapSize.height = mapSize;
    }

    const obj = new String3DObject(object.id, kind + "Light", light, this.engine);
    onAdd(obj);
    return obj;
  }

  private applyShadowProps(object: StringObject, mesh: any): void {
    const element = object.htmlElement;
    const castShadow = element ? readBooleanStyle(element, "--shadow-cast", false) : false;
    const receiveShadow = element ? readBooleanStyle(element, "--shadow-receive", false) : false;
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
  }

  private createBox(object: StringObject, onAdd: (obj: String3DObject) => void): String3DObject {
    const geometry = this.engine.createBoxGeometry(1, 1, 1);
    const material = this.createMaterialFromObject(object);
    const mesh = this.engine.createMesh(geometry, material);
    this.applyShadowProps(object, mesh);
    const obj = new String3DObject(object.id, "box", mesh, this.engine, {
      geometry,
      material,
    });
    onAdd(obj);
    return obj;
  }

  private createSphere(object: StringObject, onAdd: (obj: String3DObject) => void): String3DObject {
    const quality = this.getGeometryQuality(object.htmlElement);
    const widthSegments = Math.max(3, Math.round(32 * quality));
    const heightSegments = Math.max(2, Math.round(32 * quality));
    const geometry = this.engine.createSphereGeometry(0.5, widthSegments, heightSegments);
    const material = this.createMaterialFromObject(object);
    const mesh = this.engine.createMesh(geometry, material);
    this.applyShadowProps(object, mesh);
    const obj = new String3DObject(object.id, "sphere", mesh, this.engine, {
      geometry,
      material,
    });
    onAdd(obj);
    return obj;
  }

  private createPlane(object: StringObject, onAdd: (obj: String3DObject) => void): String3DObject {
    const geometry = this.engine.createPlaneGeometry(1, 1);
    const material = this.createMaterialFromObject(object);
    const mesh = this.engine.createMesh(geometry, material);
    this.applyShadowProps(object, mesh);
    const obj = new String3DObject(object.id, "plane", mesh, this.engine, {
      geometry,
      material,
    });
    onAdd(obj);
    return obj;
  }

  private createCylinder(
    object: StringObject,
    onAdd: (obj: String3DObject) => void
  ): String3DObject {
    const quality = this.getGeometryQuality(object.htmlElement);
    const segments = Math.max(3, Math.round(32 * quality));
    const geometry = this.engine.createCylinderGeometry(0.5, 0.5, 1, segments);
    const material = this.createMaterialFromObject(object);
    const mesh = this.engine.createMesh(geometry, material);
    this.applyShadowProps(object, mesh);
    const obj = new String3DObject(object.id, "cylinder", mesh, this.engine, {
      geometry,
      material,
    });
    onAdd(obj);
    return obj;
  }

  private createModel(object: StringObject, onAdd: (obj: String3DObject) => void): void {
    const modelPath = object.getProperty<string>("3d-model");
    if (!modelPath) return;

    const loaderType = object.getProperty<string>("3d-model-loader") || undefined;
    const loader = this.resolveModelLoader(loaderType);
    if (!loader) {
      return;
    }

    const element = object.htmlElement;
    if (element) {
      this.applyModelTextureRemap(loader, element);
    }
    const shouldCenter = object.getProperty<boolean>("3d-model-center") ?? false;

    loader.load(
      modelPath,
      (gltf: any) => {
        const root = gltf?.scene || gltf?.object || gltf;
        if (!root) {
          return;
        }

        const overrideMaterial =
          element && this.shouldOverrideModelMaterial(element)
            ? this.createMaterialFromElement(element, object)
            : null;

        if (typeof root.traverse === "function") {
          root.traverse((child: any) => {
            if (child.isMesh) {
              if (overrideMaterial) {
                child.material = overrideMaterial;
              }
              this.applyShadowProps(object, child);
            }
          });
        }

        if (shouldCenter) {
          this.centerObject(root);
        }
        const obj = new String3DObject(object.id, "model", root, this.engine);
        onAdd(obj);
      },
      undefined,
      undefined
    );
  }

  private createParticles(object: StringObject, onAdd: (obj: String3DObject) => void): void {
    if (!this.engine.createParticleSystem) {
      return;
    }

    const element = object.htmlElement;
    const config: import("./abstractions/I3DEngine").ParticleSystemConfig = {
      mode: "emitter",
      count: 300,
      size: 2,
      color: "#ffffff",
      opacity: 1,
      spread: 120,
      spreadX: 0,
      spreadY: 0,
      seed: 1,
      emitRate: 30,
      emitBurst: 0,
      particleLife: 2.5,
      particleSpeed: 40,
      particleDirection: [0, 1, 0] as [number, number, number],
      particleGravity: [0, -30, 0] as [number, number, number],
      particleDrag: 0.1,
      particleSizeVariation: 0.6,
      particleColorVariation: 0.2,
      particleShape: "sphere",
      particleModelUrl: "",
      particleModelLoader: "",
      particleModelNode: "",
      instanceShape: "sphere",
      instanceModelUrl: "",
      instanceModelLoader: "",
      instanceModelNode: "",
      instanceScale: 1,
      instanceScaleVariation: 0.5,
      instanceRotationSpeed: 0.4,
      instanceJitter: 0.2,
      instanceFlow: 0.3,
      instanceDisperse: 0,
      instanceDisperseScatter: 0,
      instanceDisperseScatterX: 0,
      instanceDisperseScatterY: 0,
      instanceDisperseScatterZ: 0,
      modelTransitionDuration: 0,
    };

    const system = this.engine.createParticleSystem(config);
    const obj = new String3DObject(object.id, "particles", system, this.engine);
    onAdd(obj);
  }

  private createText(object: StringObject, onAdd: (obj: String3DObject) => void): void {
    if (!this.engine.createTextGeometry) {
      return;
    }

    const geometry = this.engine.createBoxGeometry(1, 1, 1);
    const material = this.createMaterialFromObject(object);
    const mesh = this.engine.createMesh(geometry, material);
    this.applyShadowProps(object, mesh);

    const group = this.engine.createGroup();
    (group as any).__textMesh = mesh;
    group.add(mesh);

    const obj = new String3DObject(object.id, "text", group, this.engine, {
      geometry,
      material,
    });
    onAdd(obj);
  }

  private getGeometryQuality(element?: HTMLElement | null): number {
    if (!element) return 1;
    const quality = readNumberStyle(element, "--geometry-quality", 1);
    if (!Number.isFinite(quality) || quality <= 0) return 1;
    return quality;
  }

  private resolveModelLoader(type?: string): I3DModelLoader | undefined {
    if (type) {
      if (this._modelLoaderCache.has(type)) {
        return this._modelLoaderCache.get(type);
      }
      if (!this._modelLoaderFactory) {
        return undefined;
      }
      const loader = this._modelLoaderFactory(this.engine, type);
      this._modelLoaderCache.set(type, loader);
      return loader;
    }

    if (this._modelLoader) {
      return this._modelLoader;
    }

    if (this._modelLoaderFactory) {
      return this._modelLoaderFactory(this.engine);
    }

    return undefined;
  }

  private centerObject(object: any): void {
    if (!object) return;
    const bbox = this.engine.computeBoundingBoxRecursively(object);
    const center = this.getBoxCenter(bbox);
    if (object.position?.set) {
      object.position.set(-center.x, -center.y, -center.z);
    }
    object.updateMatrixWorld(true);
  }

  private getBoxCenter(box: any): I3DVector3 {
    const center = this.engine.createVector3();
    center.x = (box.min.x + box.max.x) / 2;
    center.y = (box.min.y + box.max.y) / 2;
    center.z = (box.min.z + box.max.z) / 2;
    return center;
  }

  private createMaterialFromObject(object: StringObject): I3DMaterial {
    return this.createMaterialFromElement(object.htmlElement, object);
  }

  private createMaterialFromElement(
    element: HTMLElement | null,
    object?: StringObject
  ): I3DMaterial {
    const style = element ? getComputedStyle(element) : null;
    const getCSS = (prop: string) => (style ? style.getPropertyValue(prop).trim() : "");

    const resolve = <T>(cssProp: string, parser: (v: string) => T, defaultValue: T): T => {
      const cssVal = getCSS(cssProp);
      if (cssVal && cssVal !== "none" && cssVal !== "") return parser(cssVal);
      return defaultValue;
    };

    const parseNumber = (v: string) => parseFloat(v);
    const parseColor = (v: string) => v;
    const parseUrl = (v: string) => {
      const match = v.match(/url\(['"]?(.*?)['"]?\)/);
      return match ? match[1] : v;
    };

    const type = resolve("--material-type", (v) => v.split("[")[0] || "basic", "basic");

    const customMaterial = this.tryCreateCustomMaterial(type, element, style, object);
    if (customMaterial) {
      return customMaterial;
    }

    const color = resolve("--material-color", parseColor, "#ffffff");

    const opacity = resolve("--opacity", parseNumber, 1);
    const metalness = resolve("--material-metalness", parseNumber, 0);
    const roughness = resolve("--material-roughness", parseNumber, 1);
    const emissive = resolve("--material-emissive", parseColor, "#000000");

    const params: any = {
      color,
      transparent: opacity < 1,
      opacity: opacity,
    };

    const mapSrc = resolve("--texture-map", parseUrl, "");
    const normalMapSrc = resolve("--texture-normal", parseUrl, "");
    const roughnessMapSrc = resolve("--texture-roughness", parseUrl, "");
    const metalnessMapSrc = resolve("--texture-metalness", parseUrl, "");
    const aoMapSrc = resolve("--texture-ao", parseUrl, "");

    const flipY = this.parseFlipY(element);
    const colorSpace = element ? readStringStyle(element, "--texture-color-space", "") : "";

    const hasMaps = !!(mapSrc || normalMapSrc || roughnessMapSrc || metalnessMapSrc || aoMapSrc);
    let finalType = type;
    if (finalType !== "standard" && hasMaps) {
      finalType = "standard";
    }

    if (finalType === "standard") {
      if (mapSrc) params.map = this.loadTexture(mapSrc, { flipY, colorSpace });
      if (normalMapSrc) params.normalMap = this.loadTexture(normalMapSrc, { flipY });
      if (roughnessMapSrc) params.roughnessMap = this.loadTexture(roughnessMapSrc, { flipY });
      if (metalnessMapSrc) params.metalnessMap = this.loadTexture(metalnessMapSrc, { flipY });
      if (aoMapSrc) params.aoMap = this.loadTexture(aoMapSrc, { flipY });

      params.metalness = metalness;
      params.roughness = roughness;
      params.emissive = emissive;

      return this.engine.createMeshStandardMaterial(params);
    }

    return this.engine.createMeshBasicMaterial(params);
  }

  private tryCreateCustomMaterial(
    type: string,
    element: HTMLElement | null,
    style: CSSStyleDeclaration | null,
    object?: StringObject
  ): I3DMaterial | null {
    const definition = String3DCustomMaterialRegistry.get(type);
    if (!definition) {
      return null;
    }

    const factory = this.engine.getMaterialFactory?.();
    if (!factory) {
      return null;
    }
    if (!factory.supports(definition)) {
      return null;
    }

    let initialUniforms: Record<string, any> = {};
    if (element && style) {
      initialUniforms = factory.parseUniformsFromCSS(definition, element, style);
    }

    const instance = factory.create(definition, initialUniforms);

    if (object) {
      this._materialInstances.set(object.id, instance);
    }

    return instance.material;
  }

  public updateMaterialUniforms(objectId: string, uniforms: Record<string, any>): void {
    const instance = this._materialInstances.get(objectId);
    if (instance) {
      instance.update(uniforms);
    }
  }

  public getMaterialInstance(objectId: string): IMaterialInstance | undefined {
    return this._materialInstances.get(objectId);
  }

  public recreateMaterialForObject(object: String3DObject, element: HTMLElement | null): void {
    const oldInstance = this._materialInstances.get(object.id);
    if (oldInstance && oldInstance.dispose) {
      oldInstance.dispose();
    }
    this._materialInstances.delete(object.id);

    let stringObject: StringObject | undefined;
    for (const [id, el] of this._elementMap) {
      if (id === object.id && el === element) {
        stringObject = (el as any).__stringObject || (el as any).stringObject;
        break;
      }
    }

    const newMaterial = this.createMaterialFromElement(element, stringObject);

    if (object.object && object.object.traverse) {
      object.object.traverse((child: any) => {
        if (child.material) {
          if (child.material.dispose) {
            child.material.dispose();
          }
          child.material = newMaterial;
        }
      });
    }

    object.material = newMaterial;
  }

  private loadTexture(src: string, options: { flipY?: boolean; colorSpace?: string } = {}): any {
    const textureLoader = this.engine.createTextureLoader();
    const texture = textureLoader.load(src);
    if (typeof options.flipY === "boolean") {
      texture.flipY = options.flipY;
    }
    const colorSpace = (options.colorSpace || "").toLowerCase().trim();
    if (colorSpace && "colorSpace" in texture) {
      texture.colorSpace = colorSpace === "srgb" ? "srgb" : "linear";
    }
    texture.needsUpdate = true;
    return texture;
  }

  private parseFlipY(element?: HTMLElement | null): boolean | undefined {
    const value = element ? readStringStyle(element, "--texture-flip-y", "") : "";
    if (value === undefined || value === null || value === "") return undefined;
    if (typeof value === "boolean") return value;
    const normalized = String(value).toLowerCase().trim();
    if (normalized === "false" || normalized === "0" || normalized === "no") return false;
    if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
    return undefined;
  }

  private shouldOverrideModelMaterial(element: HTMLElement): boolean {
    const style = getComputedStyle(element);
    const hasStyle = (prop: string) => {
      const val = style.getPropertyValue(prop);
      return val && val !== "0" && val !== "none" && val !== "";
    };

    if (hasStyle("--material-color") || hasStyle("--texture-map")) return true;

    const cssVars = [
      "--material-type",
      "--material-metalness",
      "--material-roughness",
      "--material-emissive",
      "--opacity",
      "--texture-normal",
      "--texture-roughness",
      "--texture-metalness",
      "--texture-ao",
    ];
    return cssVars.some((prop) => hasStyle(prop));
  }

  private applyModelTextureRemap(loader: any, element: HTMLElement): void {
    const baseRaw = (element.getAttribute("string-3d-model-texture-base") || "").trim();
    const base = baseRaw ? baseRaw.replace(/\/?$/, "/") : "";
    const mappingRaw = element.getAttribute("string-3d-model-textures");
    let mapping: Record<string, string> | null = null;

    if (mappingRaw) {
      try {
        mapping = JSON.parse(mappingRaw);
      } catch (error) {}
    }

    const manager = loader?.manager;
    if (!manager || typeof manager.setURLModifier !== "function") {
      return;
    }

    manager.setURLModifier((url: string) => {
      const mapped = mapping && url in mapping ? mapping[url] : url;
      if (!base) return mapped;
      if (/^(blob:|data:|https?:|file:|\/)/i.test(mapped)) return mapped;
      return base + mapped.replace(/^\.?\//, "");
    });
  }

  public destroy(): void {
    this._materialInstances.forEach((instance) => instance.dispose());
    this._materialInstances.clear();
    this._objects.forEach((obj) => obj.destroy());
    this._objects.clear();
    this._rootObjects = [];
  }
}
