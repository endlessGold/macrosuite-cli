// Configuration precedence: flag > env > project file > global file > built-in
// default. See docs/api/cli-design.md for the design this implements.
//
// The whole point of this module is that a fully-flagged invocation is
// unaffected by anything here — config only removes typing for the values a
// person would otherwise retype every time (§2.1, §1 of the design doc).
// `visibility` and `revision` are deliberately not configurable: their
// meaning changes per invocation, so a global default for them would be a
// footgun (e.g. every future `library save` silently becoming public).

import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export class ConfigError extends Error {}

export const CONFIGURABLE_KEYS = ['url', 'backend', 'lang', 'scope', 'json', 'timeoutMs']

const DEFAULTS = {
  url: 'http://127.0.0.1:17821',
  backend: 'mock',
  lang: 'typescript',
  scope: 'mine',
  json: false,
  timeoutMs: 5000,
}

const ENV_NAMES = {
  url: 'MACROSUITE_URL',
  backend: 'MACROSUITE_BACKEND',
  lang: 'MACROSUITE_LANG',
  scope: 'MACROSUITE_SCOPE',
  json: 'MACROSUITE_JSON',
  timeoutMs: 'MACROSUITE_TIMEOUT',
}

/** Windows: `%APPDATA%\macrosuite\config.json`. Everywhere else: XDG. */
function globalConfigPath(env, platform) {
  if (platform === 'win32') {
    return env.APPDATA ? join(env.APPDATA, 'macrosuite', 'config.json') : null
  }
  const base = env.XDG_CONFIG_HOME || join(homedir(), '.config')
  return join(base, 'macrosuite', 'config.json')
}

function readJsonFile(path, readFileSync_) {
  if (!path) return {}
  let text
  try {
    text = readFileSync_(path, 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') return {}
    throw new ConfigError(`${path}을(를) 읽을 수 없습니다: ${error.message}`)
  }
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    throw new ConfigError(`${path}이(가) 올바른 JSON이 아닙니다: ${error.message}`)
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ConfigError(`${path}은(는) 객체여야 합니다.`)
  }
  for (const key of Object.keys(parsed)) {
    if (!CONFIGURABLE_KEYS.includes(key)) {
      throw new ConfigError(
        `${path}: 알 수 없는 설정 키 "${key}". 설정 가능한 키: ${CONFIGURABLE_KEYS.join(', ')}.`,
      )
    }
  }
  return parsed
}

function coerce(key, rawValue, from) {
  if (key === 'json') {
    if (typeof rawValue === 'boolean') return rawValue
    if (typeof rawValue === 'string') return rawValue === '1' || rawValue.toLowerCase() === 'true'
    throw new ConfigError(`${from}: json은 불리언이어야 합니다.`)
  }
  if (key === 'timeoutMs') {
    const n = typeof rawValue === 'number' ? rawValue : Number(rawValue)
    if (!Number.isFinite(n) || n <= 0) throw new ConfigError(`${from}: timeoutMs는 양수여야 합니다 (받은 값: ${rawValue}).`)
    return n
  }
  if (key === 'backend' && rawValue !== 'mock' && rawValue !== 'sendInput') {
    throw new ConfigError(`${from}: backend는 mock 또는 sendInput이어야 합니다 (받은 값: ${rawValue}).`)
  }
  if (key === 'lang' && rawValue !== 'typescript' && rawValue !== 'json-dsl') {
    throw new ConfigError(`${from}: lang은 typescript 또는 json-dsl이어야 합니다 (받은 값: ${rawValue}).`)
  }
  if (key === 'scope' && rawValue !== 'mine' && rawValue !== 'public') {
    throw new ConfigError(`${from}: scope는 mine 또는 public이어야 합니다 (받은 값: ${rawValue}).`)
  }
  return rawValue
}

/**
 * @param {Partial<Record<typeof CONFIGURABLE_KEYS[number], unknown>>} flags
 *   Only the keys the user actually typed this run — not parser defaults.
 * @param {{env?, cwd?, platform?, readFileSync?}} [deps] Injected for tests.
 * @returns {{ values: object, sources: Record<string, {source: string, path: string|null}>, projectPath: string, globalPath: string|null }}
 */
export function resolveConfig(flags, deps = {}) {
  const env = deps.env ?? process.env
  const cwd = deps.cwd ?? process.cwd()
  const platform = deps.platform ?? process.platform
  const readFileSync_ = deps.readFileSync ?? readFileSync

  const projectPath = join(cwd, '.macrosuiterc.json')
  const globalPath = globalConfigPath(env, platform)

  const projectConfig = readJsonFile(projectPath, readFileSync_)
  const globalConfig = readJsonFile(globalPath, readFileSync_)

  const values = {}
  const sources = {}

  for (const key of CONFIGURABLE_KEYS) {
    const layers = [
      ['flag', flags[key], null],
      ['env', env[ENV_NAMES[key]], ENV_NAMES[key]],
      ['project', projectConfig[key], projectPath],
      ['global', globalConfig[key], globalPath],
      ['default', DEFAULTS[key], null],
    ]
    for (const [source, rawValue, path] of layers) {
      if (rawValue === undefined) continue
      const from = path ? `${source} (${path})` : source
      values[key] = coerce(key, rawValue, from)
      sources[key] = { source, path }
      break
    }
  }

  return { values, sources, projectPath, globalPath }
}

/** Human-readable "where did this come from" for one resolved key. */
export function describeSource({ source, path }) {
  if (source === 'flag') return '플래그'
  if (source === 'default') return '기본값'
  if (source === 'env') return `환경변수 ${path}`
  if (source === 'project') return `프로젝트 설정 ${path}`
  if (source === 'global') return `전역 설정 ${path}`
  return source
}
