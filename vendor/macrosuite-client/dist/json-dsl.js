export function jsonMacro(id, name, steps, description = '', coroutine = 'sync') {
    return { version: 1, id, name, description, coroutine, steps };
}
export function serializeJsonMacro(document) {
    return JSON.stringify(document, null, 2);
}
//# sourceMappingURL=json-dsl.js.map