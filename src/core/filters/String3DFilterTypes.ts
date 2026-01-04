export type String3DFilterEffect =
  | { type: "blur"; amount: number }
  | { type: "pixel"; size: number }
  | { type: "bloom"; intensity: number; threshold: number }
  | { type: "brightness"; amount: number }
  | { type: "contrast"; amount: number }
  | { type: "saturate"; amount: number }
  | { type: "grayscale"; amount: number }
  | { type: "sepia"; amount: number }
  | { type: "invert"; amount: number }
  | { type: "hue-rotate"; angle: number }
  | { type: "custom"; name: string; uniforms: Record<string, any> };

export type String3DFilterChain = String3DFilterEffect[];

export type String3DFilterTarget = {
  object: import("../String3DObject").String3DObject;
  effects: String3DFilterChain;
  effectsKey: string;
  dirty: boolean;
};
