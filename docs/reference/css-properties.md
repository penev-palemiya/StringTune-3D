# CSS Properties Reference

Complete reference for all CSS custom properties available in StringTune-3D.

## Transform Properties

Control position, rotation, and scale of 3D objects.

| Property        | Type       | Default | Description                       |
| --------------- | ---------- | ------- | --------------------------------- |
| `--translate-x` | `<number>` | `0`     | X-axis offset in pixels           |
| `--translate-y` | `<number>` | `0`     | Y-axis offset in pixels           |
| `--translate-z` | `<number>` | `0`     | Z-axis position (depth)           |
| `--rotate-x`    | `<number>` | `0`     | Rotation around X-axis in degrees |
| `--rotate-y`    | `<number>` | `0`     | Rotation around Y-axis in degrees |
| `--rotate-z`    | `<number>` | `0`     | Rotation around Z-axis in degrees |
| `--scale`       | `<number>` | `1`     | Uniform scale multiplier          |
| `--scale-x`     | `<number>` | `1`     | X-axis scale multiplier           |
| `--scale-y`     | `<number>` | `1`     | Y-axis scale multiplier           |
| `--scale-z`     | `<number>` | `1`     | Z-axis scale multiplier           |

### Example

```css
.rotating-box {
  --translate-z: 100;
  --rotate-x: 15;
  --rotate-y: 45;
  --scale: 1.2;
}
```

## Appearance Properties

| Property    | Type       | Default | Description                  |
| ----------- | ---------- | ------- | ---------------------------- |
| `--opacity` | `<number>` | `1`     | Object opacity (0-1)         |
| `--filter`  | `*`        | `none`  | Post-processing filter chain |

### Example

```css
.glass-sphere {
  --opacity: 0.6;
  --filter: blur(2px) bloom(0.3, 0.5);
}
```

## Material Properties

Control surface appearance of 3D meshes.

| Property               | Type       | Default   | Description                                   |
| ---------------------- | ---------- | --------- | --------------------------------------------- |
| `--material-type`      | `*`        | `basic`   | Material type: `basic`, `standard`, or custom |
| `--material-color`     | `<color>`  | `#ffffff` | Surface color                                 |
| `--material-metalness` | `<number>` | `0`       | Metallic appearance (0-1, standard only)      |
| `--material-roughness` | `<number>` | `1`       | Surface roughness (0-1, standard only)        |
| `--material-emissive`  | `<color>`  | `#000000` | Self-illumination color                       |

### Example

```css
.metal-cube {
  --material-type: standard;
  --material-color: #c0c0c0;
  --material-metalness: 0.9;
  --material-roughness: 0.2;
}

.glowing-orb {
  --material-type: standard;
  --material-color: #ff4444;
  --material-emissive: #ff0000;
}
```

## Texture Properties

Apply textures to materials.

| Property                | Type       | Default | Description                     |
| ----------------------- | ---------- | ------- | ------------------------------- |
| `--texture-map`         | `*`        | `none`  | Diffuse/albedo texture URL      |
| `--texture-normal`      | `*`        | `none`  | Normal map texture URL          |
| `--texture-roughness`   | `*`        | `none`  | Roughness map texture URL       |
| `--texture-metalness`   | `*`        | `none`  | Metalness map texture URL       |
| `--texture-ao`          | `*`        | `none`  | Ambient occlusion texture URL   |
| `--texture-flip-y`      | `<number>` | `1`     | Flip texture Y-axis (0 or 1)    |
| `--texture-color-space` | `*`        | `none`  | Color space: `srgb` or `linear` |

### Example

```css
.textured-box {
  --material-type: standard;
  --texture-map: url("/textures/wood.jpg");
  --texture-normal: url("/textures/wood_normal.jpg");
  --texture-roughness: url("/textures/wood_rough.jpg");
  --texture-color-space: srgb;
}
```

## Light Properties

Configure light sources.

| Property               | Type       | Default   | Description                        |
| ---------------------- | ---------- | --------- | ---------------------------------- |
| `--light-color`        | `<color>`  | `#ffffff` | Light color                        |
| `--light-intensity`    | `<number>` | `1`       | Light brightness                   |
| `--light-distance`     | `<number>` | `1000`    | Maximum range (point/spot)         |
| `--light-decay`        | `<number>` | `0`       | Attenuation rate                   |
| `--light-angle`        | `<number>` | `1.0472`  | Cone angle in radians (spot)       |
| `--light-penumbra`     | `<number>` | `0`       | Soft edge amount (spot, 0-1)       |
| `--light-ground-color` | `<color>`  | `#ffffff` | Ground color (hemisphere)          |
| `--light-target`       | `*`        | `none`    | Target selector (directional/spot) |

### Example

```css
.warm-point-light {
  --light-color: #ffaa66;
  --light-intensity: 2;
  --light-distance: 500;
  --light-decay: 1;
}

.sky-light {
  --light-color: #87ceeb;
  --light-ground-color: #8b4513;
  --light-intensity: 0.8;
}
```

## Shadow Properties

Configure shadow casting and receiving.

| Property            | Type       | Default | Description                      |
| ------------------- | ---------- | ------- | -------------------------------- |
| `--shadow-cast`     | `<number>` | `0`     | Enable shadow casting (0 or 1)   |
| `--shadow-receive`  | `<number>` | `0`     | Enable shadow receiving (0 or 1) |
| `--shadow-bias`     | `<number>` | `0`     | Shadow map bias                  |
| `--shadow-map-size` | `<number>` | `512`   | Shadow map resolution            |

### Example

```css
.shadow-caster {
  --shadow-cast: 1;
}

.ground-plane {
  --shadow-receive: 1;
}

.light-with-shadows {
  --shadow-cast: 1;
  --shadow-map-size: 1024;
  --shadow-bias: -0.001;
}
```

## Particle Properties

Configure particle systems. See [Particles Reference](particles.md) for detailed documentation.

| Property              | Type       | Default   | Description                    |
| --------------------- | ---------- | --------- | ------------------------------ |
| `--particles-mode`    | `*`        | `emitter` | Mode: `emitter` or `instanced` |
| `--particles-count`   | `<number>` | `300`     | Number of particles            |
| `--particles-size`    | `<number>` | `2`       | Particle size                  |
| `--particles-color`   | `<color>`  | `#ffffff` | Particle color                 |
| `--particles-opacity` | `<number>` | `1`       | Particle opacity               |
| `--particles-spread`  | `<number>` | `120`     | Spread angle/area              |
| `--particles-seed`    | `<number>` | `1`       | Random seed                    |
| `--particles-shape`   | `*`        | `sphere`  | Particle shape                 |
| `--particles-fit`     | `<number>` | `0`       | Fit to element bounds          |

### Emitter Properties

| Property                     | Type       | Default   | Description                 |
| ---------------------------- | ---------- | --------- | --------------------------- |
| `--emit-rate`                | `<number>` | `30`      | Particles per second        |
| `--emit-burst`               | `<number>` | `0`       | Initial burst count         |
| `--particle-life`            | `<number>` | `2.5`     | Particle lifetime (seconds) |
| `--particle-speed`           | `<number>` | `40`      | Emission speed              |
| `--particle-direction`       | `*`        | `0 1 0`   | Direction vector (x y z)    |
| `--particle-gravity`         | `*`        | `0 -30 0` | Gravity vector (x y z)      |
| `--particle-drag`            | `<number>` | `0.1`     | Velocity damping            |
| `--particle-size-variation`  | `<number>` | `0.6`     | Size randomness             |
| `--particle-color-variation` | `<number>` | `0.2`     | Color randomness            |

### Instance Properties

| Property                     | Type       | Default  | Description         |
| ---------------------------- | ---------- | -------- | ------------------- |
| `--instance-shape`           | `*`        | `sphere` | Distribution shape  |
| `--instance-scale`           | `<number>` | `1`      | Instance scale      |
| `--instance-scale-variation` | `<number>` | `0.5`    | Scale randomness    |
| `--instance-rotation-speed`  | `<number>` | `0.4`    | Auto-rotation speed |
| `--instance-jitter`          | `<number>` | `0.2`    | Position jitter     |
| `--instance-flow`            | `<number>` | `0.3`    | Flow animation      |
| `--instance-disperse`        | `<number>` | `0`      | Dispersion amount   |
| `--instance-scatter`         | `<number>` | `0`      | Scatter amount      |
| `--instance-scatter-x`       | `<number>` | `0`      | X-axis scatter      |
| `--instance-scatter-y`       | `<number>` | `0`      | Y-axis scatter      |
| `--instance-scatter-z`       | `<number>` | `0`      | Z-axis scatter      |

### Example

```css
.fire-particles {
  --particles-mode: emitter;
  --particles-count: 500;
  --particles-color: #ff6600;
  --emit-rate: 50;
  --particle-life: 1.5;
  --particle-speed: 80;
  --particle-direction: 0 1 0;
  --particle-gravity: 0 20 0;
}
```

## Text Properties

Configure 3D text geometry. See [Text Reference](text.md) for detailed documentation.

| Property                 | Type       | Default   | Description                    |
| ------------------------ | ---------- | --------- | ------------------------------ |
| `--text-depth`           | `<number>` | `8`       | Extrusion depth                |
| `--text-curve-segments`  | `<number>` | `8`       | Curve smoothness               |
| `--text-bevel-size`      | `<number>` | `0`       | Bevel size                     |
| `--text-bevel-thickness` | `<number>` | `0`       | Bevel depth                    |
| `--text-bevel-offset`    | `<number>` | `0`       | Bevel position offset          |
| `--text-bevel-steps`     | `<number>` | `0`       | Bevel smoothness steps         |
| `--text-fit`             | `*`        | `contain` | Fit mode: `contain` or `cover` |

### Example

```css
.extruded-title {
  font-size: 48px;
  font-family: "Roboto", sans-serif;
  --material-color: #gold;
  --text-depth: 20;
  --text-bevel-size: 2;
  --text-bevel-thickness: 2;
  --text-bevel-steps: 3;
}
```

## Geometry Quality

| Property             | Type       | Default | Description                |
| -------------------- | ---------- | ------- | -------------------------- |
| `--geometry-quality` | `<number>` | `1`     | Geometry detail multiplier |

### Example

```css
.high-detail-sphere {
  --geometry-quality: 2; /* Double segments */
}

.low-detail-sphere {
  --geometry-quality: 0.5; /* Half segments */
}
```

## Using with CSS Animations

All numeric properties can be animated:

```css
@keyframes rotate {
  from {
    --rotate-y: 0;
  }
  to {
    --rotate-y: 360;
  }
}

.spinning {
  animation: rotate 4s linear infinite;
}
```

```css
.hoverable {
  --scale: 1;
  transition: --scale 0.3s ease;
}

.hoverable:hover {
  --scale: 1.2;
}
```
