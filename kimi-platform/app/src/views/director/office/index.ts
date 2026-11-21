/**
 * Office Blueprint & Ownership Whiteboard — public surface.
 * Presentation layer only: components consume Availability<T> envelopes
 * and callbacks; the adapter seam lives in workspace/adapter.ts.
 */
export * from "./model";
export * from "./derive";
export { default as OfficeBlueprint } from "./OfficeBlueprint";
export { default as TeamBoard } from "./TeamBoard";
export { default as RoomCard } from "./RoomCard";
export { default as AgentChip } from "./AgentChip";
export { default as ReassignMenu } from "./ReassignMenu";
export { default as SetupChecklist } from "./SetupChecklist";
export { default as DigitalRolesPanel } from "./DigitalRolesPanel";
export { default as OwnershipInspector } from "./OwnershipInspector";
export { default as OwnershipWhiteboard } from "./OwnershipWhiteboard";
export { default as WhiteboardCanvas } from "./WhiteboardCanvas";
export { default as WhiteboardList } from "./WhiteboardList";
export { default as EditLeaseBar } from "./EditLeaseBar";
export { default as ConflictDialog } from "./ConflictDialog";
export { default as VersionRail } from "./VersionRail";
export { default as ExportMenu } from "./ExportMenu";
export type { WbExportPayload } from "./ExportMenu";
export type { SaveConflict } from "./ConflictDialog";
