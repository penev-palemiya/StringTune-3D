import { String3DObject } from "../String3DObject";
import type { SyncContext } from "./SyncContext";

export interface String3DObjectSyncStrategy {
  sync(el: HTMLElement, object: String3DObject, context: SyncContext, parentData: any): void;
  cleanup?(el: HTMLElement, object: String3DObject): void;
}
