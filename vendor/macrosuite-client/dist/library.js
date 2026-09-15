import { RuntimeTransport } from './http.js';
const enc = encodeURIComponent;
export class LibraryApi {
    http;
    constructor(http) {
        this.http = http;
    }
    account() { return this.http.request('GET', '/api/library/account'); }
    login(username, password) { return this.http.request('POST', '/api/library/login', { body: { username, password }, timeoutMs: 35000 }); }
    logout() { return this.http.request('POST', '/api/library/logout', { timeoutMs: 60000 }); }
    list(language, scope = 'mine') { return this.http.request('GET', `/api/library/${language}`, { query: { scope }, timeoutMs: 35000 }); }
    get(language, owner, id) { return this.http.request('GET', `/api/library/${language}/${enc(owner)}/${enc(id)}`, { timeoutMs: 35000 }); }
    save(language, id, body) { return this.http.request('PUT', `/api/library/${language}/${enc(id)}`, { body, timeoutMs: 35000 }); }
    delete(language, id, revision) { return this.http.request('DELETE', `/api/library/${language}/${enc(id)}`, { query: { revision }, timeoutMs: 35000 }); }
    copy(language, owner, id) { return this.http.request('POST', `/api/library/${language}/${enc(owner)}/${enc(id)}/copy`, { timeoutMs: 35000 }); }
    run(language, owner, id, revision, backend = 'mock') { return this.http.request('POST', `/api/library/${language}/${enc(owner)}/${enc(id)}/run`, { body: { revision, backend }, timeoutMs: 60000 }); }
    localSource(id) { return this.http.request('GET', `/api/library/local/${enc(id)}/source`); }
    /**
     * Where to send a GitHub OAuth popup — the local Runtime's own
     * `MACROSUITE_DEPLOY_URL` decides this, not anything the page knows, so it
     * is fetched rather than built client-side. GitHub's OAuth callback has to
     * land on a publicly reachable HTTPS URL (the deployed backend), never on
     * localhost, which is the whole reason this is a redirect through the
     * backend rather than a call the Runtime could just answer directly.
     */
    githubOAuthUrl() { return this.http.request('GET', '/api/library/github-oauth-url'); }
    loginWithToken(token, accountId, username, expiresAt) { return this.http.request('POST', '/api/library/github-login', { body: { token, accountId, username, expiresAt }, timeoutMs: 10000 }); }
}
//# sourceMappingURL=library.js.map