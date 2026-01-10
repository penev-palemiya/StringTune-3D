# Filters Reference

Apply post-processing effects to 3D objects using the `--filter` CSS property.

## Overview

Filters are applied per-object and can be combined. Syntax follows CSS filter function format:

```css
.object {
  --filter: blur(5px) bloom(0.5, 0.3);
}
```

## Available Filters

| Filter       | Syntax                            | Description       |
| ------------ | --------------------------------- | ----------------- |
| `blur`       | `blur(<radius>)`                  | Gaussian blur     |
| `bloom`      | `bloom(<intensity>, <threshold>)` | Glow effect       |
| `pixel`      | `pixel(<size>)`                   | Pixelation        |
| `brightness` | `brightness(<value>)`             | Adjust brightness |
| `contrast`   | `contrast(<value>)`               | Adjust contrast   |
| `saturate`   | `saturate(<value>)`               | Adjust saturation |
| `grayscale`  | `grayscale(<amount>)`             | Desaturate        |
| `sepia`      | `sepia(<amount>)`                 | Sepia tone        |
| `invert`     | `invert(<amount>)`                | Invert colors     |
| `hue-rotate` | `hue-rotate(<degrees>)`           | Rotate hue        |

---

## Blur

Apply Gaussian blur to the object.

```html
<div
  string="3d"
  string-3d="box"
  style="--filter: blur(5px);"
></div>
```

### Syntax

```
blur(<radius>)
```

| Parameter | Type       | Description           |
| --------- | ---------- | --------------------- |
| `radius`  | `<length>` | Blur radius in pixels |

### Examples

```css
.soft-blur {
  --filter: blur(2px);
}
.heavy-blur {
  --filter: blur(10px);
}
.subtle-blur {
  --filter: blur(0.5px);
}
```

---

## Bloom

Add glow effect to bright areas.

```html
<div
  string="3d"
  string-3d="sphere"
  style="
    --material-emissive: #ff0000;
    --filter: bloom(0.6, 0.3);
  "
></div>
```

### Syntax

```
bloom(<intensity>, <threshold>)
```

| Parameter   | Type       | Default | Description                |
| ----------- | ---------- | ------- | -------------------------- |
| `intensity` | `<number>` | `0.5`   | Glow strength (0-1+)       |
| `threshold` | `<number>` | `0.5`   | Brightness threshold (0-1) |

### Examples

```css
/* Subtle glow */
.subtle-bloom {
  --filter: bloom(0.3, 0.6);
}

/* Strong neon glow */
.neon-bloom {
  --filter: bloom(1, 0.2);
}

/* Everything glows */
.full-bloom {
  --filter: bloom(0.5, 0);
}
```

### Bloom with Emissive

Best results when combined with emissive materials:

```css
.glowing-object {
  --material-type: standard;
  --material-color: #00ffff;
  --material-emissive: #00ffff;
  --filter: bloom(0.7, 0.3);
}
```

---

## Pixel

Create pixelated/8-bit effect.

```html
<div
  string="3d"
  string-3d="box"
  style="--filter: pixel(8);"
></div>
```

### Syntax

```
pixel(<size>)
```

| Parameter | Type       | Description      |
| --------- | ---------- | ---------------- |
| `size`    | `<number>` | Pixel block size |

### Examples

```css
.low-res {
  --filter: pixel(16);
}
.medium-res {
  --filter: pixel(4);
}
.retro {
  --filter: pixel(8) saturate(1.2);
}
```

---

## Color Adjustments

### Brightness

```html
<div style="--filter: brightness(1.5);"></div>
```

| Value | Effect   |
| ----- | -------- |
| `0`   | Black    |
| `1`   | Normal   |
| `> 1` | Brighter |

### Contrast

```html
<div style="--filter: contrast(1.5);"></div>
```

| Value | Effect          |
| ----- | --------------- |
| `0`   | Gray            |
| `1`   | Normal          |
| `> 1` | Higher contrast |

### Saturate

```html
<div style="--filter: saturate(2);"></div>
```

| Value | Effect        |
| ----- | ------------- |
| `0`   | Grayscale     |
| `1`   | Normal        |
| `> 1` | Oversaturated |

### Grayscale

```html
<div style="--filter: grayscale(1);"></div>
```

| Value | Effect         |
| ----- | -------------- |
| `0`   | Normal         |
| `1`   | Full grayscale |

### Sepia

```html
<div style="--filter: sepia(0.8);"></div>
```

| Value | Effect     |
| ----- | ---------- |
| `0`   | Normal     |
| `1`   | Full sepia |

### Invert

```html
<div style="--filter: invert(1);"></div>
```

| Value | Effect         |
| ----- | -------------- |
| `0`   | Normal         |
| `1`   | Fully inverted |

### Hue Rotate

```html
<div style="--filter: hue-rotate(180deg);"></div>
```

| Value    | Effect         |
| -------- | -------------- |
| `0deg`   | Normal         |
| `180deg` | Opposite hue   |
| `360deg` | Back to normal |

---

## Combining Filters

Chain multiple filters in order:

```css
.combined {
  --filter: blur(2px) bloom(0.5, 0.4) contrast(1.1);
}
```

### Order Matters

Filters apply left to right:

```css
/* Blur then bloom (soft glow) */
.soft-glow {
  --filter: blur(1px) bloom(0.5, 0.3);
}

/* Bloom then blur (spread glow) */
.spread-glow {
  --filter: bloom(0.5, 0.3) blur(3px);
}
```

---

## Animating Filters

Use CSS transitions or animations:

```css
.animated-filter {
  --filter: blur(0px);
  transition: --filter 0.5s ease;
}

.animated-filter:hover {
  --filter: blur(5px) bloom(0.5, 0.3);
}
```

### Keyframe Animation

```css
@keyframes pulse-bloom {
  0%,
  100% {
    --filter: bloom(0.3, 0.5);
  }
  50% {
    --filter: bloom(0.8, 0.3);
  }
}

.pulsing {
  animation: pulse-bloom 2s ease-in-out infinite;
}
```

---

## Effect Recipes

### Dreamy

```css
.dreamy {
  --filter: blur(1px) bloom(0.4, 0.4) saturate(1.1);
}
```

### Cyberpunk

```css
.cyberpunk {
  --material-emissive: #ff00ff;
  --filter: bloom(0.8, 0.2) contrast(1.2) saturate(1.3);
}
```

### Old Photo

```css
.vintage {
  --filter: sepia(0.6) contrast(0.9) brightness(1.1);
}
```

### Night Vision

```css
.night-vision {
  --filter: brightness(1.5) contrast(1.3) saturate(0) hue-rotate(120deg);
}
```

### Glitch

```css
.glitch {
  --filter: pixel(4) contrast(1.2) saturate(1.5);
}
```

### Frosted Glass

```css
.frosted {
  --opacity: 0.3;
  --filter: blur(8px);
}
```

---

## Performance Notes

- Filters use GPU-based post-processing
- Complex filter chains impact performance
- Bloom is most expensive (multiple passes)
- Consider reducing `--geometry-quality` when using heavy filters
- Test on target devices

---

## Custom Filters

Create custom post-processing effects. See [Custom Filters](../advanced/custom-filters.md).

```typescript
import { String3DCustomFilterRegistry } from "string-tune-3d";

String3DCustomFilterRegistry.register({
  name: "vignette",
  fragmentShader: `
    uniform float uIntensity;
    void main() {
      vec2 uv = vUv - 0.5;
      float dist = length(uv);
      float vignette = 1.0 - dist * uIntensity;
      gl_FragColor = texture2D(tDiffuse, vUv) * vignette;
    }
  `,
  uniforms: { uIntensity: 1.5 },
  parse: (args) => ({ uIntensity: parseFloat(args) || 1.5 }),
});
```

Usage:

```css
.vignetted {
  --filter: vignette(2);
}
```
