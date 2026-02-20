import { I3DBackend, I3DEngine, I3DEngineCapabilities } from "./I3DEngine";

export interface I3DEngineProvider {
  initialize?(): void | Promise<void>;
  getEngine(): I3DEngine;
  getName(): string;
  getBackend?(): I3DBackend;
  getCapabilities?(): I3DEngineCapabilities;
}
