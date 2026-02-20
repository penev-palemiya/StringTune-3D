import { String3DCamera } from "../String3DCamera";
import { I3DEngine } from "../abstractions/I3DEngine";
import type { String3DScene } from "../String3DScene";

export interface SyncContext {
  camera: String3DCamera;
  viewportWidth: number;
  viewportHeight: number;
  engine: I3DEngine;
  scene?: String3DScene;
  dirtySet?: Set<HTMLElement> | null;
  forceSync?: boolean;
  styleReadIntervalMs?: number;
  layoutReadIntervalMs?: number;
}
