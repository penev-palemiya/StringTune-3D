# Core Concepts

Understanding the key concepts behind StringTune-3D.

## CSS-First Architecture

StringTune-3D follows a **CSS-first** philosophy. Instead of manipulating 3D objects through JavaScript APIs, you control them through CSS custom properties.

```css
.my-3d-object {
  /* Transform */
  --translate-z: 50;
  --rotate-y: 45;
  --scale: 1.5;

  /* Material */
  --material-color: #667eea;
  --opacity: 0.8;
}
```

### Benefits

- **Declarative** — Define 3D state in CSS, not imperative code
- **Animatable** — Use CSS transitions and animations
- **Responsive** — Use media queries for different screen sizes
- **Familiar** — Leverage existing CSS knowledge

## DOM-3D Synchronization

Each HTML element with `string-3d` attribute has a corresponding 3D object. The system automatically synchronizes:

| DOM Property                 | 3D Equivalent               |
| ---------------------------- | --------------------------- |
| Element position (x, y)      | Object position in 3D space |
| Element size (width, height) | Object scale                |
| CSS `--translate-z`          | Z-axis position             |
| CSS `--rotate-x/y/z`         | Rotation                    |
| CSS `--scale`                | Uniform scale               |

```html
<!-- DOM element at (100, 200) with size 150x150 -->
<div
  style="position: absolute; left: 100px; top: 200px; width: 150px; height: 150px"
  string="3d"
  string-3d="box"
></div>
<!-- 3D box appears at corresponding 3D coordinates -->
```

## Provider Pattern

StringTune-3D abstracts the 3D engine through the **Provider** pattern:

```typescript
// Currently available: ThreeJSProvider
String3D.setProvider(new ThreeJSProvider(THREE, loaders));
```

This enables:

- Engine-agnostic code
- Future support for other engines
- Consistent API regardless of backend

## Module Registration

StringTune-3D integrates with StringTune as a module:

```typescript
const stringTune = StringTune.getInstance();

stringTune.use(String3D, {
  hideHTML: false, // Show/hide HTML elements
  container: "#canvas", // Custom container element
  zIndex: 1, // Canvas stacking order
  useDirtySync: false, // Performance optimization
  styleReadIntervalMs: 0, // Style read throttling
  layoutReadIntervalMs: 0, // Layout read throttling
});

stringTune.start(60); // Start at 60 FPS
```

## Element Hierarchy

### Groups

Create parent-child relationships using `string-3d="group"`:

```html
<div
  string="3d"
  string-3d="group"
  style="--rotate-y: 45;"
>
  <div
    string="3d"
    string-3d="box"
  ></div>
  <div
    string="3d"
    string-3d="sphere"
  ></div>
</div>
```

Child objects inherit parent transformations. The group itself is invisible.

### Root Objects

Objects not inside a group are **root objects** added directly to the scene.

## Lifecycle

```
1. StringTune detects [string="3d"] element
2. String3D.onObjectConnected() is called
3. 3D object is created based on string-3d type
4. Each frame:
   - Read element layout (position, size)
   - Read CSS custom properties
   - Sync 3D object transforms
   - Render the scene
```

## Coordinate System

StringTune-3D uses a **screen-space to world-space** mapping:

```
Screen (CSS)              World (3D)
─────────────────         ─────────────────
Origin: top-left          Origin: center
X: right positive         X: right positive
Y: down positive          Y: up positive
Z: N/A                    Z: toward camera positive
```

The camera is positioned at Z=1000 looking at origin. Objects with `--translate-z: 0` appear at the Z=0 plane.

## Camera Modes

### Orthographic (Default)

No perspective distortion. Objects maintain size regardless of Z position.

```typescript
// Internal: used by default
new String3DCamera(engine, "orthographic");
```

### Perspective

Objects appear smaller when farther away. Enable by modifying the camera internally (advanced use).

## Next Steps

- [CSS Properties](../reference/css-properties.md) — Full property reference
- [3D Objects](../reference/3d-objects.md) — Available object types
- [Materials](../reference/materials.md) — Material configuration
