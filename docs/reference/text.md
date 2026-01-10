# 3D Text Reference

Render extruded 3D text geometry.

> ⚠️ **Experimental Feature**
>
> The 3D text functionality is currently experimental and may contain bugs. Use with caution in production environments. API and behavior may change in future releases.

## Overview

StringTune-3D can render HTML text content as 3D extruded geometry.

## Prerequisites

### Font Registration

Register JSON fonts before use:

```typescript
import { String3D } from "string-tune-3d";

// Register fonts
String3D.registerFont("roboto", "/fonts/roboto_regular.json");
String3D.registerFont("roboto-bold", "/fonts/roboto_bold.json");

// Set default font
String3D.setDefaultFont("roboto");

// Or register with default flag
String3D.registerFont("helvetica", "/fonts/helvetica.json", { default: true });
```

### Font Format

Fonts must be in Three.js JSON format. Convert from TTF/OTF using:

- [Facetype.js](https://gero3.github.io/facetype.js/) — Online converter
- [three/examples/fonts](https://github.com/mrdoob/three.js/tree/dev/examples/fonts) — Pre-converted fonts

---

## Basic Usage

```html
<div
  string="3d"
  string-3d="text"
  style="
    font-family: 'Roboto', sans-serif;
    font-size: 48px;
    --material-color: #ffffff;
    --text-depth: 10;
  "
>
  Hello 3D
</div>
```

The text content of the element becomes 3D geometry.

---

## CSS Properties

### Text Geometry

| Property                | Type       | Default   | Description      |
| ----------------------- | ---------- | --------- | ---------------- |
| `--text-depth`          | `<number>` | `8`       | Extrusion depth  |
| `--text-curve-segments` | `<number>` | `8`       | Curve smoothness |
| `--text-fit`            | `*`        | `contain` | Fit mode         |

### Bevel Options

| Property                 | Type       | Default | Description           |
| ------------------------ | ---------- | ------- | --------------------- |
| `--text-bevel-size`      | `<number>` | `0`     | Bevel radius          |
| `--text-bevel-thickness` | `<number>` | `0`     | Bevel depth           |
| `--text-bevel-offset`    | `<number>` | `0`     | Bevel position offset |
| `--text-bevel-steps`     | `<number>` | `0`     | Bevel segment count   |

---

## Text Depth

Control extrusion thickness:

```css
/* Thin text */
.thin-text {
  --text-depth: 2;
}

/* Medium text */
.medium-text {
  --text-depth: 10;
}

/* Thick text */
.thick-text {
  --text-depth: 30;
}
```

---

## Bevel Effects

Add rounded edges to text.

### Basic Bevel

```html
<div
  string="3d"
  string-3d="text"
  style="
    font-size: 72px;
    --text-depth: 15;
    --text-bevel-size: 2;
    --text-bevel-thickness: 2;
  "
>
  BEVEL
</div>
```

### Smooth Bevel

Increase steps for smoother curves:

```css
.smooth-bevel {
  --text-bevel-size: 3;
  --text-bevel-thickness: 3;
  --text-bevel-steps: 5;
}
```

### Bevel Parameters

```
                 ┌─── bevel-size ───┐
                 │                  │
    ┌────────────┘                  └────────────┐
    │                                            │
    │            TEXT FACE                       │ ← text-depth
    │                                            │
    └────────────┐                  ┌────────────┘
                 │                  │
                 └─── bevel-size ───┘
                        ↑
                  bevel-thickness
```

---

## Material & Appearance

Apply materials to 3D text:

```html
<div
  string="3d"
  string-3d="text"
  style="
    font-size: 64px;
    --material-type: standard;
    --material-color: #ffd700;
    --material-metalness: 0.9;
    --material-roughness: 0.2;
    --text-depth: 20;
    --text-bevel-size: 2;
    --text-bevel-steps: 3;
  "
>
  GOLD
</div>
```

### Emissive Text

```css
.glowing-text {
  --material-type: standard;
  --material-color: #00ffff;
  --material-emissive: #00ffff;
  --filter: bloom(0.6, 0.3);
}
```

---

## Font Matching

The `font-family` CSS property determines which registered font is used:

```html
<div
  string="3d"
  string-3d="text"
  style="font-family: 'Roboto', 'Helvetica', sans-serif;"
>
  Text
</div>
```

Resolution order:

1. First matching registered font name
2. Default font (if set)
3. Warning if no font found

---

## Fit Modes

Control how text scales to element bounds.

### Contain (Default)

Text fits within element, maintaining aspect ratio:

```css
.contain-text {
  --text-fit: contain;
}
```

### Cover

Text fills element, may overflow:

```css
.cover-text {
  --text-fit: cover;
}
```

---

## Dynamic Text

Text updates automatically when content changes:

```html
<div
  string="3d"
  string-3d="text"
  id="counter"
  style="font-size: 48px;"
>
  0
</div>

<script>
  let count = 0;
  setInterval(() => {
    document.getElementById("counter").textContent = ++count;
  }, 1000);
</script>
```

---

## Transform Support

Apply standard 3D transforms:

```css
.transformed-text {
  font-size: 48px;
  --translate-z: 50;
  --rotate-y: 30;
  --scale: 1.2;
  --text-depth: 10;
}
```

---

## Examples

### Chrome Title

```html
<div
  string="3d"
  string-3d="text"
  class="chrome-title"
>
  CHROME
</div>

<style>
  .chrome-title {
    font-family: "Roboto";
    font-size: 96px;
    --material-type: standard;
    --material-color: #e8e8e8;
    --material-metalness: 1;
    --material-roughness: 0.1;
    --text-depth: 25;
    --text-bevel-size: 3;
    --text-bevel-thickness: 3;
    --text-bevel-steps: 4;
  }
</style>
```

### Neon Sign

```html
<div
  string="3d"
  string-3d="text"
  class="neon-sign"
>
  OPEN
</div>

<style>
  .neon-sign {
    font-family: "Roboto";
    font-size: 72px;
    --material-type: standard;
    --material-color: #ff0066;
    --material-emissive: #ff0066;
    --text-depth: 5;
    --text-bevel-size: 1;
    --filter: bloom(0.8, 0.2);
  }
</style>
```

### Wooden Sign

```html
<div
  string="3d"
  string-3d="text"
  class="wooden-text"
>
  WOOD
</div>

<style>
  .wooden-text {
    font-family: "Roboto";
    font-size: 64px;
    --material-type: standard;
    --texture-map: url("/textures/wood.jpg");
    --material-roughness: 0.8;
    --text-depth: 30;
    --text-bevel-size: 2;
    --text-bevel-steps: 2;
  }
</style>
```

### Plastic Letters

```html
<div
  string="3d"
  string-3d="text"
  class="plastic-text"
>
  PLASTIC
</div>

<style>
  .plastic-text {
    font-family: "Roboto";
    font-size: 56px;
    --material-type: standard;
    --material-color: #ff4444;
    --material-metalness: 0;
    --material-roughness: 0.4;
    --text-depth: 12;
    --text-bevel-size: 1;
    --text-bevel-steps: 2;
  }
</style>
```

---

## Performance Notes

- Complex fonts with many curves impact performance
- Reduce `--text-curve-segments` for faster rendering
- Bevel adds significant geometry
- Large text count impacts memory
- Consider pre-baking static text as models
