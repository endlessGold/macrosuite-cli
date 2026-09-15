/**
 * `@macrosuite/client` — the client SDK for MacroRuntime's Local API.
 *
 * One contract, several front ends: the CLI, the in-game overlay, and any GUI
 * written later all drive the Runtime through this package rather than through
 * hand-rolled `fetch` calls. Nothing platform- or framework-specific is
 * imported here, so the same build runs in Node, in a browser, and inside
 * WebView2.
 *
 * ```ts
 * import { MacroSuiteClient, watchStatus } from '@macrosuite/client'
 *
 * const client = new MacroSuiteClient()
 * const watch = watchStatus(client, { onStatus: s => render(s.activeMacros) })
 *
 * await client.groups.toggle('my-group')
 * await watch.refreshNow()
 * ```
 */
export { MacroSuiteClient, type MacroSuiteClientOptions } from './client.js';
export { MacrosApi, GroupsApi, RuntimeApi, KeysApi, HotkeysApi, DiagnosticsApi } from './client.js';
export { DEFAULT_RUNTIME_URL, RuntimeTransport, type FetchLike, type TransportOptions } from './http.js';
export { MacroSuiteError, RuntimeHttpError, RuntimeUnreachableError } from './errors.js';
export { watchStatus, waitForRuntime, type ConnectionState, type StatusWatch, type WatchStatusOptions, } from './watch.js';
export * from './types.js';
export * from './library.js';
export * from './json-dsl.js';
//# sourceMappingURL=index.d.ts.map