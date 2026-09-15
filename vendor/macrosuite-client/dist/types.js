/**
 * The wire contract of the MacroRuntime Local API, as TypeScript types.
 *
 * These mirror the C# DTOs in `runtime/MacroRuntime/Api/` one for one. They
 * live here — not in the web app — because the web app is only one of the
 * front ends: the CLI and any other GUI need the same names for the same
 * things (spec §42).
 */
/**
 * The four run styles with their Korean labels, shipped with the SDK rather
 * than with any one front end: a CLI printing `--mode` help and a GUI drawing
 * a chooser should not word the same four options differently.
 */
export const RUN_MODE_OPTIONS = [
    { mode: 'Toggle', label: '계속 반복', hint: '단축키를 누르면 시작하고, 다시 누르면 멈춥니다.' },
    { mode: 'Once', label: '한 번만', hint: '단축키를 누르면 한 번 실행하고 스스로 끝납니다.' },
    { mode: 'Hold', label: '누르는 동안', hint: '단축키를 누르고 있는 동안만 실행되고, 떼면 멈춥니다.' },
    { mode: 'Count', label: '횟수 반복', hint: '단축키를 누르면 정한 횟수만큼 실행하고 끝납니다.' },
];
/** The label for a run mode, or the raw mode if the Runtime ever adds one. */
export function runModeLabel(mode) {
    return RUN_MODE_OPTIONS.find(o => o.mode === mode)?.label ?? mode;
}
//# sourceMappingURL=types.js.map