export { String3D } from "./modules/String3D";
export type { String3DOptions } from "./modules/String3D";

export type {
  I3DEngine,
  I3DVector3,
  I3DVector2,
  I3DQuaternion,
  I3DEuler,
  I3DMatrix4,
  I3DBox3,
  I3DObject,
  I3DMesh,
  I3DGeometry,
  I3DMaterial,
  I3DLight,
  I3DCamera,
  I3DPerspectiveCamera,
  I3DOrthographicCamera,
  I3DScene,
  I3DRenderer,
  I3DTextureLoader,
  I3DModelLoader,
} from "./core/abstractions/I3DEngine";

export type { CameraMode } from "./core/String3DCamera";
export type { I3DEngineProvider } from "./core/abstractions/I3DEngineProvider";

export { String3DCamera } from "./core/String3DCamera";
export { String3DRenderer } from "./core/String3DRenderer";
export { String3DScene } from "./core/String3DScene";
export { String3DObject } from "./core/String3DObject";
export { String3DSynchronizer } from "./core/synchronizer/String3DSynchronizer";

export { ThreeJSProvider, ThreeJSEngine } from "./adapters/ThreeJSProvider";
