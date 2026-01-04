import {
  I3DEngine,
  I3DObject,
  I3DMaterial,
  I3DGeometry,
  I3DQuaternion,
  I3DVector3,
  I3DEuler,
  I3DMatrix4,
  I3DBox3,
} from "./abstractions/I3DEngine";

export class String3DObject {
  public id: string;
  public type: string;
  private _object: I3DObject;
  private _material?: I3DMaterial;
  private _geometry?: I3DGeometry;
  private _texture?: any;
  private _uniforms: Record<string, { value: any }> = {};
  private _originalBoundingBox?: I3DBox3 | null;
  private _quaternion: I3DQuaternion;
  private _originalSize: I3DVector3;
  private _bbox: I3DBox3;
  public el: any;
  private _children: String3DObject[] = [];
  private _flatObjectsCache: I3DObject[] | null = null;
  private _subtreeCache: I3DObject[] | null = null;
  private engine: I3DEngine;

  public get children(): String3DObject[] {
    return this._children;
  }

  constructor(
    id: string,
    type: string,
    object: I3DObject,
    engine: I3DEngine,
    options: { material?: I3DMaterial; geometry?: I3DGeometry; texture?: any } = {}
  ) {
    this.id = id;
    this.type = type;
    this._object = object;
    this.engine = engine;
    this._material = options.material;
    this._geometry = options.geometry;
    this._texture = options.texture;
    this._quaternion = engine.createQuaternion();
    this._originalSize = engine.createVector3();
    this._bbox = engine.createBox3();
    this.updateBoundingBox();
  }

  public get object(): I3DObject {
    return this._object;
  }

  public get material(): I3DMaterial | undefined {
    return this._material;
  }

  public get originalSize(): I3DVector3 {
    return this._originalSize.clone();
  }

  public get boundingBox(): I3DBox3 {
    return this._bbox.clone();
  }

  public addChild(child: String3DObject): void {
    this._children.push(child);
    this.object.add(child.object);
    this.invalidateFlatCache();
    this.invalidateSubtreeCache();
  }

  public getWorldMatrix(): I3DMatrix4 {
    return this._object.matrixWorld.clone();
  }

  public getWorldPosition(): I3DVector3 {
    return this.engine.createVector3().setFromMatrixPosition(this._object.matrixWorld);
  }

  public getOriginalBoundingBox(): I3DBox3 {
    if (!this._originalBoundingBox) {
      const originalScale = this.object.scale.clone();
      this.object.scale.set(1, 1, 1);
      this.object.updateMatrixWorld(true);
      this._originalBoundingBox = this.engine.computeBoundingBoxRecursively(this.object);
      this.object.scale.copy(originalScale);
      this.object.updateMatrixWorld(true);
    }
    return this._originalBoundingBox!.clone();
  }

  public syncTransformFromMatrix(matrix: I3DMatrix4): void {
    const pos = this.engine.createVector3();
    const quat = this.engine.createQuaternion();
    const scale = this.engine.createVector3();
    matrix.decompose(pos, quat, scale);
    this._object.position.copy(pos);
    this._object.quaternion.copy(quat);
    this._object.scale.copy(scale);
    this._object.updateMatrix();
    this._object.updateMatrixWorld();
  }

  public applyWorldTransform(
    position: I3DVector3,
    quaternion: I3DQuaternion,
    scale: I3DVector3
  ): void {
    this._object.position.copy(position);
    this._object.quaternion.copy(quaternion);
    this._object.scale.copy(scale);
    this._object.updateMatrix();
    this._object.updateMatrixWorld();
  }

  public set quaternion(quaternion: I3DQuaternion) {
    this._quaternion.copy(quaternion);
    this._object.quaternion.copy(this._quaternion);
    this._object.updateMatrixWorld();
  }

  public set position(position: I3DVector3) {
    this._object.position.copy(position);
  }

  public set scale(scale: I3DVector3) {
    this._object.scale.copy(scale);
  }

  public set rotation(euler: I3DEuler) {
    this._object.rotation.copy(euler);
  }

  public set opacity(value: number) {
    const mat = this._object as any;
    if (mat.material && "opacity" in mat.material) {
      mat.material.opacity = value;
    }
  }

  public set metalness(value: number) {
    const mat = this._object as any;
    if (mat.material && "metalness" in mat.material) {
      mat.material.metalness = value;
    }
  }

  public set roughness(value: number) {
    const mat = this._object as any;
    if (mat.material && "roughness" in mat.material) {
      mat.material.roughness = value;
    }
  }

  public set texture(texture: any) {
    this._texture = texture;
    if ((this._object as any).isMesh && texture?.applyTexture) {
      texture.applyTexture(this._object);
    }
  }

  public set material(material: I3DMaterial | undefined) {
    this._material = material;
  }

  public set geometry(geometry: I3DGeometry | undefined) {
    this._geometry = geometry;
  }

  public updateBoundingBox(): void {
    this._bbox.setFromObject(this._object);
    this._bbox.getSize(this._originalSize);
  }

  public destroy(): void {
    this.disposeObjectResources(this._object);
    this._texture?.dispose?.();
    this._material?.dispose();
    this._geometry?.dispose();
    this._subtreeCache = null;
  }

  public getFlatObjects(): I3DObject[] {
    if (this._flatObjectsCache) return this._flatObjectsCache;
    const result: I3DObject[] = [];
    const walk = (obj: String3DObject): void => {
      result.push(obj.object);
      obj.children.forEach((child) => walk(child));
    };
    walk(this);
    this._flatObjectsCache = result;
    return result;
  }

  public getSubtreeObjects(): I3DObject[] {
    if (this._subtreeCache) return this._subtreeCache;
    const result: I3DObject[] = [];
    const anyObj = this._object as any;
    result.push(this._object);
    if (typeof anyObj.traverse === "function") {
      anyObj.traverse((child: any) => {
        if (child && child !== this._object) {
          result.push(child as I3DObject);
        }
      });
    }
    this._subtreeCache = result;
    return result;
  }

  private invalidateFlatCache(): void {
    this._flatObjectsCache = null;
  }

  private invalidateSubtreeCache(): void {
    this._subtreeCache = null;
  }

  private disposeObjectResources(object: I3DObject): void {
    const anyObj = object as any;
    if (anyObj?.geometry?.dispose) {
      anyObj.geometry.dispose();
    }
    const material = anyObj?.material;
    if (Array.isArray(material)) {
      material.forEach((mat) => mat?.dispose?.());
    } else if (material?.dispose) {
      material.dispose();
    }
    if (typeof anyObj?.traverse === "function") {
      anyObj.traverse((child: any) => {
        if (child?.geometry?.dispose) {
          child.geometry.dispose();
        }
        const childMat = child?.material;
        if (Array.isArray(childMat)) {
          childMat.forEach((mat: any) => mat?.dispose?.());
        } else if (childMat?.dispose) {
          childMat.dispose();
        }
      });
    }
  }
}
