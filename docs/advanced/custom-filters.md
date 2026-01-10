# Custom Filters

Create custom post-processing effects for 3D objects.

## Overview

StringTune-3D allows you to register custom fragment shaders as filters that integrate with the `--filter` CSS property.

## Filter Registration

```typescript
import { String3DCustomFilterRegistry } from "string-tune-3d";

String3DCustomFilterRegistry.register({
  name: "vignette",
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uIntensity;
    uniform float uSmoothness;
    varying vec2 vUv;
    
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      vec2 uv = vUv - 0.5;
      float dist = length(uv);
      float vignette = smoothstep(0.5, 0.5 - uSmoothness, dist * uIntensity);
      gl_FragColor = color * vignette;
    }
  `,
  uniforms: {
    uIntensity: 1.5,
    uSmoothness: 0.4,
  },
  parse: (args) => {
    const parts = args.split(",").map((s) => parseFloat(s.trim()));
    return {
      uIntensity: parts[0] || 1.5,
      uSmoothness: parts[1] || 0.4,
    };
  },
});
```

## Definition Schema

```typescript
type String3DCustomFilterDefinition = {
  name: string; // Filter name (lowercase)
  fragmentShader: string; // GLSL fragment shader code
  uniforms?: Record<string, any>; // Default uniform values
  parse?: (args: string) => Record<string, any> | null; // Parse filter arguments
};
```

---

## Shader Requirements

### Required Uniforms

Your shader receives these automatically:

| Uniform       | Type        | Description        |
| ------------- | ----------- | ------------------ |
| `tDiffuse`    | `sampler2D` | Input texture      |
| `uResolution` | `vec2`      | Render target size |

### Required Varying

```glsl
varying vec2 vUv;  // UV coordinates (0-1)
```

### Basic Template

```glsl
uniform sampler2D tDiffuse;
uniform vec2 uResolution;
varying vec2 vUv;

void main() {
  vec4 color = texture2D(tDiffuse, vUv);
  // Your effect code here
  gl_FragColor = color;
}
```

---

## Examples

### Chromatic Aberration

```typescript
String3DCustomFilterRegistry.register({
  name: "chromatic",
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uOffset;
    varying vec2 vUv;
    
    void main() {
      vec2 dir = vUv - 0.5;
      float dist = length(dir);
      vec2 offset = dir * dist * uOffset * 0.01;
      
      float r = texture2D(tDiffuse, vUv - offset).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv + offset).b;
      
      gl_FragColor = vec4(r, g, b, 1.0);
    }
  `,
  uniforms: { uOffset: 5.0 },
  parse: (args) => ({ uOffset: parseFloat(args) || 5.0 }),
});
```

Usage:

```css
.aberration {
  --filter: chromatic(8);
}
```

### Scanlines

```typescript
String3DCustomFilterRegistry.register({
  name: "scanlines",
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 uResolution;
    uniform float uDensity;
    uniform float uOpacity;
    varying vec2 vUv;
    
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float line = mod(gl_FragCoord.y, uDensity) / uDensity;
      float scanline = smoothstep(0.0, 0.5, line) * smoothstep(1.0, 0.5, line);
      color.rgb *= 1.0 - (1.0 - scanline) * uOpacity;
      gl_FragColor = color;
    }
  `,
  uniforms: { uDensity: 4.0, uOpacity: 0.3 },
  parse: (args) => {
    const parts = args.split(",").map((s) => parseFloat(s.trim()));
    return {
      uDensity: parts[0] || 4.0,
      uOpacity: parts[1] || 0.3,
    };
  },
});
```

Usage:

```css
.retro {
  --filter: scanlines(3, 0.5);
}
```

### Noise/Grain

```typescript
String3DCustomFilterRegistry.register({
  name: "grain",
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uAmount;
    uniform float uTime;
    varying vec2 vUv;
    
    float random(vec2 co) {
      return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
    }
    
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float noise = random(vUv + uTime) * 2.0 - 1.0;
      color.rgb += noise * uAmount;
      gl_FragColor = color;
    }
  `,
  uniforms: { uAmount: 0.1, uTime: 0.0 },
  parse: (args) => ({ uAmount: parseFloat(args) || 0.1 }),
});
```

Usage:

```css
.grainy {
  --filter: grain(0.15);
}
```

### Color Tint

```typescript
String3DCustomFilterRegistry.register({
  name: "tint",
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec3 uColor;
    uniform float uStrength;
    varying vec2 vUv;
    
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      color.rgb = mix(color.rgb, color.rgb * uColor, uStrength);
      gl_FragColor = color;
    }
  `,
  uniforms: { uColor: [1.0, 0.9, 0.8], uStrength: 0.5 },
  parse: (args) => {
    // Parse: tint(#ffcc88, 0.5) or tint(1 0.9 0.8, 0.5)
    const match = args.match(/([^,]+),\s*([\d.]+)/);
    if (!match) return null;

    let color = [1, 1, 1];
    const colorStr = match[1].trim();

    if (colorStr.startsWith("#")) {
      const hex = colorStr.slice(1);
      color = [
        parseInt(hex.slice(0, 2), 16) / 255,
        parseInt(hex.slice(2, 4), 16) / 255,
        parseInt(hex.slice(4, 6), 16) / 255,
      ];
    } else {
      color = colorStr.split(" ").map(parseFloat);
    }

    return {
      uColor: color,
      uStrength: parseFloat(match[2]) || 0.5,
    };
  },
});
```

Usage:

```css
.warm {
  --filter: tint(#ffcc88, 0.3);
}
.cool {
  --filter: tint(#88ccff, 0.3);
}
```

### Sharpen

```typescript
String3DCustomFilterRegistry.register({
  name: "sharpen",
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 uResolution;
    uniform float uStrength;
    varying vec2 vUv;
    
    void main() {
      vec2 texel = 1.0 / uResolution;
      
      vec4 center = texture2D(tDiffuse, vUv);
      vec4 left = texture2D(tDiffuse, vUv - vec2(texel.x, 0.0));
      vec4 right = texture2D(tDiffuse, vUv + vec2(texel.x, 0.0));
      vec4 top = texture2D(tDiffuse, vUv - vec2(0.0, texel.y));
      vec4 bottom = texture2D(tDiffuse, vUv + vec2(0.0, texel.y));
      
      vec4 sharpened = center * (1.0 + 4.0 * uStrength) 
                     - (left + right + top + bottom) * uStrength;
      
      gl_FragColor = clamp(sharpened, 0.0, 1.0);
    }
  `,
  uniforms: { uStrength: 0.5 },
  parse: (args) => ({ uStrength: parseFloat(args) || 0.5 }),
});
```

Usage:

```css
.crisp {
  --filter: sharpen(0.3);
}
```

### Barrel Distortion

```typescript
String3DCustomFilterRegistry.register({
  name: "barrel",
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uStrength;
    varying vec2 vUv;
    
    void main() {
      vec2 uv = vUv - 0.5;
      float dist = length(uv);
      float distortion = 1.0 + dist * dist * uStrength;
      vec2 distortedUv = uv * distortion + 0.5;
      
      if (distortedUv.x < 0.0 || distortedUv.x > 1.0 ||
          distortedUv.y < 0.0 || distortedUv.y > 1.0) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      } else {
        gl_FragColor = texture2D(tDiffuse, distortedUv);
      }
    }
  `,
  uniforms: { uStrength: 0.5 },
  parse: (args) => ({ uStrength: parseFloat(args) || 0.5 }),
});
```

Usage:

```css
.fish-eye {
  --filter: barrel(1.5);
}
.pincushion {
  --filter: barrel(-0.3);
}
```

---

## Combining with Built-in Filters

Chain custom and built-in filters:

```css
.complex-effect {
  --filter: blur(1px) chromatic(5) scanlines(4, 0.2) bloom(0.3, 0.5);
}
```

Filters apply left to right.

---

## Animation

Animate filter parameters:

```css
@keyframes glitch {
  0%,
  100% {
    --filter: chromatic(0);
  }
  50% {
    --filter: chromatic(15);
  }
}

.glitching {
  animation: glitch 0.1s infinite;
}
```

---

## API Methods

```typescript
// Register filter
String3DCustomFilterRegistry.register(definition);

// Check existence
String3DCustomFilterRegistry.has("filterName");

// Get definition
String3DCustomFilterRegistry.get("filterName");

// List all
String3DCustomFilterRegistry.list();
```

---

## Best Practices

1. **Unique names** — Use descriptive, lowercase names
2. **Provide defaults** — Always include sensible uniform defaults
3. **Robust parsing** — Handle edge cases in parse function
4. **Performance** — Minimize texture lookups
5. **Clamp outputs** — Prevent color overflow
6. **Document parameters** — Comment expected argument format
