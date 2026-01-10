# Installation

This guide covers installing StringTune-3D and its dependencies.

## Prerequisites

- Node.js 16+ and npm/yarn/pnpm
- A module bundler (Vite, Webpack, etc.)

## Install Dependencies

### 1. Install StringTune (Base Library)

```bash
npm install @fiddle-digital/string-tune
```

### 2. Install StringTune-3D

```bash
npm install string-tune-3d
```

### 3. Install Three.js

```bash
npm install three
```

### 4. (Optional) Install Type Definitions

```bash
npm install -D @types/three
```

## Full Installation Command

```bash
npm install @fiddle-digital/string-tune string-tune-3d three
```

## Model Loaders

For loading 3D models (GLTF, OBJ, FBX), import loaders from Three.js:

```typescript
// GLTF/GLB models (recommended)
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// OBJ models
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";

// FBX models
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
```

## Font Files for 3D Text

For 3D text rendering, you need JSON font files. Convert TTF/OTF fonts using:

- [Facetype.js](https://gero3.github.io/facetype.js/) — Online converter
- [three/examples/fonts](https://github.com/mrdoob/three.js/tree/dev/examples/fonts) — Pre-converted fonts

## Browser Support

StringTune-3D requires WebGL support:

| Browser | Version |
| ------- | ------- |
| Chrome  | 56+     |
| Firefox | 51+     |
| Safari  | 11+     |
| Edge    | 79+     |

## CDN Usage (UMD)

For quick prototyping without a bundler:

```html
<!-- StringTune -->
<script src="https://unpkg.com/@fiddle-digital/string-tune/dist/index.umd.js"></script>

<!-- Three.js -->
<script src="https://unpkg.com/three/build/three.min.js"></script>

<!-- StringTune-3D -->
<script src="https://unpkg.com/string-tune-3d/dist/index.umd.js"></script>
```

## TypeScript Configuration

Ensure your `tsconfig.json` includes:

```json
{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true
  }
}
```

## Next Steps

- [Quick Start](quick-start.md) — Create your first 3D scene
- [Core Concepts](concepts.md) — Understand the architecture
