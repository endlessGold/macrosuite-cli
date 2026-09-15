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
export function watchStatus(client, options = {}) {
    const intervalMs = options.intervalMs ?? 1000;
    const failuresBeforeDisconnected = options.failuresBeforeDisconnected ?? 5;
    let current;
    let connection = 'connecting';
    let stopped = false;
    let inFlight = false;
    let consecutiveFailures = 0;
    let everConnected = false;
    let timer;
    const abort = new AbortController();
    const setConnection = (next) => {
        if (connection === next)
            return;
        connection = next;
        options.onConnectionChange?.(next);
    };
    const poll = async () => {
        // One poll at a time. A Runtime that has stalled must not accumulate a
        // queue of requests that all land at once when it recovers.
        if (stopped || inFlight)
            return;
        inFlight = true;
        try {
            const status = await client.status({ signal: abort.signal });
            if (stopped)
                return;
            current = status;
            consecutiveFailures = 0;
            everConnected = true;
            setConnection('connected');
            options.onStatus?.(status);
        }
        catch (error) {
            if (stopped)
                return;
            consecutiveFailures += 1;
            // Before the first success, a failure means "not up yet" for a while —
            // the Runtime may still be starting. After one, it means "gone".
            if (everConnected || consecutiveFailures >= failuresBeforeDisconnected) {
                setConnection('disconnected');
            }
            options.onError?.(error);
        }
        finally {
            inFlight = false;
        }
    };
    const loop = async () => {
        await poll();
        if (!stopped)
            timer = setTimeout(loop, intervalMs);
    };
    void loop();
    return {
        get current() {
            return current;
        },
        get connection() {
            return connection;
        },
        async refreshNow() {
            await poll();
        },
        stop() {
            if (stopped)
                return;
            stopped = true;
            if (timer !== undefined)
                clearTimeout(timer);
            abort.abort();
        },
    };
}
/**
 * Waits until the Runtime answers, or gives up. Returns whether it came up.
 *
 * A CLI command and a launcher both need this: the Runtime is usually being
 * started in the same breath as the first request, and the first few hundred
 * milliseconds are expected to fail.
 */
export async function waitForRuntime(client, options = {}) {
    const deadline = Date.now() + (options.timeoutMs ?? 10_000);
    const pollIntervalMs = options.pollIntervalMs ?? 250;
    for (;;) {
        if (await client.ping())
            return true;
        if (Date.now() >= deadline)
            return false;
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }
}
//# sourceMappingURL=watch.js.map