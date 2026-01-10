# Performance Optimization

Best practices for optimal StringTune-3D performance.

## Overview

StringTune-3D synchronizes DOM elements with 3D objects every frame. Performance depends on:

- Number of 3D objects
- Geometry complexity
- Material/shader complexity
- Filter usage
- DOM read frequency

---

## Dirty Sync Mode

Enable dirty sync to only update changed elements:

```typescript
stringTune.use(String3D, {
  useDirtySync: true,
});
```

### How It Works

- Observes DOM mutations (style, class, attributes)
- Only syncs elements that changed
- Significantly reduces per-frame work

### When to Use

- Many static 3D objects
- Occasional style changes
- Large scenes (50+ objects)

### When to Avoid

- Constant CSS animations on all objects
- Very dynamic scenes
- Few objects (< 10)

---

## Read Throttling

Reduce CSS/layout read frequency:

```typescript
stringTune.use(String3D, {
  styleReadIntervalMs: 16, // Read styles max every 16ms
  layoutReadIntervalMs: 16, // Read layout max every 16ms
});
```

### Values

| Value | Effect                     |
| ----- | -------------------------- |
| `0`   | Read every frame (default) |
| `16`  | ~60Hz read rate            |
| `33`  | ~30Hz read rate            |
| `100` | 10Hz read rate             |

### Trade-offs

- Higher values = better performance
- Higher values = less responsive animations
- Find balance for your use case

---

## Geometry Optimization

### Reduce Segment Count

```css
/* Default sphere: 32x32 segments */
.optimized-sphere {
  --geometry-quality: 0.5; /* 16x16 segments */
}
```

### Quality Levels

| Quality | Segments | Use Case              |
| ------- | -------- | --------------------- |
| `0.25`  | Very low | Many distant objects  |
| `0.5`   | Low      | Background objects    |
| `1`     | Default  | Normal use            |
| `2`     | High     | Close-up hero objects |

### Per-Object Attributes

```html
<div
  string="3d"
  string-3d="sphere"
  string-3d-segments="16"
></div>
```

---

## Model Optimization

### Pre-Optimize Models

- Reduce polygon count in modeling software
- Use LOD (Level of Detail) when possible
- Remove unnecessary data (animations, cameras)

### Model Loading

```html
<!-- Good: smaller file -->
<div
  string-3d="model"
  string-3d-model="/models/optimized.glb"
></div>

<!-- Avoid: huge file -->
<div
  string-3d="model"
  string-3d-model="/models/4k-textured-scene.glb"
></div>
```

### Model Fit

```html
<!-- contain: fits without overflow (faster) -->
<div string-3d-model-fit="contain"></div>

<!-- cover: fills completely (more calculations) -->
<div string-3d-model-fit="cover"></div>
```

---

## Material Optimization

### Prefer Basic Materials

```css
/* Faster: no lighting calculations */
.fast {
  --material-type: basic;
}

/* Slower: full PBR lighting */
.pretty {
  --material-type: standard;
}
```

### Texture Sizes

| Use Case      | Max Size  |
| ------------- | --------- |
| Mobile        | 512x512   |
| Desktop       | 1024x1024 |
| Hero/close-up | 2048x2048 |

### Fewer Texture Maps

```css
/* Faster: single texture */
.simple {
  --texture-map: url("/wood.jpg");
}

/* Slower: full PBR */
.detailed {
  --texture-map: url("/wood_diffuse.jpg");
  --texture-normal: url("/wood_normal.jpg");
  --texture-roughness: url("/wood_rough.jpg");
  --texture-ao: url("/wood_ao.jpg");
}
```

---

## Lighting Optimization

### Minimize Light Count

```html
<!-- Good: 2-3 lights -->
<div string-3d="ambientLight"></div>
<div string-3d="directionalLight"></div>

<!-- Avoid: many lights -->
<div string-3d="pointLight"></div>
<div string-3d="pointLight"></div>
<div string-3d="pointLight"></div>
<div string-3d="spotLight"></div>
<div string-3d="spotLight"></div>
```

### Shadow Performance

| Setting                   | Impact    |
| ------------------------- | --------- |
| `--shadow-cast: 0`        | Fastest   |
| `--shadow-map-size: 256`  | Fast      |
| `--shadow-map-size: 512`  | Default   |
| `--shadow-map-size: 1024` | Slow      |
| `--shadow-map-size: 2048` | Very slow |

### Shadow Tips

- Use shadows sparingly
- Reduce map size on mobile
- Single shadow-casting light is often enough

---

## Filter Optimization

### Filter Cost

| Filter       | Cost   | Notes           |
| ------------ | ------ | --------------- |
| `brightness` | Low    | Single pass     |
| `contrast`   | Low    | Single pass     |
| `grayscale`  | Low    | Single pass     |
| `blur`       | Medium | Two passes      |
| `pixel`      | Medium | Single pass     |
| `bloom`      | High   | Multiple passes |

### Reduce Bloom Quality

Use lower threshold for fewer bright pixels:

```css
.optimized-bloom {
  --filter: bloom(0.5, 0.7); /* Higher threshold */
}
```

### Avoid Filter Stacking

```css
/* Expensive: 4 filters */
.heavy {
  --filter: blur(2px) bloom(0.5, 0.3) contrast(1.1) saturate(1.2);
}

/* Better: combine into custom filter or reduce */
.lighter {
  --filter: bloom(0.4, 0.4);
}
```

---

## Particle Optimization

### Particle Count

| Count     | Performance |
| --------- | ----------- |
| < 500     | Smooth      |
| 500-2000  | Moderate    |
| 2000-5000 | Heavy       |
| > 5000    | Very heavy  |

### Instance vs Emitter

```css
/* Faster for static effects */
.stars {
  --particles-mode: instanced;
  --particles-count: 1000;
}

/* Slower but dynamic */
.fire {
  --particles-mode: emitter;
  --particles-count: 500;
}
```

### Particle Tips

- Reduce `--particle-life` for faster recycling
- Use `--particles-fit: 1` to constrain area
- Lower `--emit-rate` when possible

---

## DOM Optimization

### Minimize Reflows

```css
/* Good: fixed size */
.fixed-3d {
  width: 200px;
  height: 200px;
}

/* Avoid: dynamic size causing reflows */
.dynamic-3d {
  width: fit-content;
}
```

### Hide HTML Elements

```typescript
stringTune.use(String3D, {
  hideHTML: true, // Hides HTML, shows only 3D
});
```

Removes HTML rendering overhead when 3D replaces content.

### Use Groups

```html
<!-- Good: transforms apply to group -->
<div
  string-3d="group"
  style="--rotate-y: 45;"
>
  <div string-3d="box"></div>
  <div string-3d="box"></div>
  <div string-3d="box"></div>
</div>

<!-- Avoid: individual transforms -->
<div
  string-3d="box"
  style="--rotate-y: 45;"
></div>
<div
  string-3d="box"
  style="--rotate-y: 45;"
></div>
<div
  string-3d="box"
  style="--rotate-y: 45;"
></div>
```

---

## Animation Optimization

### CSS Transitions vs Keyframes

```css
/* Good: hardware-accelerated */
.smooth {
  --rotate-y: 0;
  transition: --rotate-y 0.5s;
}

/* Also good: GPU animation */
@keyframes spin {
  to {
    --rotate-y: 360;
  }
}
```

### Avoid Constant Changes

```css
/* Expensive: constant animation */
.always-animating {
  animation: spin 1s infinite;
}

/* Better: animate on interaction */
.on-hover:hover {
  animation: spin 1s;
}
```

---

## Profiling

### Browser DevTools

1. Open DevTools → Performance
2. Record while interacting
3. Look for:
   - Long frame times (> 16ms)
   - Style recalculation
   - Layout thrashing

### Frame Rate

```typescript
// Monitor FPS
stringTune.start(60); // Target 60 FPS

// Reduce for mobile
stringTune.start(30); // Target 30 FPS
```

### Object Count

```typescript
// Check object count
const scene = /* get scene reference */;
console.log("Objects:", scene.getAllObjects().length);
```

---

## Mobile-Specific

### Reduce Everything

```css
/* Mobile styles */
@media (max-width: 768px) {
  [string-3d] {
    --geometry-quality: 0.5;
  }

  [string-3d="particles"] {
    --particles-count: 100;
  }
}
```

### Lower FPS

```typescript
// Detect mobile
const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
stringTune.start(isMobile ? 30 : 60);
```

### Disable Effects

```css
@media (max-width: 768px) {
  .fancy-effect {
    --filter: none;
    --shadow-cast: 0;
    --shadow-receive: 0;
  }
}
```
