# Materials Reference

Configure surface appearance for 3D objects.

## Material Types

StringTune-3D supports several material types:

| Type       | Description       | Lighting     | Textures |
| ---------- | ----------------- | ------------ | -------- |
| `basic`    | Unlit solid color | No           | Yes      |
| `standard` | PBR material      | Yes          | Yes      |
| Custom     | Shader-based      | Configurable | Yes      |

## Basic Material

Simple unlit material. Use for flat-colored objects or when lighting isn't needed.

```html
<div
  string="3d"
  string-3d="box"
  style="
    --material-type: basic;
    --material-color: #667eea;
    --opacity: 0.8;
  "
></div>
```

### Properties

| Property           | Type       | Default   | Description        |
| ------------------ | ---------- | --------- | ------------------ |
| `--material-color` | `<color>`  | `#ffffff` | Surface color      |
| `--opacity`        | `<number>` | `1`       | Transparency (0-1) |

---

## Standard Material

Physically-based rendering (PBR) material. Responds to scene lighting.

```html
<div
  string="3d"
  string-3d="sphere"
  style="
    --material-type: standard;
    --material-color: #c0c0c0;
    --material-metalness: 0.9;
    --material-roughness: 0.1;
    --material-emissive: #000000;
  "
></div>
```

### Properties

| Property               | Type       | Default   | Description               |
| ---------------------- | ---------- | --------- | ------------------------- |
| `--material-type`      | `*`        | `basic`   | Set to `standard`         |
| `--material-color`     | `<color>`  | `#ffffff` | Albedo/diffuse color      |
| `--material-metalness` | `<number>` | `0`       | Metallic appearance (0-1) |
| `--material-roughness` | `<number>` | `1`       | Surface roughness (0-1)   |
| `--material-emissive`  | `<color>`  | `#000000` | Self-illumination color   |
| `--opacity`            | `<number>` | `1`       | Transparency (0-1)        |

### Metalness vs Roughness

```css
/* Polished metal */
.chrome {
  --material-metalness: 1;
  --material-roughness: 0.05;
}

/* Brushed metal */
.brushed-steel {
  --material-metalness: 0.9;
  --material-roughness: 0.4;
}

/* Plastic */
.plastic {
  --material-metalness: 0;
  --material-roughness: 0.5;
}

/* Rubber */
.rubber {
  --material-metalness: 0;
  --material-roughness: 0.9;
}
```

---

## Textures

Apply image textures to materials.

### Texture Properties

| Property                | Type               | Description                   |
| ----------------------- | ------------------ | ----------------------------- |
| `--texture-map`         | URL                | Diffuse/albedo texture        |
| `--texture-normal`      | URL                | Normal map for surface detail |
| `--texture-roughness`   | URL                | Per-pixel roughness           |
| `--texture-metalness`   | URL                | Per-pixel metalness           |
| `--texture-ao`          | URL                | Ambient occlusion             |
| `--texture-flip-y`      | `0` or `1`         | Flip texture vertically       |
| `--texture-color-space` | `srgb` or `linear` | Texture color space           |

### Basic Texture

```html
<div
  string="3d"
  string-3d="box"
  style="
    --material-type: standard;
    --texture-map: url('/textures/wood.jpg');
    --texture-color-space: srgb;
  "
></div>
```

### Full PBR Setup

```css
.pbr-material {
  --material-type: standard;
  --texture-map: url("/textures/brick_diffuse.jpg");
  --texture-normal: url("/textures/brick_normal.jpg");
  --texture-roughness: url("/textures/brick_rough.jpg");
  --texture-ao: url("/textures/brick_ao.jpg");
  --texture-color-space: srgb;
  --material-metalness: 0;
  --material-roughness: 1;
}
```

### Texture Options

```css
/* Flip texture for certain model formats */
.flipped-texture {
  --texture-map: url("/textures/image.jpg");
  --texture-flip-y: 0;
}

/* Linear color space for data textures */
.linear-texture {
  --texture-normal: url("/textures/normal.jpg");
  --texture-color-space: linear;
}
```

---

## Emissive Materials

Create glowing effects with emissive color.

```html
<div
  string="3d"
  string-3d="sphere"
  style="
    --material-type: standard;
    --material-color: #ff4444;
    --material-emissive: #ff0000;
    --material-roughness: 0.3;
  "
></div>
```

### Glow Effect with Bloom

Combine emissive with bloom filter:

```css
.neon-light {
  --material-type: standard;
  --material-color: #00ffff;
  --material-emissive: #00ffff;
  --filter: bloom(0.5, 0.2);
}
```

---

## Transparent Materials

```html
<div
  string="3d"
  string-3d="box"
  style="
    --material-color: #667eea;
    --opacity: 0.5;
  "
></div>
```

### Transparency Tips

- Opacity < 1 automatically enables transparency
- Transparent objects may have depth sorting issues
- Use `--filter: blur()` for frosted glass effects

---

## Material Examples

### Glass

```css
.glass {
  --material-type: standard;
  --material-color: #ffffff;
  --opacity: 0.3;
  --material-metalness: 0;
  --material-roughness: 0;
}
```

### Gold

```css
.gold {
  --material-type: standard;
  --material-color: #ffd700;
  --material-metalness: 1;
  --material-roughness: 0.3;
}
```

### Plastic

```css
.plastic {
  --material-type: standard;
  --material-color: #ff5555;
  --material-metalness: 0;
  --material-roughness: 0.4;
}
```

### Matte

```css
.matte {
  --material-type: standard;
  --material-color: #888888;
  --material-metalness: 0;
  --material-roughness: 1;
}
```

### Neon

```css
.neon {
  --material-type: standard;
  --material-color: #ff00ff;
  --material-emissive: #ff00ff;
  --material-metalness: 0;
  --material-roughness: 0.5;
  --filter: bloom(0.6, 0.3);
}
```

---

## Auto-Upgrade to Standard

If you use textures with a `basic` material, it automatically upgrades to `standard`:

```css
/* This becomes standard material internally */
.auto-standard {
  --material-type: basic;
  --texture-map: url("/textures/wood.jpg");
  /* Textures require standard material for proper rendering */
}
```

---

## Custom Materials

For advanced shader effects, see [Custom Materials](../advanced/custom-materials.md).

```typescript
import { String3DCustomMaterialRegistry } from "string-tune-3d";

String3DCustomMaterialRegistry.register({
  name: "hologram",
  extends: "standard",
  uniforms: {
    uTime: { type: "float", value: 0, css: "--time" },
    uScanlines: { type: "float", value: 50, css: "--scanlines" },
  },
  injections: [
    {
      point: "fragment_color",
      code: `
        float scan = sin(vUv.y * uScanlines + uTime) * 0.5 + 0.5;
        diffuseColor.rgb *= 0.8 + scan * 0.2;
      `,
    },
  ],
});
```

Usage:

```html
<div
  string="3d"
  string-3d="box"
  style="
    --material-type: hologram;
    --scanlines: 100;
  "
></div>
```
