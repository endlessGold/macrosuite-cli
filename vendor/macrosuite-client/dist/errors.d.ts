/**
 * Every failure this SDK reports is one of these, so a caller can branch on
 * "the Runtime isn't there" vs. "the Runtime said no" without string matching.
 */
export declare class MacroSuiteError extends Error {
    constructor(message: string, options?: {
        cause?: unknown;
    });
}
/**
 * The Runtime could not be reached at all — not running, wrong port, or the
 * request timed out before a response arrived. This is the one a UI should
 * render as "연결 안 됨" rather than as an error toast.
 */
export declare class RuntimeUnreachableError extends MacroSuiteError {
    readonly baseUrl: string;
    constructor(baseUrl: string, cause?: unknown);
}
/**
 * The Runtime answered with a non-2xx status. `detail` carries the Runtime's
 * own message when it sent one — its error bodies are either `{ error }` or
 * an RFC7807 problem document with `detail`.
 */
export declare class RuntimeHttpError extends MacroSuiteError {
    readonly status: number;
    readonly detail: string;
    readonly method: string;
    readonly path: string;
    constructor(args: {
        status: number;
        detail: string;
        method: string;
        path: string;
    });
    /** The macro/group/endpoint named in the request does not exist. */
    get isNotFound(): boolean;
    /** The script exists but does not compile — `detail` is the compiler's message. */
    get isCompileError(): boolean;
}
//# sourceMappingURL=errors.d.ts.map