/** The address the Runtime binds to. Loopback only — never a remote host. */
export declare const DEFAULT_RUNTIME_URL = "http://127.0.0.1:17821";
/**
 * The fetch this SDK uses. Injectable so the SDK stays portable: Node 18+,
 * a browser, WebView2 and a test harness all supply their own without the
 * SDK importing anything platform-specific.
 */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
export interface TransportOptions {
    /** Defaults to {@link DEFAULT_RUNTIME_URL}. A trailing slash is fine. */
    baseUrl?: string;
    /** Defaults to the ambient `fetch`. */
    fetch?: FetchLike;
    /** Per-request timeout in milliseconds. Defaults to 5000; 0 disables it. */
    timeoutMs?: number;
    /** Extra headers sent with every request (a future session token goes here). */
    headers?: Record<string, string>;
}
/**
 * The one place an HTTP call to the Runtime is made. Everything above it —
 * the typed client, the CLI, any GUI — goes through here, so connection
 * failures, error bodies and empty 202/204 responses are handled once.
 */
export declare class RuntimeTransport {
    readonly baseUrl: string;
    private readonly doFetch;
    private readonly timeoutMs;
    private readonly headers;
    constructor(options?: TransportOptions);
    request<T>(method: string, path: string, options?: {
        body?: unknown;
        signal?: AbortSignal;
        query?: Record<string, unknown>;
        /** Overrides the client-wide timeout for one call — key capture waits on a human. */
        timeoutMs?: number;
    }): Promise<T>;
}
//# sourceMappingURL=http.d.ts.map