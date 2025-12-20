# StringTune-3D

## Overview

**StringTune-3D** is a powerful 3D graphics module for the StringTune ecosystem. It provides seamless integration of 3D objects with HTML elements using a simple attribute-based approach. StringTune-3D works exclusively within the StringTune framework and enables automatic synchronization between DOM elements and 3D objects rendered via Three.js.

> ⚠️ **Important**: StringTune-3D is a module for StringTune and requires the base `@fiddle-digital/string-tune` package to function.

### Key Features

- **Attribute-Based 3D**: Add 3D objects to your HTML using simple `string-3d` attributes
- **Engine Abstraction**: Currently supports Three.js with more engines planned
- **Automatic Synchronization**: 3D objects automatically follow DOM element positions and transformations
- **Type-Safe**: Built with TypeScript for excellent developer experience
- **Modular Architecture**: Lightweight addition to your StringTune setup
- **Performance-Oriented**: Optimized for smooth 3D rendering

### Supported 3D Engines

- **Three.js** - Full support via ThreeJSProvider

## Installation

First, install the base StringTune library:

```bash
npm install @fiddle-digital/string-tune
```

Then install StringTune-3D:

```bash
npm install string-tune-3d
```

For Three.js support, also install Three.js:

```bash
npm install three
```

## Quick Start

### 1. Import Dependencies

```typescript
import { StringTune } from "@fiddle-digital/string-tune";
import { String3D, ThreeJSProvider } from "string-tune-3d";
import * as THREE from "three";
```

### 2. Initialize StringTune with 3D Support

```typescript
// Set the 3D provider (Three.js)
String3D.setProvider(new ThreeJSProvider(THREE));

// Get StringTune instance and register the 3D module
const stringTune = StringTune.getInstance();
stringTune.use(String3D);

// Start StringTune
stringTune.start(60); // 60 FPS
```

### 3. Add 3D Objects in HTML

```html
<!-- 3D Box -->
<div
  class="shape"
  string="3d"
  string-3d="box"
  string-3d-material="standard[#667eea]"
  string-3d-opacity="0.5"
>
  BOX
</div>

<!-- Ambient Light -->
<div
  string="3d"
  string-3d="ambientLight"
  string-3d-color="#ffffff"
  string-3d-intensity="0.5"
></div>

<!-- Directional Light -->
<div
  string="3d"
  string-3d="directionalLight"
  string-3d-color="#ffffff"
  string-3d-intensity="1"
></div>
```

### 4. Basic Styling

```css
.shape {
  width: 200px;
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  transition: --rotate-x 0.3s, --rotate-y 0.3s;
}

.shape:hover {
  --rotate-x: 45;
  --rotate-y: 45;
}
```

## Available Attributes

### Core Attributes

- `string="3d"` - Enables 3D for the element
- `string-3d="<type>"` - Type of 3D object: `box`, `sphere`, `plane`, `ambientLight`, `directionalLight`, etc.

### Material & Appearance

- `string-3d-material="<type>[<color>]"` - Material type: `basic`, `standard`, `phong`
- `string-3d-color="<color>"` - Object or light color
- `string-3d-opacity="<number>"` - Opacity (0-1)

### Lighting

- `string-3d-intensity="<number>"` - Light intensity

## License

MIT © [penev.tech](https://penev.tech)

## Links

- [GitHub Repository](https://github.com/penev-tech/stringtune-3d)
- [Issues](https://github.com/penev-tech/stringtune-3d/issues)
- [StringTune Main Library](https://www.npmjs.com/package/@fiddle-digital/string-tune)
