// Unit tests for the config precedence model (docs/api/cli-design.md).
// fs/env/cwd/platform are all injected, so these never touch the real
// filesystem or the real environment.
//
// Run: node --test test/*.test.mjs

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'

import { CONFIGURABLE_KEYS, ConfigError, describeSource, resolveConfig } from '../src/config.mjs'

const CWD = 'C:\\project'
const PROJECT_PATH = join(CWD, '.macrosuiterc.json')
const APPDATA = 'C:\\Users\\test\\AppData\\Roaming'
const GLOBAL_PATH = join(APPDATA, 'macrosuite', 'config.json')

/** A readFileSync stub backed by a plain path->text map; anything absent is ENOENT. */
function filesystem(files) {
  return (path, _encoding) => {
    if (Object.prototype.hasOwnProperty.call(files, path)) return files[path]
    const error = new Error(`ENOENT: no such file, open '${path}'`)
    error.code = 'ENOENT'
    throw error
  }
}

function deps({ env = {}, files = {}, cwd = CWD, platform = 'win32' } = {}) {
  return { env, cwd, platform, readFileSync: filesystem(files) }
}

describe('resolveConfig precedence', () => {
  it('falls back to the built-in default when nothing else is set', () => {
    const { values, sources } = resolveConfig({}, deps())
    assert.equal(values.url, 'http://127.0.0.1:17821')
    assert.equal(values.backend, 'mock')
    assert.deepEqual(sources.backend, { source: 'default', path: null })
  })

  it('a flag beats every other layer', () => {
    const { values, sources } = resolveConfig(
      { backend: 'sendInput' },
      deps({
        env: { MACROSUITE_BACKEND: 'mock', APPDATA },
        files: {
          [PROJECT_PATH]: JSON.stringify({ backend: 'mock' }),
          [GLOBAL_PATH]: JSON.stringify({ backend: 'mock' }),
        },
      }),
    )
    assert.equal(values.backend, 'sendInput')
    assert.equal(sources.backend.source, 'flag')
  })

  it('env beats project and global files', () => {
    const { values, sources } = resolveConfig(
      {},
      deps({
        env: { MACROSUITE_URL: 'http://env:1', APPDATA },
        files: {
          [PROJECT_PATH]: JSON.stringify({ url: 'http://project:1' }),
          [GLOBAL_PATH]: JSON.stringify({ url: 'http://global:1' }),
        },
      }),
    )
    assert.equal(values.url, 'http://env:1')
    assert.equal(sources.url.source, 'env')
    assert.equal(sources.url.path, 'MACROSUITE_URL')
  })

  it('the project file beats the global file', () => {
    const { values, sources } = resolveConfig(
      {},
      deps({
        env: { APPDATA },
        files: {
          [PROJECT_PATH]: JSON.stringify({ url: 'http://project:1' }),
          [GLOBAL_PATH]: JSON.stringify({ url: 'http://global:1' }),
        },
      }),
    )
    assert.equal(values.url, 'http://project:1')
    assert.equal(sources.url.source, 'project')
    assert.equal(sources.url.path, PROJECT_PATH)
  })

  it('the global file applies when the project file has nothing for that key', () => {
    const { values, sources } = resolveConfig(
      {},
      deps({ env: { APPDATA }, files: { [GLOBAL_PATH]: JSON.stringify({ backend: 'sendInput' }) } }),
    )
    assert.equal(values.backend, 'sendInput')
    assert.equal(sources.backend.source, 'global')
    assert.equal(sources.backend.path, GLOBAL_PATH)
  })

  it('a missing config file is silently treated as empty, not an error', () => {
    assert.doesNotThrow(() => resolveConfig({}, deps({ env: { APPDATA } })))
  })

  it('json coerces the string forms an env var can carry', () => {
    assert.equal(resolveConfig({}, deps({ env: { MACROSUITE_JSON: '1' } })).values.json, true)
    assert.equal(resolveConfig({}, deps({ env: { MACROSUITE_JSON: 'true' } })).values.json, true)
    assert.equal(resolveConfig({}, deps({ env: { MACROSUITE_JSON: '0' } })).values.json, false)
  })

  it('timeoutMs coerces the string form an env var carries', () => {
    assert.equal(resolveConfig({}, deps({ env: { MACROSUITE_TIMEOUT: '9000' } })).values.timeoutMs, 9000)
  })

  it('rejects a non-numeric timeoutMs, naming the offending source', () => {
    assert.throws(
      () => resolveConfig({}, deps({ env: { MACROSUITE_TIMEOUT: 'soon' } })),
      (error) => error instanceof ConfigError && /MACROSUITE_TIMEOUT/.test(error.message),
    )
  })

  it('rejects an invalid enum value with the offending source named', () => {
    assert.throws(
      () => resolveConfig({}, deps({ env: { MACROSUITE_BACKEND: 'keyboard' } })),
      (error) => error instanceof ConfigError && /MACROSUITE_BACKEND/.test(error.message),
    )
  })

  it('rejects a project file that is not a JSON object', () => {
    assert.throws(() => resolveConfig({}, deps({ files: { [PROJECT_PATH]: '[1,2,3]' } })), ConfigError)
  })

  it('rejects invalid JSON in a config file, naming the file', () => {
    assert.throws(
      () => resolveConfig({}, deps({ files: { [PROJECT_PATH]: '{not json' } })),
      (error) => error instanceof ConfigError && error.message.includes(PROJECT_PATH),
    )
  })

  it('rejects an unrecognized key — visibility and revision are deliberately not configurable', () => {
    assert.throws(
      () => resolveConfig({}, deps({ files: { [PROJECT_PATH]: JSON.stringify({ visibility: 'public' }) } })),
      (error) => error instanceof ConfigError && /visibility/.test(error.message),
    )
  })

  it('resolves every configurable key, never leaving one unset', () => {
    const { values } = resolveConfig({}, deps())
    for (const key of CONFIGURABLE_KEYS) assert.ok(key in values, `missing ${key}`)
  })

  it('on non-Windows platforms without XDG_CONFIG_HOME, the global path falls under ~/.config', () => {
    const { globalPath } = resolveConfig({}, deps({ platform: 'linux', env: { HOME: '/home/x' } }))
    assert.ok(globalPath.includes('.config'))
    assert.ok(globalPath.endsWith('config.json'))
  })

  it('on Windows without APPDATA, there is no global config path at all', () => {
    const { globalPath } = resolveConfig({}, deps({ platform: 'win32', env: {} }))
    assert.equal(globalPath, null)
  })
})

describe('describeSource', () => {
  it('reads naturally for a human', () => {
    assert.equal(describeSource({ source: 'flag', path: null }), '플래그')
    assert.equal(describeSource({ source: 'default', path: null }), '기본값')
    assert.equal(describeSource({ source: 'env', path: 'MACROSUITE_URL' }), '환경변수 MACROSUITE_URL')
  })
})
