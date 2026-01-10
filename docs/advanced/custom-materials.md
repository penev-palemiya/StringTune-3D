# Custom Materials

Create custom shader-based materials for advanced visual effects.

## Overview

StringTune-3D allows you to register custom materials with GLSL shaders that integrate with the CSS-driven system.

## Material Registration

```typescript
import { String3DCustomMaterialRegistry } from "string-tune-3d";

String3DCustomMaterialRegistry.register({
  name: "hologram",
  extends: "standard",
  uniforms: {
    uTime: { type: "float", value: 0, css: "--time" },
    uScanlines: { type: "float", value: 50, css: "--scanlines" },
    uColor: { type: "color", value: "#00ffff", css: "--hologram-color" },
  },
  injections: [
    {
      point: "fragment_color",
      code: `
        float scanline = sin(vUv.y * uScanlines + uTime * 5.0) * 0.5 + 0.5;
        diffuseColor.rgb *= 0.7 + scanline * 0.3;
        diffuseColor.a *= 0.8;
      `,
    },
  ],
  properties: {
    transparent: true,
    side: "double",
  },
});
```

## Definition Schema

```typescript
type String3DCustomMaterialDefinition = {
  name: string; // Material identifier (lowercase)
  extends?: "basic" | "standard" | "physical" | "shader";

  // Full shader replacement (when extends is "shader")
  vertexShader?: string;
  fragmentShader?: string;

  // Shader code injections (when extending)
  injections?: ShaderInjection[];

  // Uniforms with optional CSS binding
  uniforms?: Record<string, UniformDefinition>;

  // Material properties
  properties?: {
    transparent?: boolean;
    side?: "front" | "back" | "double";
    depthWrite?: boolean;
    depthTest?: boolean;
    blending?: "normal" | "additive" | "subtractive" | "multiply";
    wireframe?: boolean;
  };

  lights?: boolean; // Respond to scene lights

  // Custom CSS parsing
  parse?: (element: HTMLElement, style: CSSStyleDeclaration) => Record<string, any>;
};
```

---

## Uniform Types

| Type      | GLSL        | CSS Syntax | Example    |
| --------- | ----------- | ---------- | ---------- |
| `float`   | `float`     | `<number>` | `1.5`      |
| `int`     | `int`       | `<number>` | `10`       |
| `vec2`    | `vec2`      | `*`        | `0.5 0.5`  |
| `vec3`    | `vec3`      | `*`        | `1 0 0`    |
| `vec4`    | `vec4`      | `*`        | `1 0 0 1`  |
| `color`   | `vec3`      | `<color>`  | `#ff0000`  |
| `texture` | `sampler2D` | URL        | `url(...)` |
| `mat3`    | `mat3`      | `*`        | —          |
| `mat4`    | `mat4`      | `*`        | —          |

### Uniform Definition

```typescript
type UniformDefinition = {
  type: UniformType;
  value: any; // Default value
  css?: string; // CSS custom property name
};
```

---

## Shader Injection Points

Inject code into specific shader locations:

| Point               | Location                       | Use Case                   |
| ------------------- | ------------------------------ | -------------------------- |
| `vertex_pars`       | Top of vertex shader           | Declare varyings, uniforms |
| `vertex_header`     | Start of main()                | Initialize variables       |
| `vertex_transform`  | After transform calculation    | Modify positions           |
| `vertex_output`     | End of main()                  | Pass to fragment           |
| `fragment_pars`     | Top of fragment shader         | Declare varyings, uniforms |
| `fragment_header`   | Start of main()                | Initialize variables       |
| `fragment_color`    | After diffuseColor calculation | Modify color               |
| `fragment_normal`   | After normal calculation       | Modify normals             |
| `fragment_emissive` | After emissive calculation     | Add glow                   |
| `fragment_output`   | Before final output            | Final adjustments          |

### Injection Definition

```typescript
type ShaderInjection = {
  point: ShaderInjectionPoint;
  code: string;
  order?: number; // Lower = earlier (default: 0)
};
```

---

## Examples

### Rim Light Material

```typescript
String3DCustomMaterialRegistry.register({
  name: "rimlight",
  extends: "standard",
  uniforms: {
    uRimColor: { type: "color", value: "#00c8ff", css: "--rim-color" },
    uRimPower: { type: "float", value: 2.0, css: "--rim-power" },
    uRimStrength: { type: "float", value: 1.0, css: "--rim-strength" },
  },
  injections: [
    {
      point: "fragment_pars",
      code: `
        uniform vec3 uRimColor;
        uniform float uRimPower;
        uniform float uRimStrength;
      `,
    },
    {
      point: "fragment_emissive",
      code: `
        vec3 viewDir = normalize(vViewPosition);
        float rim = 1.0 - max(0.0, dot(viewDir, normal));
        rim = pow(rim, uRimPower) * uRimStrength;
        totalEmissiveRadiance += uRimColor * rim;
      `,
    },
  ],
});
```

Usage:

```html
<div
  string="3d"
  string-3d="sphere"
  style="
    --material-type: rimlight;
    --material-color: #333333;
    --rim-color: #00ffff;
    --rim-power: 3;
    --rim-strength: 1.5;
  "
></div>
```

### Dissolve Material

```typescript
String3DCustomMaterialRegistry.register({
  name: "dissolve",
  extends: "standard",
  uniforms: {
    uProgress: { type: "float", value: 0, css: "--dissolve-progress" },
    uEdgeColor: { type: "color", value: "#ff4400", css: "--dissolve-edge" },
    uEdgeWidth: { type: "float", value: 0.1, css: "--dissolve-edge-width" },
    uNoiseScale: { type: "float", value: 5.0, css: "--dissolve-noise" },
  },
  properties: {
    transparent: true,
  },
  injections: [
    {
      point: "fragment_pars",
      code: `
        uniform float uProgress;
        uniform vec3 uEdgeColor;
        uniform float uEdgeWidth;
        uniform float uNoiseScale;
        
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
        }
        
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
            mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
            f.y
          );
        }
      `,
    },
    {
      point: "fragment_color",
      code: `
        float n = noise(vUv * uNoiseScale);
        float dissolve = smoothstep(uProgress - uEdgeWidth, uProgress, n);
        float edge = smoothstep(uProgress - uEdgeWidth, uProgress, n) - 
                     smoothstep(uProgress, uProgress + uEdgeWidth, n);
        
        if (n < uProgress) discard;
        
        diffuseColor.rgb = mix(diffuseColor.rgb, uEdgeColor, edge * 2.0);
      `,
    },
  ],
});
```

### Triplanar Mapping

```typescript
String3DCustomMaterialRegistry.register({
  name: "triplanar",
  extends: "standard",
  uniforms: {
    uScale: { type: "float", value: 1.0, css: "--triplanar-scale" },
    uSharpness: { type: "float", value: 2.0, css: "--triplanar-sharpness" },
  },
  injections: [
    {
      point: "vertex_pars",
      code: `
        varying vec3 vWorldPosition;
        varying vec3 vWorldNormal;
      `,
    },
    {
      point: "vertex_output",
      code: `
        vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
        vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
      `,
    },
    {
      point: "fragment_pars",
      code: `
        varying vec3 vWorldPosition;
        varying vec3 vWorldNormal;
        uniform float uScale;
        uniform float uSharpness;
      `,
    },
    {
      point: "fragment_color",
      code: `
        vec3 blending = pow(abs(vWorldNormal), vec3(uSharpness));
        blending /= dot(blending, vec3(1.0));
        
        vec3 xaxis = texture2D(map, vWorldPosition.yz * uScale).rgb;
        vec3 yaxis = texture2D(map, vWorldPosition.xz * uScale).rgb;
        vec3 zaxis = texture2D(map, vWorldPosition.xy * uScale).rgb;
        
        diffuseColor.rgb = xaxis * blending.x + yaxis * blending.y + zaxis * blending.z;
      `,
    },
  ],
});
```

---

## Full Custom Shader

For complete shader control:

```typescript
String3DCustomMaterialRegistry.register({
  name: "gradient",
  extends: "shader",
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 uColorA;
    uniform vec3 uColorB;
    uniform float uAngle;
    varying vec2 vUv;
    
    void main() {
      float angle = uAngle * 3.14159 / 180.0;
      vec2 dir = vec2(cos(angle), sin(angle));
      float t = dot(vUv - 0.5, dir) + 0.5;
      vec3 color = mix(uColorA, uColorB, t);
      gl_FragColor = vec4(color, 1.0);
    }
  `,
  uniforms: {
    uColorA: { type: "color", value: "#ff0000", css: "--gradient-start" },
    uColorB: { type: "color", value: "#0000ff", css: "--gradient-end" },
    uAngle: { type: "float", value: 0, css: "--gradient-angle" },
  },
});
```

---

## Custom Parse Function

Override CSS parsing:

```typescript
String3DCustomMaterialRegistry.register({
  name: "special",
  extends: "standard",
  uniforms: {
    uCustom: { type: "vec3", value: [0, 0, 0] },
  },
  parse: (element, style) => {
    const raw = style.getPropertyValue("--special-data").trim();
    const parts = raw.split(",").map(parseFloat);
    return {
      uCustom: parts.length === 3 ? parts : [0, 0, 0],
    };
  },
});
```

---

## API Methods

```typescript
// Register material
String3DCustomMaterialRegistry.register(definition);

// Check existence
String3DCustomMaterialRegistry.has("materialName");

// Get definition
String3DCustomMaterialRegistry.get("materialName");

// List all
String3DCustomMaterialRegistry.list();

// Unregister
String3DCustomMaterialRegistry.unregister("materialName");
```

---

## Best Practices

1. **Use descriptive names** — Lowercase, hyphenated
2. **Prefer injection** — Extend existing materials when possible
3. **CSS binding** — Expose key parameters as CSS properties
4. **Fallback values** — Always provide sensible defaults
5. **Performance** — Minimize texture lookups and complex math
6. **Test combinations** — Ensure materials work with lighting and shadows
