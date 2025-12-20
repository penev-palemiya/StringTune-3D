import { I3DEngine } from "./I3DEngine";

export interface I3DEngineProvider {
  getEngine(): I3DEngine;
  getName(): string;
}
