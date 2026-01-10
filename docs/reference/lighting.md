# Lighting Reference

Configure light sources for your 3D scenes.

## Overview

Lights affect objects using `--material-type: standard`. Basic materials are unlit.

## Light Types

| Type               | Description                              | Shadows |
| ------------------ | ---------------------------------------- | ------- |
| `ambientLight`     | Uniform illumination from all directions | No      |
| `directionalLight` | Parallel rays (sun-like)                 | Yes     |
| `pointLight`       | Radiates from a point                    | Yes     |
| `spotLight`        | Cone-shaped light                        | Yes     |
| `hemisphereLight`  | Sky + ground gradient                    | No      |

---

## Ambient Light

Provides base illumination. No shadows, no direction.

```html
<div
  string="3d"
  string-3d="ambientLight"
  style="
    --light-color: #ffffff;
    --light-intensity: 0.5;
  "
></div>
```

### Properties

| Property            | Default   | Description |
| ------------------- | --------- | ----------- |
| `--light-color`     | `#ffffff` | Light color |
| `--light-intensity` | `1`       | Brightness  |

### Usage Tip

Always include ambient light to prevent completely dark shadows:

```css
.ambient {
  --light-intensity: 0.3;
} /* Soft base light */
```

---

## Directional Light

Parallel light rays from a direction (like the sun).

```html
<div
  string="3d"
  string-3d="directionalLight"
  style="
    --light-color: #ffffff;
    --light-intensity: 1;
    --translate-x: 100;
    --translate-y: 200;
    --translate-z: 100;
  "
></div>
```

### Properties

| Property            | Default   | Description                |
| ------------------- | --------- | -------------------------- |
| `--light-color`     | `#ffffff` | Light color                |
| `--light-intensity` | `1`       | Brightness                 |
| `--light-target`    | `none`    | Target selector (optional) |

### Position Matters

The light's position determines ray direction. Light shines **toward the origin** from its position.

```css
/* Light from upper-right-front */
.sun {
  --translate-x: 100;
  --translate-y: 200;
  --translate-z: 150;
  --light-intensity: 1.2;
}
```

---

## Point Light

Radiates light in all directions from a single point.

```html
<div
  string="3d"
  string-3d="pointLight"
  style="
    --light-color: #ff9900;
    --light-intensity: 2;
    --light-distance: 500;
    --light-decay: 1;
    --translate-z: 100;
  "
></div>
```

### Properties

| Property            | Default   | Description                  |
| ------------------- | --------- | ---------------------------- |
| `--light-color`     | `#ffffff` | Light color                  |
| `--light-intensity` | `1`       | Brightness                   |
| `--light-distance`  | `1000`    | Maximum range (0 = infinite) |
| `--light-decay`     | `0`       | Attenuation rate             |

### Distance and Decay

```css
/* Close, bright light */
.lamp {
  --light-distance: 200;
  --light-decay: 2;
  --light-intensity: 3;
}

/* Far-reaching light */
.beacon {
  --light-distance: 1000;
  --light-decay: 0;
  --light-intensity: 1;
}
```

---

## Spot Light

Cone-shaped light with adjustable angle.

```html
<div
  string="3d"
  string-3d="spotLight"
  style="
    --light-color: #ffffff;
    --light-intensity: 2;
    --light-distance: 500;
    --light-angle: 0.5;
    --light-penumbra: 0.3;
    --translate-y: 200;
    --translate-z: 100;
  "
></div>
```

### Properties

| Property            | Default   | Description                |
| ------------------- | --------- | -------------------------- |
| `--light-color`     | `#ffffff` | Light color                |
| `--light-intensity` | `1`       | Brightness                 |
| `--light-distance`  | `0`       | Maximum range              |
| `--light-angle`     | `1.0472`  | Cone angle (radians, ~60°) |
| `--light-penumbra`  | `0`       | Soft edge (0-1)            |
| `--light-decay`     | `1`       | Attenuation rate           |
| `--light-target`    | `none`    | Target selector            |

### Angle Reference

| Degrees | Radians |
| ------- | ------- |
| 30°     | 0.524   |
| 45°     | 0.785   |
| 60°     | 1.047   |
| 90°     | 1.571   |

### Spotlight Example

```css
.stage-spotlight {
  --light-color: #ffeecc;
  --light-intensity: 3;
  --light-angle: 0.4; /* ~23 degrees */
  --light-penumbra: 0.5; /* Soft edges */
  --light-distance: 800;
  --light-decay: 1.5;
}
```

---

## Hemisphere Light

Gradient light simulating sky and ground reflection.

```html
<div
  string="3d"
  string-3d="hemisphereLight"
  style="
    --light-color: #87ceeb;
    --light-ground-color: #8b4513;
    --light-intensity: 0.8;
  "
></div>
```

### Properties

| Property               | Default   | Description           |
| ---------------------- | --------- | --------------------- |
| `--light-color`        | `#ffffff` | Sky color (top)       |
| `--light-ground-color` | `#ffffff` | Ground color (bottom) |
| `--light-intensity`    | `1`       | Brightness            |

### Environment Simulation

```css
/* Outdoor daylight */
.outdoor {
  --light-color: #add8e6; /* Light blue sky */
  --light-ground-color: #228b22; /* Green ground */
  --light-intensity: 0.6;
}

/* Sunset */
.sunset {
  --light-color: #ff7f50; /* Orange sky */
  --light-ground-color: #2f4f4f; /* Dark ground */
  --light-intensity: 0.5;
}
```

---

## Shadows

Enable shadow casting and receiving for realistic scenes.

### Shadow Properties

| Property            | Default | Description                   |
| ------------------- | ------- | ----------------------------- |
| `--shadow-cast`     | `0`     | Light casts shadows (0/1)     |
| `--shadow-receive`  | `0`     | Object receives shadows (0/1) |
| `--shadow-bias`     | `0`     | Shadow map bias               |
| `--shadow-map-size` | `512`   | Shadow map resolution         |

### Enable on Lights

```html
<div
  string="3d"
  string-3d="directionalLight"
  style="
    --light-intensity: 1;
    --shadow-cast: 1;
    --shadow-map-size: 1024;
    --shadow-bias: -0.001;
  "
></div>
```

### Enable on Objects

```html
<!-- Caster -->
<div
  string="3d"
  string-3d="box"
  style="--shadow-cast: 1;"
></div>

<!-- Receiver (ground) -->
<div
  string="3d"
  string-3d="plane"
  style="
    --shadow-receive: 1;
    --rotate-x: 90;
    --translate-y: -50;
  "
></div>
```

### Shadow Quality

```css
/* High quality */
.hd-shadows {
  --shadow-map-size: 2048;
  --shadow-bias: -0.0005;
}

/* Performance */
.fast-shadows {
  --shadow-map-size: 256;
  --shadow-bias: -0.002;
}
```

---

## Typical Lighting Setups

### Three-Point Lighting

```html
<!-- Key light (main) -->
<div
  string="3d"
  string-3d="directionalLight"
  style="
    --light-intensity: 1;
    --translate-x: 100;
    --translate-y: 100;
    --translate-z: 100;
    --shadow-cast: 1;
  "
></div>

<!-- Fill light (soft) -->
<div
  string="3d"
  string-3d="directionalLight"
  style="
    --light-intensity: 0.5;
    --translate-x: -100;
    --translate-y: 50;
    --translate-z: 100;
  "
></div>

<!-- Rim/back light -->
<div
  string="3d"
  string-3d="directionalLight"
  style="
    --light-intensity: 0.3;
    --translate-x: 0;
    --translate-y: 50;
    --translate-z: -100;
  "
></div>

<!-- Ambient (base) -->
<div
  string="3d"
  string-3d="ambientLight"
  style="--light-intensity: 0.2;"
></div>
```

### Studio Setup

```html
<!-- Soft overhead -->
<div
  string="3d"
  string-3d="pointLight"
  style="
    --light-intensity: 1.5;
    --light-distance: 800;
    --translate-y: 300;
  "
></div>

<!-- Environment -->
<div
  string="3d"
  string-3d="hemisphereLight"
  style="
    --light-color: #f0f0f0;
    --light-ground-color: #303030;
    --light-intensity: 0.4;
  "
></div>
```

### Dramatic Spotlight

```html
<div
  string="3d"
  string-3d="spotLight"
  style="
    --light-color: #ffffff;
    --light-intensity: 3;
    --light-angle: 0.3;
    --light-penumbra: 0.8;
    --translate-y: 400;
    --translate-z: 200;
    --shadow-cast: 1;
    --shadow-map-size: 1024;
  "
></div>

<div
  string="3d"
  string-3d="ambientLight"
  style="--light-intensity: 0.05;"
></div>
```
