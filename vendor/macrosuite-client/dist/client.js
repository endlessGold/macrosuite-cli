import { RuntimeTransport } from './http.js';
import { LibraryApi } from './library.js';
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
export class MacroSuiteClient {
    http;
    macros;
    library;
    groups;
    runtime;
    keys;
    hotkeys;
    diagnostics;
    constructor(options = {}) {
        this.http = new RuntimeTransport(options);
        this.macros = new MacrosApi(this.http);
        this.library = new LibraryApi(this.http);
        this.groups = new GroupsApi(this.http);
        this.runtime = new RuntimeApi(this.http);
        this.keys = new KeysApi(this.http);
        this.hotkeys = new HotkeysApi(this.http);
        this.diagnostics = new DiagnosticsApi(this.http);
    }
    /** The Runtime address this client talks to, for logs and error messages. */
    get baseUrl() {
        return this.http.baseUrl;
    }
    /** What is running right now, plus the Runtime's version and uptime. */
    status(call = {}) {
        return this.http.request('GET', '/api/status', { signal: call.signal });
    }
    /**
     * True when the Runtime answers at all. Never throws — a front end deciding
     * whether to show "연결 안 됨" wants a boolean, not a try/catch.
     */
    async ping(call = {}) {
        try {
            await this.status(call);
            return true;
        }
        catch {
            return false;
        }
    }
}
/** Scripts: the library, authoring, and running one on its own. */
export class MacrosApi {
    http;
    constructor(http) {
        this.http = http;
    }
    list(call = {}) {
        return this.http.request('GET', '/api/macros', { signal: call.signal });
    }
    /** Creates an empty macro. The id is derived from `name` by the Runtime. */
    create(name, description = '', call = {}) {
        return this.http.request('POST', '/api/macros', {
            body: { name, description },
            signal: call.signal,
        });
    }
    /** Removes the macro's files, after stopping it and taking it out of every group. */
    async delete(macroId, call = {}) {
        await this.http.request('DELETE', `/api/macros/${enc(macroId)}`, { signal: call.signal });
    }
    /**
     * Runs one script once, for trying it out. Deliberately not a toggle — a
     * group is the thing that gets turned on and off.
     */
    run(macroId, backend = 'mock', call = {}) {
        return this.http.request('POST', `/api/macros/${enc(macroId)}/run`, {
            body: { backend },
            signal: call.signal,
        });
    }
    runJson(document, call = {}) {
        return this.http.request('POST', `/api/json-macros/${enc(document.id)}/run`, {
            body: document,
            signal: call.signal,
        });
    }
    /** Fetches a JSON DSL document from the configured GitHub/Vercel store and
     * executes the validated document locally. The server never executes input. */
    runRemoteJson(macroId, backend = 'mock', call = {}) {
        return this.http.request('POST', `/api/remote/json-macros/${enc(macroId)}/run`, {
            body: { backend },
            signal: call.signal,
        });
    }
    listRemoteJson(call = {}) {
        return this.http.request('GET', '/api/remote/json-macros', { signal: call.signal });
    }
    saveRemoteJson(macroId, name, json, call = {}) {
        return this.http.request('PUT', `/api/remote/json-macros/${enc(macroId)}`, {
            body: { name, json },
            signal: call.signal,
        });
    }
    async stop(macroId, call = {}) {
        await this.http.request('POST', `/api/macros/${enc(macroId)}/stop`, { signal: call.signal });
    }
    async toggle(macroId, backend = 'mock', call = {}) {
        const result = await this.http.request('POST', `/api/macros/${enc(macroId)}/toggle`, { body: { backend }, signal: call.signal });
        return result.action;
    }
    /** The script's text, plus the node graph it parses into (or why it doesn't). */
    graph(macroId, call = {}) {
        return this.http.request('GET', `/api/macros/${enc(macroId)}/graph`, {
            signal: call.signal,
        });
    }
    /** Writes the graph back as TypeScript, and returns the source it generated. */
    saveGraph(macroId, graph, call = {}) {
        return this.http.request('PUT', `/api/macros/${enc(macroId)}/graph`, {
            body: { graph },
            signal: call.signal,
        });
    }
    /** Replaces the script's text directly — the .ts file stays the source of truth. */
    async saveSource(macroId, source, call = {}) {
        await this.http.request('PUT', `/api/macros/${enc(macroId)}/source`, {
            body: { source },
            signal: call.signal,
        });
    }
}
/** Groups: the runnable unit — one hotkey, one 실행 방식, several scripts. */
export class GroupsApi {
    http;
    constructor(http) {
        this.http = http;
    }
    list(call = {}) {
        return this.http.request('GET', '/api/groups', { signal: call.signal });
    }
    /** The Runtime has no single-group GET; this reads the list and picks one. */
    async find(groupId, call = {}) {
        const all = await this.list(call);
        return all.find(g => g.id === groupId);
    }
    create(name, call = {}) {
        return this.http.request('POST', '/api/groups', {
            body: { name },
            signal: call.signal,
        });
    }
    /** Only the fields present in `patch` change. */
    update(groupId, patch, call = {}) {
        return this.http.request('PATCH', `/api/groups/${enc(groupId)}`, {
            body: patch,
            signal: call.signal,
        });
    }
    async delete(groupId, call = {}) {
        await this.http.request('DELETE', `/api/groups/${enc(groupId)}`, { signal: call.signal });
    }
    /** Adds a script, or — when it is already a member — re-points it at another backend. */
    addMember(groupId, macroId, backend = 'mock', call = {}) {
        return this.http.request('POST', `/api/groups/${enc(groupId)}/members`, {
            body: { macroId, backend },
            signal: call.signal,
        });
    }
    /** Adds multiple scripts atomically. All macroIds must exist or nothing changes. */
    addMembersBatch(groupId, members, call = {}) {
        return this.http.request('POST', `/api/groups/${enc(groupId)}/members/batch`, {
            body: { members },
            signal: call.signal,
        });
    }
    async removeMember(groupId, macroId, call = {}) {
        await this.http.request('DELETE', `/api/groups/${enc(groupId)}/members/${enc(macroId)}`, {
            signal: call.signal,
        });
    }
    /** `key` is a `KeyCode` name as the Runtime spells it — "F10", "NUMPAD1". */
    addKey(groupId, key, call = {}) {
        return this.http.request('POST', `/api/groups/${enc(groupId)}/keys`, {
            body: { key },
            signal: call.signal,
        });
    }
    async removeKey(groupId, key, call = {}) {
        await this.http.request('DELETE', `/api/groups/${enc(groupId)}/keys/${enc(key)}`, {
            signal: call.signal,
        });
    }
    /** Exactly what pressing the group's hotkey does — every script in it at once. */
    async toggle(groupId, call = {}) {
        const result = await this.http.request('POST', `/api/groups/${enc(groupId)}/toggle`, { signal: call.signal });
        return result.action;
    }
    /**
     * Switches every script in every group to one backend.
     *
     * The Runtime stores the backend per group member, but "does this send real
     * keystrokes into my game" is one question about the whole app — so it is
     * asked once and applied everywhere, here, rather than in each front end.
     */
    async setBackendEverywhere(backend, call = {}) {
        for (const group of await this.list(call)) {
            for (const member of group.members) {
                if (member.backend !== backend) {
                    await this.addMember(group.id, member.macroId, backend, call);
                }
            }
        }
    }
}
/** The Runtime as a whole — the things Emergency Stop is made of. */
export class RuntimeApi {
    http;
    constructor(http) {
        this.http = http;
    }
    /** Stops every running macro. Returns how many were stopped. */
    async stopAll(call = {}) {
        const result = await this.http.request('POST', '/api/runtime/stop', {
            signal: call.signal,
        });
        return result?.stoppedCount ?? 0;
    }
    /** Releases every key and button the Runtime is holding down. */
    async releaseAll(call = {}) {
        await this.http.request('POST', '/api/runtime/release-all', { signal: call.signal });
    }
    /**
     * Emergency Stop — the same thing F12 does: stop everything, then let go of
     * everything. Both halves matter; stopping a macro mid-`hold` without the
     * release leaves a key down in the game.
     */
    async emergencyStop(call = {}) {
        const stopped = await this.stopAll(call);
        await this.releaseAll(call);
        return stopped;
    }
}
/** Reading a keypress without needing keyboard focus. */
export class KeysApi {
    http;
    constructor(http) {
        this.http = http;
    }
    /**
     * "Press the key you want" — resolves with the next key the global hook
     * sees, even while a game has focus, and swallows it so assigning a key
     * does not also fire it in the game. Escape resolves as `cancelled`.
     *
     * This call is meant to hang while the user decides, so it raises the
     * client's per-request timeout to cover the capture window.
     */
    capture(timeoutSeconds = 10, call = {}) {
        return this.http.request('POST', '/api/keys/capture', {
            query: { timeoutSeconds },
            signal: call.signal,
            timeoutMs: (timeoutSeconds + 5) * 1000,
        });
    }
}
/**
 * The app's own trigger keys — Emergency Stop and the overlay toggle.
 *
 * Separate from a group's hotkeys because these belong to the app rather than
 * to a macro, but they share one global hook and one namespace: assigning a key
 * here that a group already uses is refused, and so is the other way round.
 */
export class HotkeysApi {
    http;
    constructor(http) {
        this.http = http;
    }
    list(call = {}) {
        return this.http.request('GET', '/api/hotkeys', { signal: call.signal });
    }
    /**
     * Points an action at a key. The change is on disk before this resolves.
     *
     * Throws `RuntimeHttpError` (400) when the key is unknown or already taken —
     * `detail` says which macro or action has it.
     */
    set(action, key, call = {}) {
        return this.http.request('PUT', `/api/hotkeys/${enc(action)}`, {
            body: { key },
            signal: call.signal,
        });
    }
    /**
     * Unbinds an action. Refused (400) for Emergency Stop — it can be moved to
     * any key, but it always has one: it is what releases a key a macro is
     * holding down, and it has to work when the UI does not.
     */
    clear(action, call = {}) {
        return this.http.request('DELETE', `/api/hotkeys/${enc(action)}`, {
            signal: call.signal,
        });
    }
    /**
     * Long-polls until the user presses a system hotkey a UI has to react to,
     * or until the poll times out (`pressed: false` — just call it again).
     *
     * This exists because an overlay that refuses activation never receives key
     * events of its own; the Runtime's global hook is the only thing that sees
     * the press. Emergency Stop is deliberately not reported: the Runtime acts on
     * it whether or not anything is listening.
     */
    nextEvent(timeoutSeconds = 30, call = {}) {
        return this.http.request('GET', '/api/hotkeys/events', {
            query: { timeoutSeconds },
            signal: call.signal,
            timeoutMs: (timeoutSeconds + 5) * 1000,
        });
    }
}
/** Answering "did the key this macro sent actually reach the input stream". */
export class DiagnosticsApi {
    http;
    constructor(http) {
        this.http = http;
    }
    /** What the Mock backend recorded — real coverage without real hardware. */
    mockEvents(call = {}) {
        return this.http.request('GET', '/api/diagnostics/mock-events', {
            signal: call.signal,
        });
    }
    /**
     * Starts recording what the low-level hook sees. That hook sees every
     * keystroke on the machine, so it is off unless started and expires on its
     * own after `seconds` (the Runtime clamps it to 1–120).
     */
    async startKeyLog(seconds = 15, call = {}) {
        await this.http.request('POST', '/api/diagnostics/key-log/start', {
            query: { seconds },
            signal: call.signal,
        });
    }
    async stopKeyLog(call = {}) {
        await this.http.request('POST', '/api/diagnostics/key-log/stop', { signal: call.signal });
    }
    keyLog(call = {}) {
        return this.http.request('GET', '/api/diagnostics/key-log', {
            signal: call.signal,
        });
    }
}
const enc = encodeURIComponent;
//# sourceMappingURL=client.js.map