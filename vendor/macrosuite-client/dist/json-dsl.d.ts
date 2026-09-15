export type JsonKey = string;
export type JsonMouseButton = 'Left' | 'Right' | 'Middle' | 'X1' | 'X2';
export type JsonExpression = string | number | boolean | JsonReference | JsonOperation;
export interface JsonReference {
    var: string;
}
export interface JsonOperation {
    operator: string;
    args: JsonExpression[];
}
export type JsonMacroCondition = {
    type: 'always' | 'never';
} | {
    type: 'processRunning' | 'processNotRunning';
    process: string;
};
export type JsonMacroStep = {
    op: 'press';
    key: JsonKey;
    ms?: number | JsonExpression;
} | {
    op: 'keyDown' | 'keyUp' | 'release';
    key: JsonKey | JsonExpression;
} | {
    op: 'wait';
    ms: number | JsonExpression;
} | {
    op: 'click' | 'mouseDown' | 'mouseUp';
    button: JsonMouseButton | JsonExpression;
} | {
    op: 'moveMouse';
    x: number | JsonExpression;
    y: number | JsonExpression;
} | {
    op: 'declare';
    name: string;
    value: JsonExpression;
} | {
    op: 'assign';
    name: string;
    value: JsonExpression;
} | {
    op: 'if';
    condition: JsonMacroCondition | JsonExpression;
    then: JsonMacroStep[];
    else?: JsonMacroStep[];
} | {
    op: 'while';
    condition: JsonExpression;
    steps: JsonMacroStep[];
} | {
    op: 'repeat';
    count: number | JsonExpression;
    steps: JsonMacroStep[];
} | {
    op: 'switch';
    target: 'process';
    value: string;
    cases: Record<string, JsonMacroStep[]>;
    default?: JsonMacroStep[];
} | {
    op: 'switch';
    target: 'value';
    value: JsonExpression;
    cases: Record<string, JsonMacroStep[]>;
    default?: JsonMacroStep[];
};
export interface JsonMacroDocument {
    version: 1;
    id: string;
    name: string;
    description: string;
    coroutine?: 'sync' | 'async';
    steps: JsonMacroStep[];
}
export declare function jsonMacro(id: string, name: string, steps: JsonMacroStep[], description?: string, coroutine?: 'sync' | 'async'): JsonMacroDocument;
export declare function serializeJsonMacro(document: JsonMacroDocument): string;
//# sourceMappingURL=json-dsl.d.ts.map