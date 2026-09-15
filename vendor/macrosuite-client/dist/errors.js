/**
 * Every failure this SDK reports is one of these, so a caller can branch on
 * "the Runtime isn't there" vs. "the Runtime said no" without string matching.
 */
export class MacroSuiteError extends Error {
    constructor(message, options) {
        super(message);
        this.name = 'MacroSuiteError';
        if (options?.cause !== undefined)
            this.cause = options.cause;
    }
}
/**
 * The Runtime could not be reached at all — not running, wrong port, or the
 * request timed out before a response arrived. This is the one a UI should
 * render as "연결 안 됨" rather than as an error toast.
 */
export class RuntimeUnreachableError extends MacroSuiteError {
    baseUrl;
    constructor(baseUrl, cause) {
        super(`MacroRuntime에 연결할 수 없습니다 (${baseUrl})`, { cause });
        this.name = 'RuntimeUnreachableError';
        this.baseUrl = baseUrl;
    }
}
/**
 * The Runtime answered with a non-2xx status. `detail` carries the Runtime's
 * own message when it sent one — its error bodies are either `{ error }` or
 * an RFC7807 problem document with `detail`.
 */
export class RuntimeHttpError extends MacroSuiteError {
    status;
    detail;
    method;
    path;
    constructor(args) {
        super(`Runtime 오류 (HTTP ${args.status}) ${args.method} ${args.path}` +
            (args.detail ? `: ${args.detail}` : ''));
        this.name = 'RuntimeHttpError';
        this.status = args.status;
        this.detail = args.detail;
        this.method = args.method;
        this.path = args.path;
    }
    /** The macro/group/endpoint named in the request does not exist. */
    get isNotFound() {
        return this.status === 404;
    }
    /** The script exists but does not compile — `detail` is the compiler's message. */
    get isCompileError() {
        return this.status === 422;
    }
}
//# sourceMappingURL=errors.js.map