# API Reference

TypeScript API documentation for StringTune-3D.

## String3D Module

Main module class that integrates with StringTune.

### Static Methods

#### `String3D.setProvider(provider)`

Set the 3D engine provider.

```typescript
import { String3D, ThreeJSProvider } from "string-tune-3d";
import * as THREE from "three";

String3D.setProvider(new ThreeJSProvider(THREE, loaders));
```

| Parameter  | Type                | Description              |
| ---------- | ------------------- | ------------------------ |
| `provider` | `I3DEngineProvider` | Engine provider instance |

#### `String3D.registerFont(name, url, options?)`

Register a font for 3D text.

```typescript
String3D.registerFont("roboto", "/fonts/roboto.json", { default: true });
```

| Parameter         | Type      | Description           |
| ----------------- | --------- | --------------------- |
| `name`            | `string`  | Font identifier       |
| `url`             | `string`  | URL to JSON font file |
| `options.default` | `boolean` | Set as default font   |

#### `String3D.setDefaultFont(name)`

Set the default font for 3D text.

```typescript
String3D.setDefaultFont("roboto");
```

---

## String3DOptions

Configuration options for the String3D module.

```typescript
interface String3DOptions {
  hideHTML?: boolean;
  container?: string | HTMLElement;
  zIndex?: number;
  modelLoaderType?: string;
  modelLoader?: I3DModelLoader;
  modelLoaderFactory?: (engine: I3DEngine, type?: string) => I3DModelLoader;
  useDirtySync?: boolean;
  styleReadIntervalMs?: number;
  layoutReadIntervalMs?: number;
}
```

| Option                 | Type                    | Default      | Description          |
| ---------------------- | ----------------------- | ------------ | -------------------- |
| `hideHTML`             | `boolean`               | `false`      | Hide HTML elements   |
| `container`            | `string \| HTMLElement` | Auto-created | Canvas container     |
| `zIndex`               | `number`                | `1`          | Canvas z-index       |
| `modelLoaderType`      | `string`                | `undefined`  | Default model loader |
| `modelLoader`          | `I3DModelLoader`        | `undefined`  | Custom model loader  |
| `modelLoaderFactory`   | `function`              | `undefined`  | Model loader factory |
| `useDirtySync`         | `boolean`               | `false`      | Enable dirty sync    |
| `styleReadIntervalMs`  | `number`                | `0`          | Style read throttle  |
| `layoutReadIntervalMs` | `number`                | `0`          | Layout read throttle |

### Usage

```typescript
stringTune.use(String3D, {
  hideHTML: false,
  container: "#canvas-container",
  zIndex: 10,
  modelLoaderType: "gltf",
  useDirtySync: true,
  styleReadIntervalMs: 16,
});
```

---

## ThreeJSProvider

Three.js engine provider.

### Constructor

```typescript
new ThreeJSProvider(THREE, loaders?)
```

| Parameter | Type     | Description          |
| --------- | -------- | -------------------- |
| `THREE`   | `object` | Three.js module      |
| `loaders` | `object` | Model loader classes |

### Loader Configuration

```typescript
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

new ThreeJSProvider(THREE, {
  gltf: GLTFLoader,
  obj: OBJLoader,
  fbx: FBXLoader,
});
```

---

## String3DCustomMaterialRegistry

Registry for custom shader materials.

### `register(definition)`

Register a custom material.

```typescript
String3DCustomMaterialRegistry.register({
  name: "hologram",
  extends: "standard",
  uniforms: { ... },
  injections: [ ... ]
});
```

### `get(name)`

Get material definition.

```typescript
const def = String3DCustomMaterialRegistry.get("hologram");
```

### `has(name)`

Check if material exists.

```typescript
if (String3DCustomMaterialRegistry.has("hologram")) { ... }
```

### `list()`

Get all registered materials.

```typescript
const materials = String3DCustomMaterialRegistry.list();
```

### `unregister(name)`

Remove a material.

```typescript
String3DCustomMaterialRegistry.unregister("hologram");
```

---

## String3DCustomMaterialDefinition

Material definition schema.

```typescript
type String3DCustomMaterialDefinition = {
  name: string;
  extends?: "basic" | "standard" | "physical" | "shader";
  vertexShader?: string;
  fragmentShader?: string;
  injections?: ShaderInjection[];
  uniforms?: Record<string, UniformDefinition>;
  properties?: {
    transparent?: boolean;
    side?: MaterialSide;
    depthWrite?: boolean;
    depthTest?: boolean;
    blending?: MaterialBlendMode;
    wireframe?: boolean;
  };
  lights?: boolean;
  parse?: (element: HTMLElement, style: CSSStyleDeclaration) => Record<string, any>;
};

type UniformDefinition = {
  type: UniformType;
  value: any;
  css?: string;
};

type UniformType =
  | "float"
  | "int"
  | "vec2"
  | "vec3"
  | "vec4"
  | "color"
  | "texture"
  | "mat3"
  | "mat4";

type ShaderInjection = {
  point: ShaderInjectionPoint;
  code: string;
  order?: number;
};

type ShaderInjectionPoint =
  | "vertex_pars"
  | "vertex_header"
  | "vertex_transform"
  | "vertex_output"
  | "fragment_pars"
  | "fragment_header"
  | "fragment_color"
  | "fragment_normal"
  | "fragment_emissive"
  | "fragment_output";

type MaterialBlendMode = "normal" | "additive" | "subtractive" | "multiply";
type MaterialSide = "front" | "back" | "double";
```

---

## String3DCustomFilterRegistry

Registry for custom post-processing filters.

### `register(definition)`

Register a custom filter.

```typescript
String3DCustomFilterRegistry.register({
  name: "vignette",
  fragmentShader: "...",
  uniforms: { uIntensity: 1.5 },
  parse: (args) => ({ uIntensity: parseFloat(args) }),
});
```

### `get(name)`

Get filter definition.

```typescript
const def = String3DCustomFilterRegistry.get("vignette");
```

### `has(name)`

Check if filter exists.

```typescript
if (String3DCustomFilterRegistry.has("vignette")) { ... }
```

### `list()`

Get all registered filters.

```typescript
const filters = String3DCustomFilterRegistry.list();
```

---

## String3DCustomFilterDefinition

Filter definition schema.

```typescript
type String3DCustomFilterDefinition = {
  name: string;
  fragmentShader: string;
  uniforms?: Record<string, any>;
  parse?: (args: string) => Record<string, any> | null;
};
```

---

## String3DFontRegistry

Registry for 3D text fonts.

### `register(name, url)`

Register a font.

```typescript
String3DFontRegistry.register("roboto", "/fonts/roboto.json");
```

### `setDefault(name)`

Set default font.

```typescript
String3DFontRegistry.setDefault("roboto");
```

### `get(name)`

Get font entry.

```typescript
const font = String3DFontRegistry.get("roboto");
// { name: "roboto", url: "/fonts/roboto.json" }
```

### `list()`

Get all fonts.

```typescript
const fonts = String3DFontRegistry.list();
```

### `resolveFontFamily(fontFamily)`

Resolve CSS font-family to registered font.

```typescript
const font = String3DFontRegistry.resolveFontFamily("Roboto, sans-serif");
```

---

## Type Exports

Available type exports:

```typescript
import type {
  // Module
  String3DOptions,

  // Engine abstraction
  I3DEngine,
  I3DEngineProvider,
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
  I3DRenderTarget,
  I3DLight,
  I3DCamera,
  I3DPerspectiveCamera,
  I3DOrthographicCamera,
  I3DScene,
  I3DRenderer,
  I3DTextureLoader,
  I3DModelLoader,
  I3DParticleSystem,
  ParticleSystemConfig,
  ParticleMode,

  // Camera
  CameraMode,

  // Materials
  String3DCustomMaterialDefinition,
  UniformType,
  UniformDefinition,
  ShaderInjection,
  ShaderInjectionPoint,
  MaterialBlendMode,
  MaterialSide,
  IMaterialInstance,
  IMaterialFactory,

  // Filters
  String3DCustomFilterDefinition,

  // Fonts
  String3DFontEntry,
  FontData,
  FontSource,
} from "string-tune-3d";
```

---

## Class Exports

Available class exports:

```typescript
import {
  // Main module
  String3D,

  // Provider
  ThreeJSProvider,
  ThreeJSEngine,
  ThreeJSMaterialFactory,

  // Core components
  String3DCamera,
  String3DRenderer,
  String3DScene,
  String3DObject,
  String3DSynchronizer,

  // Registries
  String3DCustomMaterialRegistry,
  String3DCustomFilterRegistry,
  String3DFontRegistry,

  // Utilities
  FontConverter,
} from "string-tune-3d";
```
