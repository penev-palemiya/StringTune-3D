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

export interface String3DSceneOptions {
  modelLoader?: I3DModelLoader;
  modelLoaderFactory?: (engine: I3DEngine, type?: string) => I3DModelLoader;
}

export class String3DScene {
  private _scene: I3DScene;
  private _objects: Map<string, String3DObject> = new Map();
  private _rootObjects: String3DObject[] = [];
  private _elementMap: Map<string, HTMLElement> = new Map();
  private engine: I3DEngine;
  private _modelLoader?: I3DModelLoader;
  private _modelLoaderFactory?: (engine: I3DEngine, type?: string) => I3DModelLoader;
  private _modelLoaderCache: Map<string, I3DModelLoader> = new Map();

  public get rootObjects(): String3DObject[] {
    return this._rootObjects;
  }

  constructor(engine: I3DEngine, options: String3DSceneOptions = {}) {
    this.engine = engine;
    this._modelLoader = options.modelLoader;
    this._modelLoaderFactory = options.modelLoaderFactory;
    this._scene = engine.createScene();
  }

  public getScene(): I3DScene {
    return this._scene;
  }

  public getObject(id: string): String3DObject | undefined {
    return this._objects.get(id);
  }

  public hasObject(id: string): boolean {
    return this._objects.has(id);
  }

  public deleteObject(id: string): boolean {
    const obj = this._objects.get(id);
    if (obj) {
      this._scene.remove(obj.object);
      this._objects.delete(id);
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
    kind: "point" | "ambient" | "directional",
    onAdd: (obj: String3DObject) => void
  ): String3DObject {
    const color = object.getProperty<string>("3d-color") || "#ffffff";
    const intensity = object.getProperty<number>("3d-intensity") ?? 1;

    let light: I3DLight;
    if (kind === "point") {
      const distance = object.getProperty<number>("3d-distance") ?? 1000;
      const decay = object.getProperty<number>("3d-decay") ?? 0;
      light = this.engine.createPointLight(color, intensity, distance, decay);
    } else if (kind === "directional") {
      light = this.engine.createDirectionalLight(color, intensity);
    } else {
      light = this.engine.createAmbientLight(color, intensity);
    }

    const obj = new String3DObject(object.id, kind + "Light", light, this.engine);
    onAdd(obj);
    return obj;
  }

  private createBox(object: StringObject, onAdd: (obj: String3DObject) => void): String3DObject {
    const geometry = this.engine.createBoxGeometry(1, 1, 1);
    const material = this.createMaterialFromObject(object);
    const mesh = this.engine.createMesh(geometry, material);
    const obj = new String3DObject(object.id, "box", mesh, this.engine, {
      geometry,
      material,
    });
    onAdd(obj);
    return obj;
  }

  private createSphere(object: StringObject, onAdd: (obj: String3DObject) => void): String3DObject {
    const widthSegments = object.getProperty<number>("3d-segments-width") ?? 32;
    const heightSegments = object.getProperty<number>("3d-segments-height") ?? 32;
    const geometry = this.engine.createSphereGeometry(0.5, widthSegments, heightSegments);
    const material = this.createMaterialFromObject(object);
    const mesh = this.engine.createMesh(geometry, material);
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
    const segments = object.getProperty<number>("3d-segments") ?? 32;
    const geometry = this.engine.createCylinderGeometry(0.5, 0.5, 1, segments);
    const material = this.createMaterialFromObject(object);
    const mesh = this.engine.createMesh(geometry, material);
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
      console.warn("[String3D] Model loader not configured");
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
          console.warn("[String3D] Model loader returned empty result");
          return;
        }
        if (element && this.shouldOverrideModelMaterial(element)) {
          const material = this.createMaterialFromElement(element, object);
          if (typeof root.traverse === "function") {
            root.traverse((child: any) => {
              if (child.isMesh) {
                child.material = material;
              }
            });
          }
        }
        if (shouldCenter) {
          this.centerObject(root);
        }
        const obj = new String3DObject(object.id, "model", root, this.engine);
        onAdd(obj);
      },
      (xhr: any) => {
        console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
      },
      (error: any) => {
        console.error("[String3D] Model loading error:", error);
      }
    );
  }

  private resolveModelLoader(type?: string): I3DModelLoader | undefined {
    if (type) {
      if (this._modelLoaderCache.has(type)) {
        return this._modelLoaderCache.get(type);
      }
      if (!this._modelLoaderFactory) {
        console.warn(`[String3D] No model loader factory for type "${type}"`);
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
    const attr = object?.getProperty<string>("3d-material") || "basic[#ffffff]";
    let [type, colorRaw] = attr.split(/\[|\]/);
    const color = colorRaw || "#ffffff";
    const opacity = object?.getProperty<number>("3d-opacity") ?? 1;
    const metalness = object?.getProperty<number>("3d-metalness");
    const roughness = object?.getProperty<number>("3d-roughness");
    const params: any = {
      color,
      transparent: opacity < 1,
      opacity: opacity,
    };

    const mapSrc = element?.getAttribute("string-3d-map");
    const normalMapSrc = element?.getAttribute("string-3d-normalMap");
    const roughnessMapSrc = element?.getAttribute("string-3d-roughnessMap");
    const metalnessMapSrc = element?.getAttribute("string-3d-metalnessMap");
    const aoMapSrc = element?.getAttribute("string-3d-aoMap");
    const flipY = this.parseFlipY(object, element);
    const colorSpace =
      object?.getProperty<string>("3d-colorSpace") ||
      element?.getAttribute("string-3d-colorSpace") ||
      "";

    const hasMaps = !!(
      mapSrc ||
      normalMapSrc ||
      roughnessMapSrc ||
      metalnessMapSrc ||
      aoMapSrc
    );
    if (type !== "standard" && hasMaps) {
      type = "standard";
    }

    if (type === "standard") {
      if (mapSrc) {
        params.map = this.loadTexture(mapSrc, { flipY, colorSpace });
      }
      if (normalMapSrc) params.normalMap = this.loadTexture(normalMapSrc, { flipY });
      if (roughnessMapSrc) params.roughnessMap = this.loadTexture(roughnessMapSrc, { flipY });
      if (metalnessMapSrc) params.metalnessMap = this.loadTexture(metalnessMapSrc, { flipY });
      if (aoMapSrc) params.aoMap = this.loadTexture(aoMapSrc, { flipY });
      if (typeof metalness === "number") params.metalness = metalness;
      if (typeof roughness === "number") params.roughness = roughness;
      return this.engine.createMeshStandardMaterial(params);
    }

    return this.engine.createMeshBasicMaterial(params);
  }

  private loadTexture(
    src: string,
    options: { flipY?: boolean; colorSpace?: string } = {}
  ): any {
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

  private parseFlipY(object?: StringObject, element?: HTMLElement | null): boolean | undefined {
    const value =
      object?.getProperty<boolean>("3d-texture-flipY") ??
      element?.getAttribute("string-3d-texture-flipY");
    if (value === undefined || value === null || value === "") return undefined;
    if (typeof value === "boolean") return value;
    const normalized = String(value).toLowerCase().trim();
    if (normalized === "false" || normalized === "0" || normalized === "no") return false;
    if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
    return undefined;
  }

  private shouldOverrideModelMaterial(element: HTMLElement): boolean {
    const attrs = [
      "string-3d-material",
      "string-3d-color",
      "string-3d-opacity",
      "string-3d-map",
      "string-3d-normalMap",
      "string-3d-roughnessMap",
      "string-3d-metalnessMap",
      "string-3d-aoMap",
      "string-3d-metalness",
      "string-3d-roughness",
    ];
    return attrs.some((attr) => element.hasAttribute(attr));
  }

  private applyModelTextureRemap(loader: any, element: HTMLElement): void {
    const baseRaw = (element.getAttribute("string-3d-model-texture-base") || "").trim();
    const base = baseRaw ? baseRaw.replace(/\/?$/, "/") : "";
    const mappingRaw = element.getAttribute("string-3d-model-textures");
    let mapping: Record<string, string> | null = null;

    if (mappingRaw) {
      try {
        mapping = JSON.parse(mappingRaw);
      } catch (error) {
        console.warn("[String3D] Invalid model texture mapping JSON:", error);
      }
    }

    const manager = loader?.manager;
    if (!manager || typeof manager.setURLModifier !== "function") {
      if (mapping || base) {
        console.warn("[String3D] Model loader does not support URL remap.");
      }
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
    this._objects.forEach((obj) => obj.destroy());
    this._objects.clear();
    this._rootObjects = [];
  }
}
