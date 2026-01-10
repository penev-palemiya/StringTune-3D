# Particles Reference

Create and configure particle systems.

## Overview

StringTune-3D supports two particle modes:

| Mode        | Description                  | Use Case            |
| ----------- | ---------------------------- | ------------------- |
| `emitter`   | Continuous particle emission | Fire, smoke, sparks |
| `instanced` | Static particle distribution | Stars, dust, clouds |

## Basic Usage

```html
<div
  string="3d"
  string-3d="particles"
  style="
    width: 200px;
    height: 200px;
    --particles-mode: emitter;
    --particles-count: 500;
    --particles-color: #ff6600;
  "
></div>
```

---

## Common Properties

Shared by both modes.

| Property              | Type       | Default   | Description                    |
| --------------------- | ---------- | --------- | ------------------------------ |
| `--particles-mode`    | `*`        | `emitter` | Mode: `emitter` or `instanced` |
| `--particles-count`   | `<number>` | `300`     | Number of particles            |
| `--particles-size`    | `<number>` | `2`       | Particle size                  |
| `--particles-color`   | `<color>`  | `#ffffff` | Particle color                 |
| `--particles-opacity` | `<number>` | `1`       | Particle opacity               |
| `--particles-spread`  | `<number>` | `120`     | Distribution spread            |
| `--particles-seed`    | `<number>` | `1`       | Random seed                    |
| `--particles-shape`   | `*`        | `sphere`  | Particle shape                 |
| `--particles-fit`     | `<number>` | `0`       | Fit to element (0 or 1)        |

---

## Emitter Mode

Continuous particle emission with physics.

```html
<div
  string="3d"
  string-3d="particles"
  style="
    --particles-mode: emitter;
    --particles-count: 500;
    --emit-rate: 50;
    --particle-life: 2;
    --particle-speed: 60;
  "
></div>
```

### Emitter Properties

| Property                     | Type       | Default   | Description            |
| ---------------------------- | ---------- | --------- | ---------------------- |
| `--emit-rate`                | `<number>` | `30`      | Particles per second   |
| `--emit-burst`               | `<number>` | `0`       | Initial burst count    |
| `--particle-life`            | `<number>` | `2.5`     | Lifetime in seconds    |
| `--particle-speed`           | `<number>` | `40`      | Emission speed         |
| `--particle-direction`       | `*`        | `0 1 0`   | Direction (x y z)      |
| `--particle-gravity`         | `*`        | `0 -30 0` | Gravity (x y z)        |
| `--particle-drag`            | `<number>` | `0.1`     | Velocity damping       |
| `--particle-size-variation`  | `<number>` | `0.6`     | Size randomness (0-1)  |
| `--particle-color-variation` | `<number>` | `0.2`     | Color randomness (0-1) |

### Direction and Gravity

Use space-separated values for x, y, z:

```css
/* Upward particles */
.rising {
  --particle-direction: 0 1 0;
  --particle-gravity: 0 -10 0;
}

/* Horizontal spray */
.spray {
  --particle-direction: 1 0.5 0;
  --particle-gravity: 0 -50 0;
}

/* Floating particles */
.floating {
  --particle-direction: 0 0.5 0;
  --particle-gravity: 0 5 0;
}
```

---

## Instanced Mode

Static particle distribution with animation effects.

```html
<div
  string="3d"
  string-3d="particles"
  style="
    --particles-mode: instanced;
    --particles-count: 1000;
    --instance-shape: sphere;
    --instance-jitter: 0.2;
  "
></div>
```

### Instance Properties

| Property                     | Type       | Default  | Description        |
| ---------------------------- | ---------- | -------- | ------------------ |
| `--instance-shape`           | `*`        | `sphere` | Distribution shape |
| `--instance-scale`           | `<number>` | `1`      | Instance scale     |
| `--instance-scale-variation` | `<number>` | `0.5`    | Scale randomness   |
| `--instance-rotation-speed`  | `<number>` | `0.4`    | Auto-rotation      |
| `--instance-jitter`          | `<number>` | `0.2`    | Position jitter    |
| `--instance-flow`            | `<number>` | `0.3`    | Flow animation     |
| `--instance-disperse`        | `<number>` | `0`      | Dispersion         |
| `--instance-scatter`         | `<number>` | `0`      | Scatter amount     |
| `--instance-scatter-x`       | `<number>` | `0`      | X-axis scatter     |
| `--instance-scatter-y`       | `<number>` | `0`      | Y-axis scatter     |
| `--instance-scatter-z`       | `<number>` | `0`      | Z-axis scatter     |

### Distribution Shapes

| Shape    | Description            |
| -------- | ---------------------- |
| `sphere` | Spherical distribution |
| `box`    | Box/cube distribution  |
| `circle` | Circular (2D)          |
| `ring`   | Ring/torus             |

---

## Particle Shapes

Change individual particle appearance.

```css
.custom-shape {
  --particles-shape: sphere;
}
```

| Shape    | Description   |
| -------- | ------------- |
| `sphere` | Point sprites |
| `box`    | Box geometry  |
| `circle` | Flat circles  |

### Custom Particle Models

Use 3D models for particles:

```css
.model-particles {
  --particles-model: url("/models/star.glb");
  --particles-model-loader: gltf;
  --particles-model-node: StarMesh;
}
```

| Property                   | Description        |
| -------------------------- | ------------------ |
| `--particles-model`        | Model URL          |
| `--particles-model-loader` | Loader type        |
| `--particles-model-node`   | Node name in model |

### Custom Instance Models

```css
.custom-instances {
  --instance-model: url("/models/cube.glb");
  --instance-model-loader: gltf;
  --instance-model-node: CubeMesh;
}
```

---

## Effect Recipes

### Fire

```css
.fire {
  --particles-mode: emitter;
  --particles-count: 800;
  --particles-color: #ff4400;
  --particles-size: 5;
  --emit-rate: 100;
  --particle-life: 1;
  --particle-speed: 50;
  --particle-direction: 0 1 0;
  --particle-gravity: 0 20 0;
  --particle-size-variation: 0.8;
  --particle-color-variation: 0.3;
}
```

### Smoke

```css
.smoke {
  --particles-mode: emitter;
  --particles-count: 300;
  --particles-color: #888888;
  --particles-opacity: 0.4;
  --particles-size: 15;
  --emit-rate: 20;
  --particle-life: 4;
  --particle-speed: 15;
  --particle-direction: 0 1 0;
  --particle-gravity: 0 5 0;
  --particle-drag: 0.3;
}
```

### Sparks

```css
.sparks {
  --particles-mode: emitter;
  --particles-count: 200;
  --particles-color: #ffff00;
  --particles-size: 2;
  --emit-rate: 80;
  --particle-life: 0.8;
  --particle-speed: 100;
  --particle-direction: 0 1 0.5;
  --particle-gravity: 0 -100 0;
  --particle-drag: 0;
}
```

### Snow

```css
.snow {
  --particles-mode: emitter;
  --particles-count: 500;
  --particles-color: #ffffff;
  --particles-size: 3;
  --emit-rate: 30;
  --particle-life: 8;
  --particle-speed: 10;
  --particle-direction: 0 -1 0;
  --particle-gravity: 0 -5 0;
  --particle-drag: 0.5;
  --particle-size-variation: 0.5;
}
```

### Star Field

```css
.stars {
  --particles-mode: instanced;
  --particles-count: 2000;
  --particles-color: #ffffff;
  --particles-size: 1;
  --instance-shape: sphere;
  --instance-scale-variation: 0.8;
  --instance-jitter: 0.1;
  --instance-flow: 0;
}
```

### Dust Cloud

```css
.dust {
  --particles-mode: instanced;
  --particles-count: 500;
  --particles-color: #ccaa88;
  --particles-opacity: 0.6;
  --particles-size: 4;
  --instance-shape: box;
  --instance-jitter: 0.4;
  --instance-flow: 0.2;
}
```

### Confetti

```css
.confetti {
  --particles-mode: emitter;
  --particles-count: 300;
  --particles-size: 8;
  --emit-rate: 50;
  --emit-burst: 100;
  --particle-life: 3;
  --particle-speed: 80;
  --particle-direction: 0 1 0;
  --particle-gravity: 0 -40 0;
  --particle-color-variation: 1;
}
```

### Galaxy

```css
.galaxy {
  --particles-mode: instanced;
  --particles-count: 5000;
  --particles-color: #aaccff;
  --particles-size: 1;
  --instance-shape: circle;
  --instance-scale: 1.5;
  --instance-rotation-speed: 0.1;
  --instance-jitter: 0.3;
}
```

---

## Animation

Animate particle properties with CSS:

```css
@keyframes burst {
  0% {
    --emit-rate: 0;
  }
  10% {
    --emit-rate: 200;
  }
  100% {
    --emit-rate: 20;
  }
}

.burst-effect {
  animation: burst 2s ease-out;
}
```

```css
.interactive-particles {
  --emit-rate: 10;
  transition: --emit-rate 0.3s;
}

.interactive-particles:hover {
  --emit-rate: 100;
}
```

---

## Performance Tips

- Keep `--particles-count` reasonable (< 5000 for real-time)
- Use simpler `--particles-shape` (sphere/point sprites)
- Reduce `--particle-life` for faster recycling
- Use `--particles-fit: 1` to constrain to element bounds
- Consider `--instance-` mode for static effects
