import type { MacroSuiteClient } from './client.js';
import type { RuntimeStatus } from './types.js';
/**
 * Whether the Runtime is answering. Kept separate from the status itself
 * because "we have no status yet" and "we had one and lost it" look the same
 * in the data but not to a user.
 */
export type ConnectionState = 'connecting' | 'connected' | 'disconnected';
export interface WatchStatusOptions {
    /** How often to poll, in milliseconds. Defaults to 1000. */
    intervalMs?: number;
    onStatus?: (status: RuntimeStatus) => void;
    onConnectionChange?: (state: ConnectionState) => void;
    /** Called for every failed poll. Omit it and failures are silent (the connection state already says so). */
    onError?: (error: unknown) => void;
    /**
     * How many polls may fail before the state becomes `disconnected` rather
     * than staying `connecting`. Defaults to 5.
     *
     * This is what keeps a launcher from opening onto "cannot reach the
     * Runtime". A packaged Runtime is a self-extracting single file and takes
     * seconds to bind its port, and the app that just started it has no business
     * calling that a failure — it has not finished starting. Once a connection
     * has succeeded, a later failure is a disconnect immediately: by then the
     * Runtime demonstrably was there and now is not.
     */
    failuresBeforeDisconnected?: number;
}
export interface StatusWatch {
    /** The last status received, or undefined before the first successful poll. */
    readonly current: RuntimeStatus | undefined;
    readonly connection: ConnectionState;
    /** Polls immediately instead of waiting out the interval — call after acting. */
    refreshNow(): Promise<void>;
    stop(): void;
}
/**
 * Polls `GET /api/status` on an interval and reports changes.
 *
 * The Runtime has no push channel yet (spec's WebSocket is unbuilt), so every
 * front end would otherwise write this same loop — including the parts that
 * are easy to get wrong: not letting polls pile up when one is slow, treating
 * a cancelled poll as a disconnect, and re-polling right after an action
 * instead of showing a stale state for up to a second.
 *
 * When the Runtime does grow a push channel, this function's shape is what
 * changes underneath; callers keep the same three callbacks.
 */
export declare function watchStatus(client: MacroSuiteClient, options?: WatchStatusOptions): StatusWatch;
/**
 * Waits until the Runtime answers, or gives up. Returns whether it came up.
 *
 * A CLI command and a launcher both need this: the Runtime is usually being
 * started in the same breath as the first request, and the first few hundred
 * milliseconds are expected to fail.
 */
export declare function waitForRuntime(client: MacroSuiteClient, options?: {
    timeoutMs?: number;
    pollIntervalMs?: number;
}): Promise<boolean>;
//# sourceMappingURL=watch.d.ts.map