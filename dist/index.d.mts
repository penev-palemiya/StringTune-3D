import { StringModule, StringContext, StringObject, StringData } from '@fiddle-digital/string-tune';

interface I3DVector3 {
    x: number;
    y: number;
    z: number;
    set(x: number, y: number, z: number): this;
    copy(v: I3DVector3): this;
    clone(): I3DVector3;
    setFromMatrixPosition(m: I3DMatrix4): this;
    lengthSq(): number;
}
interface I3DVector2 {
    x: number;
    y: number;
    set(x: number, y: number): this;
    copy(v: I3DVector2): this;
    clone(): I3DVector2;
}
interface I3DQuaternion {
    x: number;
    y: number;
    z: number;
    w: number;
    copy(q: I3DQuaternion): this;
    clone(): I3DQuaternion;
}
interface I3DEuler {
    x: number;
    y: number;
    z: number;
    order: string;
    copy(e: I3DEuler): this;
    clone(): I3DEuler;
}
interface I3DMatrix4 {
    decompose(position: I3DVector3, quaternion: I3DQuaternion, scale: I3DVector3): void;
    clone(): I3DMatrix4;
}
interface I3DBox3 {
    min: I3DVector3;
    max: I3DVector3;
    setFromObject(object: I3DObject): this;
    getSize(target: I3DVector3): I3DVector3;
    clone(): I3DBox3;
}
interface I3DObject {
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
interface I3DMesh extends I3DObject {
    geometry: I3DGeometry;
    material: I3DMaterial | I3DMaterial[];
    castShadow: boolean;
    receiveShadow: boolean;
}
interface I3DGeometry {
    dispose(): void;
    computeBoundingBox(): void;
    boundingBox: I3DBox3 | null;
}
interface I3DMaterial {
    dispose(): void;
    opacity?: number;
    transparent?: boolean;
}
interface I3DRenderTarget {
    texture: any;
    width: number;
    height: number;
    setSize(width: number, height: number): void;
    dispose(): void;
}
interface I3DLight extends I3DObject {
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
interface I3DCamera extends I3DObject {
    aspect: number;
    updateProjectionMatrix(): void;
    lookAt(x: number, y: number, z: number): void;
}
interface I3DPerspectiveCamera extends I3DCamera {
    fov: number;
    near: number;
    far: number;
}
interface I3DOrthographicCamera extends I3DCamera {
    left: number;
    right: number;
    top: number;
    bottom: number;
    near: number;
    far: number;
}
interface I3DScene extends I3DObject {
    background: any;
}
interface I3DRenderer {
    domElement: HTMLElement;
    setSize(width: number, height: number): void;
    setPixelRatio(ratio: number): void;
    render(scene: I3DScene, camera: I3DCamera): void;
    dispose(): void;
    outputEncoding: any;
    shadowMap: {
        enabled: boolean;
        type: any;
    };
    setRenderTarget?(target: I3DRenderTarget | null): void;
    getRenderTarget?(): I3DRenderTarget | null;
    clear?(color?: boolean, depth?: boolean, stencil?: boolean): void;
}
interface I3DTextureLoader {
    load(url: string, onLoad?: (texture: any) => void): any;
}
interface I3DModelLoader {
    load(url: string, onLoad?: (model: any) => void, onProgress?: (progress: any) => void, onError?: (error: any) => void): void;
}
interface I3DEngine {
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
    createPerspectiveCamera(fov?: number, aspect?: number, near?: number, far?: number): I3DPerspectiveCamera;
    createOrthographicCamera(left: number, right: number, top: number, bottom: number, near?: number, far?: number): I3DOrthographicCamera;
    createGroup(): I3DObject;
    createMesh(geometry: I3DGeometry, material: I3DMaterial): I3DMesh;
    createBoxGeometry(width: number, height: number, depth: number): I3DGeometry;
    createSphereGeometry(radius: number, widthSegments?: number, heightSegments?: number): I3DGeometry;
    createPlaneGeometry(width: number, height: number): I3DGeometry;
    createCylinderGeometry(radiusTop: number, radiusBottom: number, height: number, segments?: number): I3DGeometry;
    createMeshBasicMaterial(params?: any): I3DMaterial;
    createMeshStandardMaterial(params?: any): I3DMaterial;
    createShaderMaterial?(params?: any): I3DMaterial;
    createPointLight(color?: string | number, intensity?: number, distance?: number, decay?: number): I3DLight;
    createSpotLight(color?: string | number, intensity?: number, distance?: number, angle?: number, penumbra?: number, decay?: number): I3DLight;
    createHemisphereLight(skyColor?: string | number, groundColor?: string | number, intensity?: number): I3DLight;
    createAmbientLight(color?: string | number, intensity?: number): I3DLight;
    createDirectionalLight(color?: string | number, intensity?: number): I3DLight;
    createTextureLoader(): I3DTextureLoader;
    createModelLoader(type: string): I3DModelLoader;
    createRenderTarget?(width: number, height: number, options?: any): I3DRenderTarget;
    degToRad(degrees: number): number;
    radToDeg(radians: number): number;
    computeBoundingBoxRecursively(object: I3DObject): I3DBox3;
}

interface I3DEngineProvider {
    getEngine(): I3DEngine;
    getName(): string;
}

interface String3DOptions {
    hideHTML?: boolean;
    container?: string | HTMLElement;
    zIndex?: number;
    modelLoaderType?: string;
    modelLoader?: I3DModelLoader;
    modelLoaderFactory?: (engine: I3DEngine, type?: string) => I3DModelLoader;
    useDirtySync?: boolean;
    useTransformWorker?: boolean;
    transformWorkerWasmUrl?: string;
}
declare class String3D extends StringModule {
    private static provider;
    private renderer;
    private camera;
    private scene;
    private synchronizer;
    private engine;
    private canvasContainer;
    private isLoading;
    private options;
    private useDirtySync;
    private dirtyElements;
    private observedElements;
    private resizeObserver;
    private mutationObserver;
    private lastSyncData;
    private transformWorker;
    private workerHasResult;
    private workerObjectMap;
    private domVersion;
    private lastSubmittedVersion;
    private scrollTicking;
    private onScrollBound;
    private filterStates;
    private filterWarnings;
    static setProvider(provider: I3DEngineProvider): void;
    constructor(context: StringContext);
    canConnect(object: StringObject): boolean;
    initializeObject(globalId: number, object: StringObject, element: HTMLElement, attributes: Record<string, any>): void;
    onResize(): void;
    onInit(): void;
    onSettingsChange(): void;
    private buildOptionsFromSettings;
    private getSettingValue;
    private resolveModelLoader;
    private resolveModelLoaderFactory;
    private createOrGetContainer;
    private applyContainerStyles;
    onObjectConnected(object: StringObject): void;
    onFrame(data: StringData): void;
    private syncRecursive;
    private injectCSS;
    private registerTypedProperties;
    private setupObservers;
    private setupScrollListeners;
    private removeScrollListeners;
    private handleScroll;
    private observeElement;
    private observeSceneElements;
    private observeRecursive;
    private markDirty;
    private markAllDirty;
    private readNumberStyle;
    private readFilterRaw;
    private parseFilterChain;
    private warnFilterIssues;
    private readFilterChain;
    private collectFilterTargets;
    private stringifyFilterChain;
    private getFilterTransition;
    private splitTransitionList;
    private findTransitionIndex;
    private parseTime;
    private parseTransitionShorthand;
    private parseEasing;
    private cubicBezier;
    private canInterpolate;
    private makeZeroChain;
    private sampleTransition;
    private getCurrentChain;
    private interpolateChain;
    private interpolateEffect;
    private isNumeric;
    private isZeroChain;
    private buildWorkerCameraData;
    private collectWorkerInputs;
    private applyWorkerResults;
    destroy(): void;
}

type CameraMode = "orthographic" | "perspective";
declare class String3DCamera {
    private scaleCache;
    private _camera;
    private _position;
    private _width;
    private _height;
    private engine;
    private mode;
    private perspectiveFov;
    constructor(engine: I3DEngine, mode?: CameraMode, fov?: number, near?: number, far?: number);
    get camera(): I3DCamera;
    resize(width: number, height: number): void;
    setPosition(x: number, y: number, z: number): void;
    lookAt(x: number, y: number, z: number): void;
    update(): void;
    screenToWorld(screenX: number, screenY: number, z?: number): I3DVector3;
    getFrustumSizeAt(z: number): {
        width: number;
        height: number;
    };
    getScaleAtZ(z: number, viewportHeight: number): number;
    clearScaleCache(): void;
    getMode(): CameraMode;
    getPerspectiveFov(): number;
    getPositionZ(): number;
}

declare class String3DObject {
    id: string;
    type: string;
    private _object;
    private _material?;
    private _geometry?;
    private _texture?;
    private _uniforms;
    private _originalBoundingBox?;
    private _quaternion;
    private _originalSize;
    private _bbox;
    el: any;
    private _children;
    private _flatObjectsCache;
    private _subtreeCache;
    private engine;
    get children(): String3DObject[];
    constructor(id: string, type: string, object: I3DObject, engine: I3DEngine, options?: {
        material?: I3DMaterial;
        geometry?: I3DGeometry;
        texture?: any;
    });
    get object(): I3DObject;
    get material(): I3DMaterial | undefined;
    get originalSize(): I3DVector3;
    get boundingBox(): I3DBox3;
    addChild(child: String3DObject): void;
    getWorldMatrix(): I3DMatrix4;
    getWorldPosition(): I3DVector3;
    getOriginalBoundingBox(): I3DBox3;
    syncTransformFromMatrix(matrix: I3DMatrix4): void;
    applyWorldTransform(position: I3DVector3, quaternion: I3DQuaternion, scale: I3DVector3): void;
    set quaternion(quaternion: I3DQuaternion);
    set position(position: I3DVector3);
    set scale(scale: I3DVector3);
    set rotation(euler: I3DEuler);
    set opacity(value: number);
    set metalness(value: number);
    set roughness(value: number);
    set texture(texture: any);
    set material(material: I3DMaterial | undefined);
    set geometry(geometry: I3DGeometry | undefined);
    updateBoundingBox(): void;
    destroy(): void;
    getFlatObjects(): I3DObject[];
    getSubtreeObjects(): I3DObject[];
    private invalidateFlatCache;
    private invalidateSubtreeCache;
    private disposeObjectResources;
}

interface String3DSceneOptions {
    modelLoader?: I3DModelLoader;
    modelLoaderFactory?: (engine: I3DEngine, type?: string) => I3DModelLoader;
}
declare class String3DScene {
    private _scene;
    private _objects;
    private _rootObjects;
    private _elementMap;
    private engine;
    private _modelLoader?;
    private _modelLoaderFactory?;
    private _modelLoaderCache;
    get rootObjects(): String3DObject[];
    constructor(engine: I3DEngine, options?: String3DSceneOptions);
    getScene(): I3DScene;
    getObject(id: string): String3DObject | undefined;
    getAllObjects(): String3DObject[];
    hasObject(id: string): boolean;
    deleteObject(id: string): boolean;
    createFromElement(object: StringObject): void;
    private createGroup;
    private createLight;
    private applyShadowProps;
    private createBox;
    private createSphere;
    private createPlane;
    private createCylinder;
    private createModel;
    private resolveModelLoader;
    private centerObject;
    private getBoxCenter;
    private createMaterialFromObject;
    private createMaterialFromElement;
    private loadTexture;
    private parseFlipY;
    private shouldOverrideModelMaterial;
    private applyModelTextureRemap;
    destroy(): void;
}

type String3DFilterEffect = {
    type: "blur";
    amount: number;
} | {
    type: "pixel";
    size: number;
} | {
    type: "bloom";
    intensity: number;
    threshold: number;
} | {
    type: "brightness";
    amount: number;
} | {
    type: "contrast";
    amount: number;
} | {
    type: "saturate";
    amount: number;
} | {
    type: "grayscale";
    amount: number;
} | {
    type: "sepia";
    amount: number;
} | {
    type: "invert";
    amount: number;
} | {
    type: "hue-rotate";
    angle: number;
} | {
    type: "custom";
    name: string;
    uniforms: Record<string, any>;
};
type String3DFilterChain = String3DFilterEffect[];
type String3DFilterTarget = {
    object: String3DObject;
    effects: String3DFilterChain;
    effectsKey: string;
    dirty: boolean;
};

declare class String3DRenderer {
    private _container;
    private _renderer;
    private _width;
    private _height;
    private engine;
    private filterPipeline;
    private filterCache;
    private frameId;
    private lastFrameTime;
    private avgFrameMs;
    private qualityScale;
    private lastQualityChange;
    private filterLayer;
    constructor(container: HTMLElement, engine: I3DEngine);
    attach(): void;
    render(scene: String3DScene, camera: String3DCamera, filterTargets?: String3DFilterTarget[]): void;
    resize(camera: String3DCamera): void;
    get width(): number;
    get height(): number;
    get renderer(): I3DRenderer;
    destroy(): void;
    private ensureFilterPipeline;
    private canCreateFilterPipeline;
    private collectSubtreeObjects;
    private setVisible;
    private getFilterCenter;
    private injectEffectContext;
    private updateQuality;
    private invalidateFilterCache;
    private evictCache;
    private supportsLayers;
    private hasLayers;
    private applyLayerMask;
    private restoreLayerMask;
    private setCameraLayer;
    private restoreCameraLayer;
}

declare class String3DSynchronizer {
    camera: String3DCamera;
    viewportWidth: number;
    viewportHeight: number;
    engine: I3DEngine;
    private strategies;
    constructor(camera: String3DCamera, viewportWidth: number, viewportHeight: number, engine: I3DEngine);
    syncElement(el: HTMLElement, object: String3DObject, parentData: any): any;
    updateViewportSize(width: number, height: number): void;
}

type String3DCustomFilterDefinition = {
    name: string;
    fragmentShader: string;
    uniforms?: Record<string, any>;
    parse?: (args: string) => Record<string, any> | null;
};
declare class String3DCustomFilterRegistry {
    private static filters;
    static register(definition: String3DCustomFilterDefinition): void;
    static get(name: string): String3DCustomFilterDefinition | undefined;
    static has(name: string): boolean;
    static list(): String3DCustomFilterDefinition[];
}

declare class ThreeJSEngine implements I3DEngine {
    private THREE;
    private loaders;
    constructor(THREE: any, loaders?: Record<string, any>);
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
    createPerspectiveCamera(fov?: number, aspect?: number, near?: number, far?: number): I3DPerspectiveCamera;
    createOrthographicCamera(left: number, right: number, top: number, bottom: number, near?: number, far?: number): I3DOrthographicCamera;
    createGroup(): I3DObject;
    createMesh(geometry: I3DGeometry, material: I3DMaterial): I3DMesh;
    createBoxGeometry(width: number, height: number, depth: number): I3DGeometry;
    createSphereGeometry(radius: number, widthSegments?: number, heightSegments?: number): I3DGeometry;
    createPlaneGeometry(width: number, height: number): I3DGeometry;
    createCylinderGeometry(radiusTop: number, radiusBottom: number, height: number, segments?: number): I3DGeometry;
    createMeshBasicMaterial(params?: any): I3DMaterial;
    createMeshStandardMaterial(params?: any): I3DMaterial;
    createShaderMaterial(params?: any): I3DMaterial;
    createPointLight(color?: string | number, intensity?: number, distance?: number, decay?: number): I3DLight;
    createSpotLight(color?: string | number, intensity?: number, distance?: number, angle?: number, penumbra?: number, decay?: number): I3DLight;
    createHemisphereLight(skyColor?: string | number, groundColor?: string | number, intensity?: number): I3DLight;
    createAmbientLight(color?: string | number, intensity?: number): I3DLight;
    createDirectionalLight(color?: string | number, intensity?: number): I3DLight;
    createTextureLoader(): I3DTextureLoader;
    createModelLoader(type: string): I3DModelLoader;
    createRenderTarget(width: number, height: number, options?: any): I3DRenderTarget;
    degToRad(degrees: number): number;
    radToDeg(radians: number): number;
    computeBoundingBoxRecursively(object: I3DObject): I3DBox3;
}
declare class ThreeJSProvider implements I3DEngineProvider {
    private engine;
    constructor(THREE: any, loaders?: Record<string, any>);
    getEngine(): I3DEngine;
    getName(): string;
}

export { type CameraMode, type I3DBox3, type I3DCamera, type I3DEngine, type I3DEngineProvider, type I3DEuler, type I3DGeometry, type I3DLight, type I3DMaterial, type I3DMatrix4, type I3DMesh, type I3DModelLoader, type I3DObject, type I3DOrthographicCamera, type I3DPerspectiveCamera, type I3DQuaternion, type I3DRenderTarget, type I3DRenderer, type I3DScene, type I3DTextureLoader, type I3DVector2, type I3DVector3, String3D, String3DCamera, type String3DCustomFilterDefinition, String3DCustomFilterRegistry, String3DObject, type String3DOptions, String3DRenderer, String3DScene, String3DSynchronizer, ThreeJSEngine, ThreeJSProvider };
