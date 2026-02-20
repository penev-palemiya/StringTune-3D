import { I3DEngine, I3DEngineCapabilities, I3DPostProcessRuntime, I3DRenderer } from "./I3DEngine";

const DEFAULT_CAPABILITIES: I3DEngineCapabilities = {
  renderTargets: false,
  shaderMaterials: false,
  postProcess: false,
  customMaterialFactory: false,
  particles: false,
  text: false,
  geometrySimplify: false,
};

export function resolveEngineCapabilities(engine: I3DEngine): I3DEngineCapabilities {
  const reported = engine.getCapabilities?.();
  if (reported) {
    return {
      ...DEFAULT_CAPABILITIES,
      ...reported,
    };
  }

  const inferred: I3DEngineCapabilities = {
    renderTargets: typeof engine.createRenderTarget === "function",
    shaderMaterials: typeof engine.createShaderMaterial === "function",
    postProcess:
      typeof engine.createRenderTarget === "function" &&
      typeof engine.createShaderMaterial === "function",
    customMaterialFactory: typeof engine.getMaterialFactory === "function",
    particles: typeof engine.createParticleSystem === "function",
    text: typeof engine.createTextGeometry === "function" || typeof engine.loadFont === "function",
    geometrySimplify: typeof engine.simplifyGeometry === "function",
  };

  return inferred;
}

export function canUsePostProcessing(engine: I3DEngine, renderer: I3DRenderer): boolean {
  return !!resolvePostProcessRuntime(engine, renderer);
}

export function resolvePostProcessRuntime(
  engine: I3DEngine,
  renderer: I3DRenderer,
): I3DPostProcessRuntime | null {
  const explicit = engine.getPostProcessRuntime?.();
  if (explicit && explicit.isSupported(renderer)) {
    return explicit;
  }

  const capabilities = resolveEngineCapabilities(engine);
  if (!capabilities.postProcess || !capabilities.renderTargets || !capabilities.shaderMaterials) {
    return null;
  }

  if (
    typeof engine.createRenderTarget !== "function" ||
    typeof engine.createShaderMaterial !== "function" ||
    typeof renderer.setRenderTarget !== "function"
  ) {
    return null;
  }

  return {
    isSupported: () => true,
    createRenderTarget: (width: number, height: number, options?: any) =>
      engine.createRenderTarget!(width, height, options),
    createShaderMaterial: (params?: any) => engine.createShaderMaterial!(params),
    setRenderTarget: (activeRenderer: I3DRenderer, target: any) => {
      activeRenderer.setRenderTarget?.(target);
    },
    clear: (activeRenderer: I3DRenderer, color = true, depth = true, stencil = true) => {
      activeRenderer.clear?.(color, depth, stencil);
    },
  };
}
