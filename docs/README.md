# StringTune-3D Documentation

Welcome to the **StringTune-3D** documentation — a powerful 3D graphics module for the [StringTune](https://github.com/fiddle-digital/string-tune) ecosystem.

## Overview

StringTune-3D enables seamless integration of 3D objects with HTML elements using a **CSS-first approach**. It automatically synchronizes 3D objects with DOM elements, allowing you to control 3D transformations, materials, lighting, and effects through CSS custom properties.

## Key Features

- **CSS-Driven 3D** — Control 3D objects using CSS custom properties
- **Automatic Synchronization** — 3D objects follow DOM element positions
- **Built-in Primitives** — Box, sphere, plane, cylinder, and more
- **Advanced Lighting** — Point, ambient, directional, spot, and hemisphere lights
- **Material System** — Basic, standard, and custom shader materials
- **Post-Processing Filters** — Blur, bloom, pixel effects via CSS `--filter`
- **3D Text** — Extruded text geometry with bevel support
- **Particle Systems** — Emitter and instanced particle modes
- **Model Loading** — GLTF/GLB model support

## Documentation Structure

### Getting Started

- [Installation](getting-started/installation.md) — Setup and dependencies
- [Quick Start](getting-started/quick-start.md) — Your first 3D scene
- [Core Concepts](getting-started/concepts.md) — Understanding the architecture

### Reference

- [CSS Properties](reference/css-properties.md) — Complete CSS custom properties reference
- [3D Objects](reference/3d-objects.md) — Available 3D object types
- [Materials](reference/materials.md) — Material system and textures
- [Lighting](reference/lighting.md) — Light types and shadows
- [Filters](reference/filters.md) — Post-processing effects
- [Particles](reference/particles.md) — Particle system configuration
- [3D Text](reference/text.md) — Text geometry and fonts

### Advanced

- [Custom Materials](advanced/custom-materials.md) — Creating shader materials
- [Custom Filters](advanced/custom-filters.md) — Creating post-processing filters
- [Performance](advanced/performance.md) — Optimization techniques
- [API Reference](advanced/api-reference.md) — TypeScript API documentation

## Quick Example

```html
<!-- 3D Box that follows this element -->
<div
  string="3d"
  string-3d="box"
  style="
    width: 200px;
    height: 200px;
    --material-color: #667eea;
    --rotate-y: 45;
    --opacity: 0.8;
  "
>
  Hello 3D
</div>
```

```typescript
import { StringTune } from "@fiddle-digital/string-tune";
import { String3D, ThreeJSProvider } from "string-tune-3d";
import * as THREE from "three";

String3D.setProvider(new ThreeJSProvider(THREE));

const stringTune = StringTune.getInstance();
stringTune.use(String3D);
stringTune.start(60);
```

## Requirements

- **StringTune** `@fiddle-digital/string-tune` (base library)
- **Three.js** `three` (3D engine)

## License

MIT License — see [LICENSE](../LICENSE) for details.
