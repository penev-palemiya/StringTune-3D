export interface I3DVector3 {
  x: number;
  y: number;
  z: number;
  set(x: number, y: number, z: number): this;
  copy(v: I3DVector3): this;
  clone(): I3DVector3;
  setFromMatrixPosition(m: I3DMatrix4): this;
  lengthSq(): number;
}

export interface I3DVector2 {
  x: number;
  y: number;
  set(x: number, y: number): this;
  copy(v: I3DVector2): this;
  clone(): I3DVector2;
}

export interface I3DQuaternion {
  x: number;
  y: number;
  z: number;
  w: number;
  copy(q: I3DQuaternion): this;
  clone(): I3DQuaternion;
}

export interface I3DEuler {
  x: number;
  y: number;
  z: number;
  order: string;
  copy(e: I3DEuler): this;
  clone(): I3DEuler;
}

export interface I3DMatrix4 {
  decompose(position: I3DVector3, quaternion: I3DQuaternion, scale: I3DVector3): void;
  clone(): I3DMatrix4;
}

export interface I3DBox3 {
  min: I3DVector3;
  max: I3DVector3;
  setFromObject(object: I3DObject): this;
  getSize(target: I3DVector3): I3DVector3;
  clone(): I3DBox3;
}

export interface I3DObject {
  position: I3DVector3;
  rotation: I3DEuler;
  quaternion: I3DQuaternion;
  scale: I3DVector3;
  matrix: I3DMatrix4;
  matrixWorld: I3DMatrix4;
  visible?: boolean;
  add(object: I3DObject): this;
  remove(object: I3DObject): this;
  updateMatrix(): void;
  updateMatrixWorld(force?: boolean): void;
  traverse?(callback: (object: any) => void): void;
}

export interface I3DMesh extends I3DObject {
  geometry: I3DGeometry;
  material: I3DMaterial | I3DMaterial[];
  castShadow: boolean;
  receiveShadow: boolean;
}

export interface I3DGeometry {
  dispose(): void;
  computeBoundingBox(): void;
  boundingBox: I3DBox3 | null;
}

export interface I3DMaterial {
  dispose(): void;
  opacity?: number;
  transparent?: boolean;
}

export interface I3DRenderTarget {
  texture: any;
  width: number;
  height: number;
  setSize(width: number, height: number): void;
  dispose(): void;
}

export type ParticleMode = "emitter" | "instanced";

export type ParticleSystemConfig = {
  mode: ParticleMode;
  count: number;
  size: number;
  color: string;
  opacity: number;
  spread: number;
  spreadX: number;
  spreadY: number;
  seed: number;
  emitRate: number;
  emitBurst: number;
  particleLife: number;
  particleSpeed: number;
  particleDirection: [number, number, number];
  particleGravity: [number, number, number];
  particleDrag: number;
  particleSizeVariation: number;
  particleColorVariation: number;
  particleShape: "box" | "sphere" | "model";
  particleModelUrl: string;
  particleModelLoader: string;
  particleModelNode: string;
  instanceShape: "box" | "sphere" | "model";
  instanceModelUrl: string;
  instanceModelLoader: string;
  instanceModelNode: string;
  instanceScale: number;
  instanceScaleVariation: number;
  instanceRotationSpeed: number;
  instanceJitter: number;
  instanceFlow: number;
  instanceDisperse: number;
  instanceDisperseScatter: number;
  instanceDisperseScatterX: number;
  instanceDisperseScatterY: number;
  instanceDisperseScatterZ: number;
  modelTransitionDuration: number;
};

export interface I3DParticleSystem extends I3DObject {
  update?(dt: number): void;
  setConfig?(config: ParticleSystemConfig): void;
  setMaterial?(
    material: I3DMaterial | null,
    options?: { points?: boolean; meshes?: boolean }
  ): void;
  dispose?(): void;
}

export interface I3DLight extends I3DObject {
  color: any;
  intensity: number;
  castShadow?: boolean;
  shadow?: any;
  target?: I3DObject;
  distance?: number;
  decay?: number;
  angle?: number;
  penumbra?: number;
}

export interface I3DCamera extends I3DObject {
  aspect: number;
  updateProjectionMatrix(): void;
  lookAt(x: number, y: number, z: number): void;
}

export interface I3DPerspectiveCamera extends I3DCamera {
  fov: number;
  near: number;
  far: number;
}

export interface I3DOrthographicCamera extends I3DCamera {
  left: number;
  right: number;
  top: number;
  bottom: number;
  near: number;
  far: number;
}

export interface I3DScene extends I3DObject {
  background: any;
}

export interface I3DRenderer {
  domElement: HTMLElement;
  setSize(width: number, height: number): void;
  setPixelRatio(ratio: number): void;
  render(scene: I3DScene, camera: I3DCamera): void;
  dispose(): void;
  outputEncoding: any;
  shadowMap: { enabled: boolean; type: any };
  setRenderTarget?(target: I3DRenderTarget | null): void;
  getRenderTarget?(): I3DRenderTarget | null;
  clear?(color?: boolean, depth?: boolean, stencil?: boolean): void;
}

export interface I3DTextureLoader {
  load(url: string, onLoad?: (texture: any) => void): any;
}

export type TextGeometryOptions = {
  size: number;
  height: number;
  curveSegments: number;
  bevelEnabled: boolean;
  bevelThickness: number;
  bevelSize: number;
  bevelOffset: number;
  bevelSegments: number;
  lineHeight: number;
  letterSpacing: number;
  align: "left" | "center" | "right";
  layout?: Array<{ char: string; x: number; y: number; scale?: number }>;
};

export interface I3DModelLoader {
  load(
    url: string,
    onLoad?: (model: any) => void,
    onProgress?: (progress: any) => void,
    onError?: (error: any) => void
  ): void;
}

export interface I3DEngine {
  createVector3(x?: number, y?: number, z?: number): I3DVector3;
  createVector2(x?: number, y?: number): I3DVector2;
  createQuaternion(x?: number, y?: number, z?: number, w?: number): I3DQuaternion;
  createEuler(x?: number, y?: number, z?: number, order?: string): I3DEuler;
  createMatrix4(): I3DMatrix4;
  createBox3(min?: I3DVector3, max?: I3DVector3): I3DBox3;
  createScene(): I3DScene;
  createRenderer(options?: {
    antialias?: boolean;
    alpha?: boolean;
    logarithmicDepthBuffer?: boolean;
  }): I3DRenderer;
  createPerspectiveCamera(
    fov?: number,
    aspect?: number,
    near?: number,
    far?: number
  ): I3DPerspectiveCamera;
  createOrthographicCamera(
    left: number,
    right: number,
    top: number,
    bottom: number,
    near?: number,
    far?: number
  ): I3DOrthographicCamera;
  createGroup(): I3DObject;
  createMesh(geometry: I3DGeometry, material: I3DMaterial): I3DMesh;
  createBoxGeometry(width: number, height: number, depth: number): I3DGeometry;
  createSphereGeometry(
    radius: number,
    widthSegments?: number,
    heightSegments?: number
  ): I3DGeometry;
  createPlaneGeometry(width: number, height: number): I3DGeometry;
  createCylinderGeometry(
    radiusTop: number,
    radiusBottom: number,
    height: number,
    segments?: number
  ): I3DGeometry;
  createMeshBasicMaterial(params?: any): I3DMaterial;
  createMeshStandardMaterial(params?: any): I3DMaterial;
  createShaderMaterial?(params?: any): I3DMaterial;
  createPointLight(
    color?: string | number,
    intensity?: number,
    distance?: number,
    decay?: number
  ): I3DLight;
  createSpotLight(
    color?: string | number,
    intensity?: number,
    distance?: number,
    angle?: number,
    penumbra?: number,
    decay?: number
  ): I3DLight;
  createHemisphereLight(
    skyColor?: string | number,
    groundColor?: string | number,
    intensity?: number
  ): I3DLight;
  createAmbientLight(color?: string | number, intensity?: number): I3DLight;
  createDirectionalLight(color?: string | number, intensity?: number): I3DLight;
  createTextureLoader(): I3DTextureLoader;
  createModelLoader(type: string): I3DModelLoader;
  createRenderTarget?(width: number, height: number, options?: any): I3DRenderTarget;
  getMaterialFactory?(): import("../materials").IMaterialFactory | null;
  createParticleSystem?(config: ParticleSystemConfig): I3DParticleSystem;
  loadFont?(url: string): Promise<any>;
  createTextGeometry?(text: string, font: any, options: TextGeometryOptions): I3DGeometry | null;
  simplifyGeometry?(geometry: I3DGeometry, quality: number): I3DGeometry | null;
  degToRad(degrees: number): number;
  radToDeg(radians: number): number;
  computeBoundingBoxRecursively(object: I3DObject): I3DBox3;
}
