# 3D Objects Reference

Complete reference for all available 3D object types.

## Overview

Add 3D objects to your page using the `string-3d` attribute:

```html
<div
  string="3d"
  string-3d="[type]"
></div>
```

## Available Types

| Type               | Description              |
| ------------------ | ------------------------ |
| `box`              | Cube/box geometry        |
| `sphere`           | Sphere geometry          |
| `plane`            | Flat plane geometry      |
| `cylinder`         | Cylinder geometry        |
| `model`            | External 3D model        |
| `text`             | Extruded 3D text         |
| `particles`        | Particle system          |
| `group`            | Container for grouping   |
| `ambientLight`     | Ambient light source     |
| `directionalLight` | Directional light source |
| `pointLight`       | Point light source       |
| `spotLight`        | Spot light source        |
| `hemisphereLight`  | Hemisphere light source  |

---

## Primitives

### Box

A cube that scales to match the element's dimensions.

```html
<div
  string="3d"
  string-3d="box"
  style="
    width: 100px;
    height: 100px;
    --material-color: #667eea;
  "
></div>
```

The box uses the **smaller** dimension (width or height) as the uniform size.

### Sphere

A sphere geometry.

```html
<div
  string="3d"
  string-3d="sphere"
  style="
    width: 100px;
    height: 100px;
    --material-color: #f093fb;
    --material-metalness: 0.5;
  "
></div>
```

### Plane

A flat 2D plane in 3D space.

```html
<div
  string="3d"
  string-3d="plane"
  style="
    width: 200px;
    height: 200px;
    --material-color: #44aa44;
    --shadow-receive: 1;
  "
></div>
```

### Cylinder

A cylindrical geometry.

```html
<div
  string="3d"
  string-3d="cylinder"
  style="
    width: 80px;
    height: 150px;
    --material-color: #ffaa00;
  "
></div>
```

---

## 3D Models

Load external 3D models (GLTF, GLB, OBJ, FBX).

### Basic Model

```html
<div
  string="3d"
  string-3d="model"
  string-3d-model="/models/robot.glb"
  style="width: 200px; height: 200px;"
></div>
```

### Model Attributes

| Attribute                | Type      | Default   | Description                    |
| ------------------------ | --------- | --------- | ------------------------------ |
| `string-3d-model`        | `string`  | `""`      | Model file URL                 |
| `string-3d-model-loader` | `string`  | `""`      | Loader type override           |
| `string-3d-model-scale`  | `number`  | `1`       | Scale multiplier               |
| `string-3d-model-center` | `boolean` | `false`   | Center model at origin         |
| `string-3d-model-fit`    | `string`  | `contain` | Fit mode: `contain` or `cover` |

### Example with Options

```html
<div
  string="3d"
  string-3d="model"
  string-3d-model="/models/character.glb"
  string-3d-model-fit="cover"
  string-3d-model-center="true"
  string-3d-model-scale="1.5"
  style="
    width: 300px;
    height: 400px;
    --rotate-y: 30;
  "
></div>
```

### Texture Remapping

Override model textures:

```html
<div
  string="3d"
  string-3d="model"
  string-3d-model="/models/scene.glb"
  string-3d-model-texture-base="/textures/"
  string-3d-model-textures='{"original.png": "new.png"}'
></div>
```

### Material Override

Override model materials using CSS:

```html
<div
  string="3d"
  string-3d="model"
  string-3d-model="/models/object.glb"
  style="
    --material-type: standard;
    --material-color: #ff0000;
    --material-metalness: 0.8;
  "
></div>
```

---

## Groups

Groups create parent-child hierarchies. Child transforms are relative to the parent.

```html
<div
  string="3d"
  string-3d="group"
  style="--rotate-y: 45;"
>
  <div
    string="3d"
    string-3d="box"
    style="width: 50px; height: 50px; --translate-x: -75;"
  ></div>
  <div
    string="3d"
    string-3d="box"
    style="width: 50px; height: 50px; --translate-x: 75;"
  ></div>
</div>
```

Both boxes rotate together around the group's center.

### Nested Groups

```html
<div
  string="3d"
  string-3d="group"
  style="--rotate-y: 45;"
>
  <div
    string="3d"
    string-3d="group"
    style="--translate-z: 50;"
  >
    <div
      string="3d"
      string-3d="sphere"
      style="width: 50px; height: 50px;"
    ></div>
  </div>
</div>
```

---

## 3D Text

Render extruded 3D text. Requires registered fonts.

### Setup

```typescript
import { String3D } from "string-tune-3d";

// Register a font
String3D.registerFont("roboto", "/fonts/roboto.json", { default: true });
```

### Usage

```html
<div
  string="3d"
  string-3d="text"
  style="
    font-family: 'Roboto', sans-serif;
    font-size: 48px;
    --material-color: #gold;
    --text-depth: 20;
  "
>
  Hello 3D
</div>
```

### Text Properties

| CSS Property             | Default   | Description      |
| ------------------------ | --------- | ---------------- |
| `--text-depth`           | `8`       | Extrusion depth  |
| `--text-curve-segments`  | `8`       | Curve smoothness |
| `--text-bevel-size`      | `0`       | Bevel radius     |
| `--text-bevel-thickness` | `0`       | Bevel depth      |
| `--text-bevel-offset`    | `0`       | Bevel offset     |
| `--text-bevel-steps`     | `0`       | Bevel segments   |
| `--text-fit`             | `contain` | Fit mode         |

### Example with Bevel

```html
<div
  string="3d"
  string-3d="text"
  style="
    font-family: 'Roboto';
    font-size: 72px;
    --material-type: standard;
    --material-color: #c0c0c0;
    --material-metalness: 0.9;
    --text-depth: 15;
    --text-bevel-size: 2;
    --text-bevel-thickness: 2;
    --text-bevel-steps: 3;
  "
>
  METAL
</div>
```

---

## Particles

Create particle systems. See [Particles Reference](particles.md) for full documentation.

### Emitter Mode

```html
<div
  string="3d"
  string-3d="particles"
  style="
    width: 100px;
    height: 100px;
    --particles-mode: emitter;
    --particles-count: 500;
    --particles-color: #ff6600;
    --emit-rate: 50;
    --particle-life: 1.5;
    --particle-speed: 80;
  "
></div>
```

### Instanced Mode

```html
<div
  string="3d"
  string-3d="particles"
  style="
    width: 200px;
    height: 200px;
    --particles-mode: instanced;
    --particles-count: 1000;
    --particles-shape: sphere;
    --instance-jitter: 0.3;
  "
></div>
```

---

## Geometry Attributes

Common attributes for primitive shapes.

| Attribute                   | Type     | Default | Description              |
| --------------------------- | -------- | ------- | ------------------------ |
| `string-3d-segments`        | `number` | `32`    | General segment count    |
| `string-3d-segments-width`  | `number` | `32`    | Width segments (sphere)  |
| `string-3d-segments-height` | `number` | `32`    | Height segments (sphere) |

### Example

```html
<div
  string="3d"
  string-3d="sphere"
  string-3d-segments="64"
  style="width: 100px; height: 100px;"
></div>
```

Or use CSS:

```css
.high-poly {
  --geometry-quality: 2; /* 2x segments */
}
```
