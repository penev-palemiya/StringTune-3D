import { String3DCamera } from "../String3DCamera";
import { I3DEngine } from "../abstractions/I3DEngine";

export interface SyncContext {
  camera: String3DCamera;
  viewportWidth: number;
  viewportHeight: number;
  engine: I3DEngine;
  dirtySet?: Set<HTMLElement> | null;
  forceSync?: boolean;
  styleReadIntervalMs?: number;
  layoutReadIntervalMs?: number;
}
