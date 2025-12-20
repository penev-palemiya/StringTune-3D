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
  I3DLight,
  I3DTextureLoader,
  I3DModelLoader,
} from "../core/abstractions/I3DEngine";
import { I3DEngineProvider } from "../core/abstractions/I3DEngineProvider";

export class ThreeJSEngine implements I3DEngine {
  private THREE: any;
  private loaders: Record<string, any>;

  constructor(THREE: any, loaders: Record<string, any> = {}) {
    this.THREE = THREE;
    this.loaders = loaders;
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

  createPointLight(color?: string | number, intensity = 1, distance = 0, decay = 2): I3DLight {
    return new this.THREE.PointLight(color, intensity, distance, decay);
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
