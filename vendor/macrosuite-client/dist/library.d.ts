import { RuntimeTransport } from './http.js';
import type { BackendName, RunMacroResponse } from './types.js';
export type LibraryLanguage = 'typescript' | 'json-dsl';
export type LibraryVisibility = 'private' | 'public';
export interface LibraryAccount {
    configured: boolean;
    accountId: string | null;
    username: string | null;
    expiresAt: string | null;
}
export interface LibrarySummary {
    id: string;
    ownerId: string;
    language: LibraryLanguage;
    name: string;
    visibility: LibraryVisibility;
    revision: string;
    hash: string;
    updatedAt: string;
}
export interface LibraryCompiled {
    content: string;
    hash: string;
    sourceHash: string;
    compiler: string;
}
export interface LibraryDocument extends LibrarySummary {
    content: string;
    compiled?: LibraryCompiled;
    error?: string;
}
export interface LibraryWrite {
    name: string;
    content: string;
    visibility: LibraryVisibility;
    revision?: string;
}
export interface GitHubLoginResult {
    type: 'macrosuite-github-login';
    token: string;
    accountId: string;
    username: string;
    expiresAt: string;
}
export declare class LibraryApi {
    private readonly http;
    constructor(http: RuntimeTransport);
    account(): Promise<LibraryAccount>;
    login(username: string, password: string): Promise<LibraryAccount>;
    logout(): Promise<LibraryAccount>;
    list(language: LibraryLanguage, scope?: 'mine' | 'public'): Promise<LibrarySummary[]>;
    get(language: LibraryLanguage, owner: string, id: string): Promise<LibraryDocument>;
    save(language: LibraryLanguage, id: string, body: LibraryWrite): Promise<LibraryDocument>;
    delete(language: LibraryLanguage, id: string, revision: string): Promise<void>;
    copy(language: LibraryLanguage, owner: string, id: string): Promise<LibraryDocument>;
    run(language: LibraryLanguage, owner: string, id: string, revision: string, backend?: BackendName): Promise<RunMacroResponse>;
    localSource(id: string): Promise<{
        source: string;
        suggestedVisibility: LibraryVisibility;
    }>;
    /**
     * Where to send a GitHub OAuth popup — the local Runtime's own
     * `MACROSUITE_DEPLOY_URL` decides this, not anything the page knows, so it
     * is fetched rather than built client-side. GitHub's OAuth callback has to
     * land on a publicly reachable HTTPS URL (the deployed backend), never on
     * localhost, which is the whole reason this is a redirect through the
     * backend rather than a call the Runtime could just answer directly.
     */
    githubOAuthUrl(): Promise<{
        url: string;
    }>;
    loginWithToken(token: string, accountId: string, username: string, expiresAt: string): Promise<LibraryAccount>;
}
//# sourceMappingURL=library.d.ts.map