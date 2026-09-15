// Printing. Every command supports `--json`, so anything that formats for a
// human here has to have a machine-readable twin — a CLI whose output can only
// be read by eye is not scriptable, and scripting is half the reason it exists.

let jsonMode = false

export function setJsonMode(on) {
  jsonMode = on
}

export function isJsonMode() {
  return jsonMode
}

/**
 * The one exit point for a successful command: `data` when `--json`, whatever
 * `render` prints otherwise.
 */
export function emit(data, render) {
  if (jsonMode) {
    console.log(JSON.stringify(data, null, 2))
    return
  }
  render(data)
}

export function fail(message, { code = 1, detail } = {}) {
  if (jsonMode) {
    console.error(JSON.stringify({ error: message, detail: detail ?? null }, null, 2))
  } else {
    console.error(`오류: ${message}`)
    if (detail) console.error(`  ${detail}`)
  }
  process.exitCode = code
}

/** Plain fixed-width columns — no dependency, and it survives a pipe. */
export function table(rows, columns) {
  if (rows.length === 0) {
    console.log('(없음)')
    return
  }

  const widths = columns.map(col =>
    Math.max(displayWidth(col.header), ...rows.map(row => displayWidth(String(col.value(row) ?? '')))),
  )

  const line = cells => cells.map((cell, i) => pad(cell, widths[i])).join('  ').trimEnd()

  console.log(line(columns.map(c => c.header)))
  console.log(line(widths.map(w => '─'.repeat(w))))
  for (const row of rows) {
    console.log(line(columns.map(c => String(c.value(row) ?? ''))))
  }
}

/**
 * Counts Hangul and other wide glyphs as two columns.
 *
 * Macro and group names here are typically Korean, and padding them by
 * `String.length` leaves every column after the first one ragged.
 */
function displayWidth(text) {
  let width = 0
  for (const char of text) {
    const code = char.codePointAt(0)
    width += isWide(code) ? 2 : 1
  }
  return width
}

function isWide(code) {
  return (
    (code >= 0x1100 && code <= 0x115f) || // Hangul Jamo
    (code >= 0x2e80 && code <= 0xa4cf) || // CJK radicals .. Yi
    (code >= 0xac00 && code <= 0xd7a3) || // Hangul syllables
    (code >= 0xf900 && code <= 0xfaff) || // CJK compatibility ideographs
    (code >= 0xfe30 && code <= 0xfe6f) ||
    (code >= 0xff00 && code <= 0xff60) || // Fullwidth forms
    (code >= 0xffe0 && code <= 0xffe6)
  )
}

function pad(text, width) {
  return text + ' '.repeat(Math.max(0, width - displayWidth(text)))
}

/** A green/red dot, or plain text when the output is not a terminal. */
export function dot(on) {
  if (!process.stdout.isTTY) return on ? '●' : '○'
  return on ? '[32m●[0m' : '[90m○[0m'
}
