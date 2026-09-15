/**
 * The wire contract of the MacroRuntime Local API, as TypeScript types.
 *
 * These mirror the C# DTOs in `runtime/MacroRuntime/Api/` one for one. They
 * live here — not in the web app — because the web app is only one of the
 * front ends: the CLI and any other GUI need the same names for the same
 * things (spec §42).
 */
/**
 * How input is dispatched.
 *
 * `mock` records events without touching the machine — the safe default for
 * tests and for a UI that has not asked the user yet. `sendInput` dispatches
 * real Windows input into whatever window has focus.
 */
export type BackendName = 'mock' | 'sendInput';
/** 실행 방식 — how a group responds to its hotkey. */
export type MacroRunMode = 'Toggle' | 'Once' | 'Hold' | 'Count';
/** What a toggle call actually did, since the caller does not know the prior state. */
export type ToggleAction = 'Started' | 'Stopped';
export interface ActiveMacroInfo {
    macroId: string;
    backend: string;
    state: string;
}
/**
 * The result of the last automatic rebuild of one macro's source.
 *
 * The Runtime watches `macros/<id>/index.ts` and rebuilds on save — nobody runs
 * a build command — so this is where a typo shows up. A macro that was running
 * and compiled cleanly is restarted on the new code (`reloaded`); one that
 * failed to compile keeps running the last good version, and says why here.
 */
export interface ScriptIssue {
    macroId: string;
    /** The compiler's message, or null when it compiled. */
    error: string | null;
    /** When that rebuild finished, as an ISO timestamp. */
    atUtc: string;
    /** True when it was running and got restarted on the new code. */
    reloaded: boolean;
}
export interface RuntimeStatus {
    runtimeVersion: string;
    activeMacros: ActiveMacroInfo[];
    targetProcess: string | null;
    uptimeSeconds: number;
    /** Set when Windows refused to dispatch input — a macro that runs but sends nothing. */
    inputError: string | null;
    /** What saving a macro most recently did. Empty until something is saved. */
    scriptIssues: ScriptIssue[];
}
export interface MacroSummary {
    id: string;
    name: string;
    description: string;
    /** Editable default used only when first uploading this local script. */
    suggestedVisibility?: 'private' | 'public';
}
export interface RunMacroResponse {
    macroId: string;
    backend: string;
    state: string;
}
/** Metadata returned by the local Runtime for JSON DSL documents in remote storage. */
export interface RemoteJsonMacroSummary {
    id: string;
    name: string;
    revision: string;
    hash: string;
    updatedAt?: string;
}
export type NodeKind = 'press' | 'pressFor' | 'release' | 'keyDown' | 'keyUp' | 'hold' | 'wait' | 'click' | 'mouseDown' | 'mouseUp' | 'moveMouse' | 'waitForProcess' | 'repeat' | 'loop' | 'call' | 'tryFinally' | 'declare' | 'assign' | 'if' | 'while' | 'for';
export interface MacroNode {
    id: string;
    kind: NodeKind;
    key?: string;
    button?: string;
    ms?: string;
    times?: string;
    x?: string;
    y?: string;
    process?: string;
    children?: MacroNode[];
    /** The second half of try/finally — what runs whatever happens. */
    cleanup?: MacroNode[];
    target?: string;
    argumentsText?: string;
    runs?: string;
    comment?: string | null;
    trailing?: string | null;
    blankBefore?: boolean;
    declarationKind?: 'const' | 'let' | 'var';
    name?: string;
    typeText?: string | null;
    valueText?: string;
    operator?: '=' | '+=' | '-=' | '*=' | '/=';
    condition?: string;
    else_?: MacroNode[];
    init?: string;
    update?: string;
}
export interface MacroConstant {
    declarationKind?: 'const' | 'let' | 'var';
    name: string;
    typeText: string | null;
    valueText: string;
    comment: string | null;
    blankAfterComment?: boolean;
    trailing?: string | null;
    blankBefore?: boolean;
}
export interface MacroFunction {
    name: string;
    parametersText?: string;
    returnTypeText?: string | null;
    comment: string | null;
    children: MacroNode[];
}
export interface MacroGraph {
    constants: MacroConstant[];
    functions: MacroFunction[];
    nodes: MacroNode[];
}
/**
 * A file the editor cannot represent reports why instead of being
 * approximated — a lossy round trip would delete macro logic on save.
 */
export type ParseResult = {
    parsable: true;
    graph: MacroGraph;
} | {
    parsable: false;
    reason: string;
    line: number;
};
export interface MacroGraphResponse {
    macroId: string;
    source: string;
    parse: ParseResult;
}
export interface GroupMember {
    macroId: string;
    backend: string;
    running: boolean;
}
/**
 * A group is the only runnable unit: it owns the hotkey, the 실행 방식, and
 * the scripts that start together. There is deliberately no per-macro hotkey
 * beside this one.
 */
export interface MacroGroup {
    id: string;
    name: string;
    keys: string[];
    members: GroupMember[];
    mode: MacroRunMode;
    count: number;
    /** True while any member is still running. */
    active: boolean;
}
export interface GroupPatch {
    name?: string;
    mode?: MacroRunMode;
    count?: number;
}
export interface BatchMemberItem {
    macroId: string;
    backend?: string;
}
export interface AddGroupMembersBatchRequest {
    members: BatchMemberItem[];
}
/** Result of "press the key you want" — `cancelled` when the user hit Escape. */
export interface KeyCaptureResult {
    key: string | null;
    cancelled: boolean;
}
/**
 * One thing the Mock backend recorded, as the Runtime writes it: an operation
 * and its target joined by a colon — `"KeyDown:I"`, `"KeyUp:LEFT"`.
 *
 * It is a string, not an object, because the Mock backend's log is meant to be
 * compared literally in tests (`assert.deepEqual(events, ['KeyDown:I', ...])`),
 * and a structured form would make that read worse rather than better.
 */
export type MockInputEvent = string;
export interface KeyLogEntry {
    /** Milliseconds since the recording started, not a wall clock. */
    atMs: number;
    /** The key's `KeyCode` name, as the Runtime spells it. */
    key: string;
    direction: 'down' | 'up';
}
export interface KeyLogSnapshot {
    recording: boolean;
    entries: KeyLogEntry[];
}
export interface RunModeOption {
    mode: MacroRunMode;
    label: string;
    /** One line explaining the mode — shown only for the selected one. */
    hint: string;
}
/**
 * The four run styles with their Korean labels, shipped with the SDK rather
 * than with any one front end: a CLI printing `--mode` help and a GUI drawing
 * a chooser should not word the same four options differently.
 */
export declare const RUN_MODE_OPTIONS: readonly RunModeOption[];
/** The label for a run mode, or the raw mode if the Runtime ever adds one. */
export declare function runModeLabel(mode: MacroRunMode): string;
/**
 * A global key that belongs to the app rather than to any one macro.
 *
 * Every trigger in MacroSuite is assignable, Emergency Stop included — it was
 * a hard-coded `F12` until it wasn't, and no key on a keyboard is safe to
 * assume is free.
 */
export type SystemHotkeyAction = 'EmergencyStop' | 'OverlayToggle';
export interface SystemHotkey {
    action: SystemHotkeyAction;
    /** The bound key's `KeyCode` name, or null when unbound. */
    key: string | null;
    /** A short name for the action, ready to show. */
    label: string;
    /** One line saying what pressing it does. */
    description: string;
    /**
     * True when the binding cannot be removed, only moved. Emergency Stop is the
     * one: it can point at any key, but it always points at one.
     */
    required: boolean;
}
/** Result of long-polling for a system hotkey press. */
export interface SystemHotkeyEvent {
    action: SystemHotkeyAction | null;
    /** False when the poll timed out with nothing pressed — poll again. */
    pressed: boolean;
}
//# sourceMappingURL=types.d.ts.map