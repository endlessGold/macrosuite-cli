import { RuntimeTransport, type TransportOptions } from './http.js';
import { LibraryApi } from './library.js';
import type { BackendName, GroupPatch, KeyCaptureResult, KeyLogSnapshot, MacroGraph, MacroGraphResponse, MacroGroup, MacroSummary, MockInputEvent, RunMacroResponse, RemoteJsonMacroSummary, RuntimeStatus, SystemHotkey, SystemHotkeyAction, SystemHotkeyEvent, ToggleAction } from './types.js';
import type { JsonMacroDocument } from './json-dsl.js';
export interface MacroSuiteClientOptions extends TransportOptions {
}
interface Call {
    signal?: AbortSignal;
}
/**
 * Everything a front end can ask of MacroRuntime, in one object.
 *
 * The SDK exists so the Runtime has exactly one client contract: the CLI, the
 * overlay, and anything anyone writes later all drive the same calls, and an
 * endpoint that changes shape breaks in one file instead of in every UI. No
 * front-end framework is imported here on purpose — this runs unchanged in
 * Node, in a browser, and inside WebView2.
 *
 * ```ts
 * const client = new MacroSuiteClient()
 * const groups = await client.groups.list()
 * await client.groups.toggle(groups[0].id)
 * ```
 */
export declare class MacroSuiteClient {
    private readonly http;
    readonly macros: MacrosApi;
    readonly library: LibraryApi;
    readonly groups: GroupsApi;
    readonly runtime: RuntimeApi;
    readonly keys: KeysApi;
    readonly hotkeys: HotkeysApi;
    readonly diagnostics: DiagnosticsApi;
    constructor(options?: MacroSuiteClientOptions);
    /** The Runtime address this client talks to, for logs and error messages. */
    get baseUrl(): string;
    /** What is running right now, plus the Runtime's version and uptime. */
    status(call?: Call): Promise<RuntimeStatus>;
    /**
     * True when the Runtime answers at all. Never throws — a front end deciding
     * whether to show "연결 안 됨" wants a boolean, not a try/catch.
     */
    ping(call?: Call): Promise<boolean>;
}
/** Scripts: the library, authoring, and running one on its own. */
export declare class MacrosApi {
    private readonly http;
    constructor(http: RuntimeTransport);
    list(call?: Call): Promise<MacroSummary[]>;
    /** Creates an empty macro. The id is derived from `name` by the Runtime. */
    create(name: string, description?: string, call?: Call): Promise<MacroSummary>;
    /** Removes the macro's files, after stopping it and taking it out of every group. */
    delete(macroId: string, call?: Call): Promise<void>;
    /**
     * Runs one script once, for trying it out. Deliberately not a toggle — a
     * group is the thing that gets turned on and off.
     */
    run(macroId: string, backend?: BackendName, call?: Call): Promise<RunMacroResponse>;
    runJson(document: JsonMacroDocument, call?: Call): Promise<RunMacroResponse>;
    /** Fetches a JSON DSL document from the configured GitHub/Vercel store and
     * executes the validated document locally. The server never executes input. */
    runRemoteJson(macroId: string, backend?: BackendName, call?: Call): Promise<RunMacroResponse>;
    listRemoteJson(call?: Call): Promise<RemoteJsonMacroSummary[]>;
    saveRemoteJson(macroId: string, name: string, json: string, call?: Call): Promise<void>;
    stop(macroId: string, call?: Call): Promise<void>;
    toggle(macroId: string, backend?: BackendName, call?: Call): Promise<ToggleAction>;
    /** The script's text, plus the node graph it parses into (or why it doesn't). */
    graph(macroId: string, call?: Call): Promise<MacroGraphResponse>;
    /** Writes the graph back as TypeScript, and returns the source it generated. */
    saveGraph(macroId: string, graph: MacroGraph, call?: Call): Promise<{
        macroId: string;
        source: string;
    }>;
    /** Replaces the script's text directly — the .ts file stays the source of truth. */
    saveSource(macroId: string, source: string, call?: Call): Promise<void>;
}
/** Groups: the runnable unit — one hotkey, one 실행 방식, several scripts. */
export declare class GroupsApi {
    private readonly http;
    constructor(http: RuntimeTransport);
    list(call?: Call): Promise<MacroGroup[]>;
    /** The Runtime has no single-group GET; this reads the list and picks one. */
    find(groupId: string, call?: Call): Promise<MacroGroup | undefined>;
    create(name?: string, call?: Call): Promise<MacroGroup>;
    /** Only the fields present in `patch` change. */
    update(groupId: string, patch: GroupPatch, call?: Call): Promise<MacroGroup>;
    delete(groupId: string, call?: Call): Promise<void>;
    /** Adds a script, or — when it is already a member — re-points it at another backend. */
    addMember(groupId: string, macroId: string, backend?: BackendName, call?: Call): Promise<MacroGroup>;
    /** Adds multiple scripts atomically. All macroIds must exist or nothing changes. */
    addMembersBatch(groupId: string, members: {
        macroId: string;
        backend?: string;
    }[], call?: Call): Promise<MacroGroup>;
    removeMember(groupId: string, macroId: string, call?: Call): Promise<void>;
    /** `key` is a `KeyCode` name as the Runtime spells it — "F10", "NUMPAD1". */
    addKey(groupId: string, key: string, call?: Call): Promise<MacroGroup>;
    removeKey(groupId: string, key: string, call?: Call): Promise<void>;
    /** Exactly what pressing the group's hotkey does — every script in it at once. */
    toggle(groupId: string, call?: Call): Promise<ToggleAction>;
    /**
     * Switches every script in every group to one backend.
     *
     * The Runtime stores the backend per group member, but "does this send real
     * keystrokes into my game" is one question about the whole app — so it is
     * asked once and applied everywhere, here, rather than in each front end.
     */
    setBackendEverywhere(backend: BackendName, call?: Call): Promise<void>;
}
/** The Runtime as a whole — the things Emergency Stop is made of. */
export declare class RuntimeApi {
    private readonly http;
    constructor(http: RuntimeTransport);
    /** Stops every running macro. Returns how many were stopped. */
    stopAll(call?: Call): Promise<number>;
    /** Releases every key and button the Runtime is holding down. */
    releaseAll(call?: Call): Promise<void>;
    /**
     * Emergency Stop — the same thing F12 does: stop everything, then let go of
     * everything. Both halves matter; stopping a macro mid-`hold` without the
     * release leaves a key down in the game.
     */
    emergencyStop(call?: Call): Promise<number>;
}
/** Reading a keypress without needing keyboard focus. */
export declare class KeysApi {
    private readonly http;
    constructor(http: RuntimeTransport);
    /**
     * "Press the key you want" — resolves with the next key the global hook
     * sees, even while a game has focus, and swallows it so assigning a key
     * does not also fire it in the game. Escape resolves as `cancelled`.
     *
     * This call is meant to hang while the user decides, so it raises the
     * client's per-request timeout to cover the capture window.
     */
    capture(timeoutSeconds?: number, call?: Call): Promise<KeyCaptureResult>;
}
/**
 * The app's own trigger keys — Emergency Stop and the overlay toggle.
 *
 * Separate from a group's hotkeys because these belong to the app rather than
 * to a macro, but they share one global hook and one namespace: assigning a key
 * here that a group already uses is refused, and so is the other way round.
 */
export declare class HotkeysApi {
    private readonly http;
    constructor(http: RuntimeTransport);
    list(call?: Call): Promise<SystemHotkey[]>;
    /**
     * Points an action at a key. The change is on disk before this resolves.
     *
     * Throws `RuntimeHttpError` (400) when the key is unknown or already taken —
     * `detail` says which macro or action has it.
     */
    set(action: SystemHotkeyAction, key: string, call?: Call): Promise<SystemHotkey>;
    /**
     * Unbinds an action. Refused (400) for Emergency Stop — it can be moved to
     * any key, but it always has one: it is what releases a key a macro is
     * holding down, and it has to work when the UI does not.
     */
    clear(action: SystemHotkeyAction, call?: Call): Promise<SystemHotkey>;
    /**
     * Long-polls until the user presses a system hotkey a UI has to react to,
     * or until the poll times out (`pressed: false` — just call it again).
     *
     * This exists because an overlay that refuses activation never receives key
     * events of its own; the Runtime's global hook is the only thing that sees
     * the press. Emergency Stop is deliberately not reported: the Runtime acts on
     * it whether or not anything is listening.
     */
    nextEvent(timeoutSeconds?: number, call?: Call): Promise<SystemHotkeyEvent>;
}
/** Answering "did the key this macro sent actually reach the input stream". */
export declare class DiagnosticsApi {
    private readonly http;
    constructor(http: RuntimeTransport);
    /** What the Mock backend recorded — real coverage without real hardware. */
    mockEvents(call?: Call): Promise<MockInputEvent[]>;
    /**
     * Starts recording what the low-level hook sees. That hook sees every
     * keystroke on the machine, so it is off unless started and expires on its
     * own after `seconds` (the Runtime clamps it to 1–120).
     */
    startKeyLog(seconds?: number, call?: Call): Promise<void>;
    stopKeyLog(call?: Call): Promise<void>;
    keyLog(call?: Call): Promise<KeyLogSnapshot>;
}
export {};
//# sourceMappingURL=client.d.ts.map