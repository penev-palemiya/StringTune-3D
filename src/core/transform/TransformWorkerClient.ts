export type TransformWorkerInput = {
  id: string;
  type: string;
  rectLeft: number;
  rectTop: number;
  rectWidth: number;
  rectHeight: number;
  translateZ: number;
  scale: number;
  scaleZ: number;
  rotateX: number;
  rotateY: number;
  rotateZ: number;
  parentScale: number;
  modelSizeX?: number;
  modelSizeY?: number;
  modelScale?: number;
  fitMode?: string;
};

export type TransformWorkerCamera = {
  mode: "orthographic" | "perspective";
  width: number;
  height: number;
  cameraZ: number;
  fov: number;
  aspect: number;
};

export type TransformWorkerResult = {
  id: string;
  posX: number;
  posY: number;
  posZ: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
};

export type TransformWorkerJobResult = {
  frameId: number;
  results: TransformWorkerResult[];
};

export type TransformWorkerOptions = {
  wasmUrl?: string;
};

const WORKER_SOURCE = `
let wasm = null;
let wasmReady = false;

function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

function computeTransform(item, camera) {
  const centerX = item.rectLeft + item.rectWidth / 2;
  const centerY = item.rectTop + item.rectHeight / 2;

  let posX = 0;
  let posY = 0;
  let posZ = item.translateZ;

  if (camera.mode === "orthographic") {
    posX = centerX - camera.width / 2;
    posY = -(centerY - camera.height / 2);
  } else {
    const fov = degToRad(camera.fov);
    const distance = Math.abs(item.translateZ - camera.cameraZ);
    const height = 2 * Math.tan(fov / 2) * distance;
    const width = height * camera.aspect;
    const normalizedX = centerX / camera.width;
    const normalizedY = centerY / camera.height;
    posX = (normalizedX - 0.5) * width;
    posY = -(normalizedY - 0.5) * height;
  }

  const rotX = -degToRad(item.rotateX);
  const rotY = degToRad(item.rotateY);
  const rotZ = -degToRad(item.rotateZ);

  let scaleX = 1;
  let scaleY = 1;
  let scaleZ = 1;

  if (item.type === "group") {
    scaleX = item.scale;
    scaleY = item.scale;
    scaleZ = item.scale;
  } else {
    const targetWidth = item.rectWidth * item.scale;
    const targetHeight = item.rectHeight * item.scale;
    const parentScale = item.parentScale || 1;
    const cssScaleZ = item.scaleZ || 1;

    if (item.type === "box" || item.type === "sphere") {
      const uniformSize = Math.min(targetWidth, targetHeight);
      scaleX = uniformSize * parentScale;
      scaleY = uniformSize * parentScale;
      scaleZ = uniformSize * cssScaleZ * parentScale;
    } else if (item.type === "model") {
      const sizeX = item.modelSizeX || 0;
      const sizeY = item.modelSizeY || 0;
      const fitMode = (item.fitMode || "contain").toLowerCase().trim();
      const modelScale = Number.isFinite(item.modelScale) ? item.modelScale : 1;

      if (sizeX > 0 && sizeY > 0) {
        const scaleToWidth = targetWidth / sizeX;
        const scaleToHeight = targetHeight / sizeY;
        const uniformScale = fitMode === "cover"
          ? Math.max(scaleToWidth, scaleToHeight)
          : Math.min(scaleToWidth, scaleToHeight);
        scaleX = uniformScale * modelScale * parentScale;
        scaleY = uniformScale * modelScale * parentScale;
        scaleZ = uniformScale * modelScale * cssScaleZ * parentScale;
      } else {
        const fallbackSize = Math.min(targetWidth, targetHeight);
        scaleX = fallbackSize * modelScale * parentScale;
        scaleY = fallbackSize * modelScale * parentScale;
        scaleZ = fallbackSize * modelScale * cssScaleZ * parentScale;
      }
    } else if (item.type === "cylinder") {
      const cylRadius = targetWidth;
      scaleX = cylRadius * parentScale;
      scaleY = targetHeight * parentScale;
      scaleZ = cylRadius * cssScaleZ * parentScale;
    } else {
      scaleX = targetWidth * parentScale;
      scaleY = targetHeight * parentScale;
      scaleZ = Math.min(targetWidth, targetHeight) * 0.5 * cssScaleZ * parentScale;
    }
  }

  return {
    id: item.id,
    posX,
    posY,
    posZ,
    rotX,
    rotY,
    rotZ,
    scaleX,
    scaleY,
    scaleZ,
  };
}

async function initWasm(url) {
  try {
    const res = await fetch(url);
    const bytes = await res.arrayBuffer();
    const mod = await WebAssembly.instantiate(bytes, {});
    wasm = mod.instance;
    wasmReady = true;
  } catch (error) {
    wasm = null;
    wasmReady = false;
  }
}

self.onmessage = async (event) => {
  const data = event.data || {};
  if (data.type === "init") {
    if (data.wasmUrl) {
      await initWasm(data.wasmUrl);
    }
    self.postMessage({ type: "ready", wasmReady });
    return;
  }

  if (data.type === "compute") {
    const items = data.items || [];
    const camera = data.camera || {};
    const results = new Array(items.length);
    for (let i = 0; i < items.length; i += 1) {
      results[i] = computeTransform(items[i], camera);
    }
    self.postMessage({ type: "result", frameId: data.frameId, results });
  }
};
`;

export class TransformWorkerClient {
  private worker: Worker | null = null;
  private ready = false;
  private lastResult: TransformWorkerJobResult | null = null;
  private pending = false;

  constructor(options: TransformWorkerOptions = {}) {
    if (typeof Worker === "undefined") return;
    const blob = new Blob([WORKER_SOURCE], { type: "text/javascript" });
    this.worker = new Worker(URL.createObjectURL(blob));
    this.worker.onmessage = (event) => {
      const data = event.data || {};
      if (data.type === "ready") {
        this.ready = true;
        return;
      }
      if (data.type === "result") {
        this.lastResult = {
          frameId: typeof data.frameId === "number" ? data.frameId : 0,
          results: data.results || [],
        };
        this.pending = false;
      }
    };
    this.worker.postMessage({ type: "init", wasmUrl: options.wasmUrl });
  }

  public isReady(): boolean {
    return this.ready;
  }

  public isPending(): boolean {
    return this.pending;
  }

  public submit(
    items: TransformWorkerInput[],
    camera: TransformWorkerCamera,
    frameId: number
  ): void {
    if (!this.worker || !this.ready || this.pending) return;
    this.pending = true;
    this.worker.postMessage({
      type: "compute",
      frameId,
      items,
      camera,
    });
  }

  public takeLastResult(): TransformWorkerJobResult | null {
    const result = this.lastResult;
    this.lastResult = null;
    return result;
  }

  public destroy(): void {
    this.worker?.terminate();
    this.worker = null;
    this.ready = false;
    this.pending = false;
    this.lastResult = null;
  }
}
