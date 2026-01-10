# Quick Start

Get a 3D scene running in minutes with this step-by-step guide.

## Step 1: Import Dependencies

```typescript
import { StringTune } from "@fiddle-digital/string-tune";
import { String3D, ThreeJSProvider } from "string-tune-3d";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
```

## Step 2: Configure the Provider

```typescript
// Set up Three.js as the 3D engine
String3D.setProvider(
  new ThreeJSProvider(THREE, {
    gltf: GLTFLoader, // Optional: for loading .gltf/.glb models
  })
);
```

## Step 3: Initialize StringTune

```typescript
const stringTune = StringTune.getInstance();

// Register the 3D module with options
stringTune.use(String3D, {
  hideHTML: false, // Keep HTML visible
  zIndex: 1, // Canvas z-index
  modelLoaderType: "gltf", // Default model loader
});

// Start the animation loop at 60 FPS
stringTune.start(60);
```

## Step 4: Add 3D Objects in HTML

### Basic Box

```html
<div
  string="3d"
  string-3d="box"
  style="
    width: 150px;
    height: 150px;
    --material-color: #667eea;
  "
></div>
```

### Sphere with Rotation

```html
<div
  string="3d"
  string-3d="sphere"
  style="
    width: 100px;
    height: 100px;
    --material-color: #f093fb;
    --rotate-y: 45;
  "
></div>
```

### Add Lighting

```html
<!-- Ambient light for base illumination -->
<div
  string="3d"
  string-3d="ambientLight"
  style="
    --light-intensity: 0.5;
    --light-color: #ffffff;
  "
></div>

<!-- Directional light for shadows -->
<div
  string="3d"
  string-3d="directionalLight"
  style="
    --light-intensity: 1;
    --light-color: #ffffff;
    --translate-x: 100;
    --translate-y: 100;
    --translate-z: 100;
  "
></div>
```

## Complete Example

```html
<!DOCTYPE html>
<html>
  <head>
    <style>
      .scene {
        position: relative;
        width: 100vw;
        height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 40px;
      }

      .shape {
        width: 150px;
        height: 150px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-family: sans-serif;
      }

      .box {
        --material-color: #667eea;
        --rotate-y: 20;
      }

      .sphere {
        --material-color: #f093fb;
        --material-metalness: 0.5;
        --material-roughness: 0.3;
      }
    </style>
  </head>
  <body>
    <div class="scene">
      <!-- Lighting -->
      <div
        string="3d"
        string-3d="ambientLight"
        style="--light-intensity: 0.4"
      ></div>
      <div
        string="3d"
        string-3d="directionalLight"
        style="--light-intensity: 1"
      ></div>

      <!-- 3D Objects -->
      <div
        class="shape box"
        string="3d"
        string-3d="box"
      >
        Box
      </div>
      <div
        class="shape sphere"
        string="3d"
        string-3d="sphere"
      >
        Sphere
      </div>
    </div>

    <script type="module">
      import { StringTune } from "@fiddle-digital/string-tune";
      import { String3D, ThreeJSProvider } from "string-tune-3d";
      import * as THREE from "three";

      String3D.setProvider(new ThreeJSProvider(THREE));

      const st = StringTune.getInstance();
      st.use(String3D);
      st.start(60);
    </script>
  </body>
</html>
```

## Animating with CSS

Use CSS transitions or animations to animate 3D properties:

```css
.shape {
  --rotate-y: 0;
  transition: --rotate-y 0.5s ease;
}

.shape:hover {
  --rotate-y: 180;
}
```

Or with keyframe animations:

```css
@keyframes spin {
  from {
    --rotate-y: 0;
  }
  to {
    --rotate-y: 360;
  }
}

.spinning {
  animation: spin 4s linear infinite;
}
```

## Next Steps

- [Core Concepts](concepts.md) — Understand the architecture
- [CSS Properties](../reference/css-properties.md) — Full property reference
- [3D Objects](../reference/3d-objects.md) — Available object types
