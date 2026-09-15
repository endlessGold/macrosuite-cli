import { RuntimeHttpError, RuntimeUnreachableError } from './errors.js';
/** The address the Runtime binds to. Loopback only — never a remote host. */
export const DEFAULT_RUNTIME_URL = 'http://127.0.0.1:17821';
/**
 * Combines the caller's AbortSignal with this SDK's own timeout without
 * depending on `AbortSignal.any`, which is newer than the Node versions this
 * has to run on.
 */
function withTimeout(timeoutMs, signal) {
    if (timeoutMs <= 0)
        return { signal, done: () => { } };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error(`timed out after ${timeoutMs}ms`)), timeoutMs);
    const forward = () => controller.abort(signal?.reason);
    if (signal) {
        if (signal.aborted)
            forward();
        else
            signal.addEventListener('abort', forward, { once: true });
    }
    return {
        signal: controller.signal,
        done: () => {
            clearTimeout(timer);
            signal?.removeEventListener('abort', forward);
        },
    };
}
/**
 * The one place an HTTP call to the Runtime is made. Everything above it —
 * the typed client, the CLI, any GUI — goes through here, so connection
 * failures, error bodies and empty 202/204 responses are handled once.
 */
export class RuntimeTransport {
    baseUrl;
    doFetch;
    timeoutMs;
    headers;
    constructor(options = {}) {
        this.baseUrl = (options.baseUrl ?? DEFAULT_RUNTIME_URL).replace(/\/+$/, '');
        this.timeoutMs = options.timeoutMs ?? 5000;
        this.headers = options.headers ?? {};
        if (options.fetch) {
            this.doFetch = options.fetch;
        }
        else {
            const ambient = globalThis.fetch;
            if (!ambient) {
                throw new Error('No fetch available. Pass one as `fetch` — Node 18+ and every browser have a global one.');
            }
            // Bound to globalThis, and this is not a style choice. A browser's fetch
            // is a method of the window and refuses to run with any other receiver:
            // storing it on an object and calling it as `this.doFetch(...)` throws
            // "Illegal invocation" and every request from a page fails. Node's fetch
            // does not check its receiver, so the SDK's own tests and the CLI ran
            // fine on the broken version — the UI was the only thing that could see
            // it, and what it saw was "cannot reach the Runtime".
            this.doFetch = ambient.bind(globalThis);
        }
    }
    async request(method, path, options = {}) {
        const url = this.baseUrl + path + queryString(options.query);
        const timeout = withTimeout(options.timeoutMs ?? this.timeoutMs, options.signal);
        const init = {
            method,
            signal: timeout.signal,
            headers: options.body === undefined
                ? this.headers
                : { ...this.headers, 'Content-Type': 'application/json' },
        };
        if (options.body !== undefined)
            init.body = JSON.stringify(options.body);
        let response;
        try {
            response = await this.doFetch(url, init);
        }
        catch (cause) {
            // A caller-initiated abort is not "the Runtime is down" — let it through
            // as-is so cancelling a poll doesn't render as a connection failure.
            if (options.signal?.aborted)
                throw cause;
            throw new RuntimeUnreachableError(this.baseUrl, cause);
        }
        finally {
            timeout.done();
        }
        if (!response.ok) {
            throw new RuntimeHttpError({
                status: response.status,
                detail: await readErrorDetail(response),
                method,
                path,
            });
        }
        // 202/204 (run, stop, delete) can carry an empty body, and `.json()`
        // throws on empty input — read text first.
        const text = await response.text();
        if (text.length === 0)
            return undefined;
        return JSON.parse(text);
    }
}
function queryString(query) {
    if (!query)
        return '';
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null)
            params.set(key, String(value));
    }
    const encoded = params.toString();
    return encoded ? `?${encoded}` : '';
}
/**
 * The Runtime reports failures two ways — `{ "error": "..." }` from its own
 * handlers, and an RFC7807 problem document (`detail`) from `Results.Problem`.
 * Both end up as one string a UI can show.
 */
async function readErrorDetail(response) {
    let text;
    try {
        text = await response.text();
    }
    catch {
        return '';
    }
    if (!text)
        return '';
    try {
        const parsed = JSON.parse(text);
        return parsed.error ?? parsed.detail ?? parsed.title ?? text;
    }
    catch {
        return text;
    }
}
//# sourceMappingURL=http.js.map