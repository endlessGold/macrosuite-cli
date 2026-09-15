// The MacroSuite command line.
//
// Every command here goes through `@macrosuite/client` — there is not one
// `fetch` call in this file. That is deliberate and it is the point of the
// split: if the CLI can do everything the overlay can do while importing only
// the SDK, then the SDK really is the whole contract, and the next front end
// (someone else's GUI, a scheduled script, a stream-deck plugin) starts from
// the same place instead of from reverse-engineered HTTP.

import {
  MacroSuiteClient,
  RUN_MODE_OPTIONS,
  RuntimeHttpError,
  RuntimeUnreachableError,
  runModeLabel,
  watchStatus,
} from '@macrosuite/client'

import { readFile } from 'node:fs/promises'

import { ConfigError, describeSource, resolveConfig } from './config.mjs'
import { dot, emit, fail, isJsonMode, setJsonMode, table } from './output.mjs'

const HELP = `MacroSuite CLI — 매크로 런타임을 터미널에서 조작합니다.

사용법: macrosuite <명령> [인자...] [옵션]

상태
  status                          런타임 상태와 실행 중인 매크로
  watch                           상태를 계속 지켜봅니다 (Ctrl+C로 종료)
  stop                            Emergency Stop — 전부 정지 + 모든 키 해제 (F12와 동일)

스크립트
  macros                          스크립트 목록
  macros new <이름> [설명]        빈 매크로 생성
  macros rm <id>                  매크로 삭제
  macros run <id>                 한 번 실행
  macros toggle <id>              실행 중이면 정지, 아니면 실행 (그룹 단축키와 동일 동작)
  macros stop <id>                실행 중인 매크로 정지
  macros source <id>              TypeScript 원본 출력
  macros save <id> <파일|->       원본 교체 (.ts가 그대로 원본; 저장 즉시 재빌드)
  macros graph <id>               노드 그래프(JSON) 출력

라이브러리 — 서버 계정 매크로. get/run이 서버 컴파일 캐시를 내려받아
검증한 뒤 런타임의 메모리 캐시에 적재하고, run은 그 적재된 내용으로 실행한다
  library account                 로그인 상태
  library login <아이디> <비번>   로그인 (세션은 런타임 메모리에만 유지됨)
  library logout                  로그아웃 (실행 중인 서버 매크로도 정지)
  library list [--scope mine|public]  목록 (기본 mine)
  library get <소유자> <id>       문서 조회 — 캐시 적재 여부/해시를 보여줌
  library run <소유자> <id> [리비전] [--backend ...]  실행 (리비전 생략 시 최신을 조회해 사용)
  library save <id> <이름> <파일|-> 저장/수정 (내용은 파일 또는 stdin, --revision으로 수정)
  library copy <소유자> <id>      내 계정으로 비공개 복사
  library rm <id> <리비전>        삭제 (If-Match)

  --lang <typescript|json-dsl>    library 명령이 다룰 언어 (기본 typescript)
  --scope <mine|public>           library list 범위 (기본 mine)
  --visibility <private|public>   library save 공개 범위 (기본 private)
  --revision <리비전>              library save/rm에 쓸 리비전 (If-Match)

그룹 — 실제로 실행되는 단위 (단축키 + 실행 방식 + 스크립트들)
  groups                          그룹 목록
  groups new [이름]               그룹 생성
  groups rm <id>                  그룹 삭제
  groups toggle <id>              단축키를 누른 것과 동일
  groups add <id> <macroId>       스크립트 추가
  groups drop <id> <macroId>      스크립트 제거
  groups key <id> <키이름>        단축키 추가 (예: F10, NUMPAD1)
  groups unkey <id> <키이름>      단축키 제거
  groups mode <id> <방식> [횟수]  실행 방식 변경 (${RUN_MODE_OPTIONS.map(o => o.mode).join(' | ')})
  groups rename <id> <이름>       이름 변경

트리거 키 — 앱 자신의 전역 키 (그룹 단축키와 같은 이름 공간을 씁니다)
  hotkeys                         현재 지정된 키
  hotkeys set <이름> <키>         키 지정 (바꾸는 즉시 저장됩니다)
  hotkeys set <이름> --capture    직접 눌러서 지정
  hotkeys clear <이름>            키 해제 (전부 정지는 해제할 수 없습니다)

입력
  backend <mock|sendInput>        입력 모드를 모든 그룹에 일괄 적용
  keys capture [초]               다음에 누르는 키를 알려줍니다 (Esc로 취소)

진단
  diag mock-events                Mock 백엔드가 기록한 입력
  diag key-log start [초]         저수준 후크 기록 시작
  diag key-log stop               기록 정지
  diag key-log                    기록된 키 출력

설정
  config                          url/backend/lang/scope/json/timeout이
                                   어디서 왔는지(플래그/환경변수/설정파일/
                                   기본값) 보여줍니다

옵션
  --url <주소>                    런타임 주소 (기본: http://127.0.0.1:17821)
  --backend <mock|sendInput>      run/add에 쓸 입력 모드 (기본: mock)
  --capture                       hotkeys set에서 키를 직접 눌러 지정
  --json                          결과를 JSON으로 출력 (스크립트용)
  --timeout <ms>                  요청 제한 시간 (기본: 5000)
  -h, --help                      이 도움말

입력 모드 주의: sendInput은 실제 키 입력을 지금 포커스된 창으로 보냅니다.
기본값이 mock인 이유입니다.

설정 우선순위 (구체적인 것이 이긴다): 플래그 > 환경변수 > 프로젝트 설정
(./.macrosuiterc.json) > 사용자 전역 설정 (Windows: %APPDATA%\\macrosuite\\
config.json, 그 외: ~/.config/macrosuite/config.json) > 내장 기본값.
url/backend/lang/scope/json/timeout만 설정 가능합니다 — visibility와
revision은 실행마다 뜻이 달라지는 값이라 설정으로 못 앉힙니다. 환경변수:
MACROSUITE_URL, MACROSUITE_BACKEND, MACROSUITE_LANG, MACROSUITE_SCOPE,
MACROSUITE_JSON, MACROSUITE_TIMEOUT. 무엇이 어디서 왔는지는 \`macrosuite
config\`로 확인하세요. sendInput이 플래그가 아닌 곳(환경변수/설정 파일)에서
기본값으로 왔을 때는 실행 전에 경고를 띄웁니다 — 자세한 설계는
docs/api/cli-design.md.`

/**
 * Flags can appear anywhere, so they are pulled out before the verbs are
 * read. Only the *configurable* flags (url/backend/lang/scope/json/timeout)
 * go into `explicit` — and only when the user actually typed them, never a
 * default — because `resolveConfig` needs to tell "you asked for this" apart
 * from "nobody asked, use mock". The rest (help/capture/visibility/revision)
 * are CLI-local: they mean something different on every invocation, so they
 * are never layered with env vars or config files (docs/api/cli-design.md).
 */
function parseArgs(argv) {
  const explicit = {}
  const local = { help: false, capture: false, visibility: 'private', revision: undefined }
  const positional = []

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    switch (arg) {
      case '--url':
        explicit.url = argv[++i]
        break
      case '--backend':
        explicit.backend = argv[++i]
        break
      case '--timeout':
        explicit.timeoutMs = argv[++i]
        break
      case '--json':
        explicit.json = true
        break
      case '--capture':
        local.capture = true
        break
      case '--lang':
        explicit.lang = argv[++i]
        break
      case '--scope':
        explicit.scope = argv[++i]
        break
      case '--visibility':
        local.visibility = argv[++i]
        break
      case '--revision':
        local.revision = argv[++i]
        break
      case '-h':
      case '--help':
        local.help = true
        break
      default:
        if (arg.startsWith('--')) throw new UsageError(`알 수 없는 옵션: ${arg}`)
        positional.push(arg)
    }
  }

  if (local.visibility !== 'private' && local.visibility !== 'public') {
    throw new UsageError(`--visibility는 private 또는 public이어야 합니다 (받은 값: ${local.visibility})`)
  }

  return { explicit, local, positional }
}

class UsageError extends Error {}

/** Requires an argument the command cannot run without. */
function need(value, what) {
  if (!value) throw new UsageError(`${what}이(가) 필요합니다. macrosuite --help 를 보세요.`)
  return value
}

export async function run(argv) {
  let parsed
  try {
    parsed = parseArgs(argv)
  } catch (error) {
    if (error instanceof UsageError) {
      fail(error.message)
      return
    }
    throw error
  }

  const { explicit, local, positional } = parsed

  // Provisional, so a broken config file can still report itself as JSON
  // when the caller explicitly asked for --json; resolveConfig's own result
  // (below) is what every command actually runs with.
  setJsonMode(explicit.json === true)

  let config
  try {
    config = resolveConfig(explicit)
  } catch (error) {
    if (error instanceof ConfigError) {
      fail(error.message)
      return
    }
    throw error
  }

  const options = { ...config.values, ...local }
  setJsonMode(options.json)

  if (options.help || positional.length === 0) {
    console.log(HELP)
    return
  }

  const client = new MacroSuiteClient({ baseUrl: options.url, timeoutMs: options.timeoutMs })

  try {
    await dispatch(client, positional, options, config)
  } catch (error) {
    if (error instanceof UsageError) {
      fail(error.message)
    } else if (error instanceof RuntimeUnreachableError) {
      fail(`MacroRuntime에 연결할 수 없습니다 (${client.baseUrl})`, {
        code: 2,
        detail: '런타임이 실행 중인지 확인하세요: dotnet run --project runtime/MacroRuntime',
      })
    } else if (error instanceof RuntimeHttpError) {
      fail(`런타임이 요청을 거절했습니다 (HTTP ${error.status})`, { code: 3, detail: error.detail })
    } else {
      fail(error?.message ?? String(error), { code: 1 })
    }
  }
}

/**
 * §5 of docs/api/cli-design.md: a config layer may default `backend` to
 * `sendInput`, but never silently — a human running the command sees a
 * warning before it does anything, and a `--json` caller finds the same fact
 * as `backendSource` on the result so a script cannot miss it either.
 */
function warnIfImplicitSendInput(options, config) {
  if (options.backend !== 'sendInput' || config.sources.backend.source === 'flag') return false
  if (!isJsonMode()) {
    console.error(`sendInput이 ${describeSource(config.sources.backend)}(으)로 설정되어 있습니다 — 실제 키 입력을 보냅니다.`)
  }
  return true
}

function withBackendSource(result, options, config) {
  return warnIfImplicitSendInput(options, config) ? { ...result, backendSource: config.sources.backend.source } : result
}

async function dispatch(client, args, options, config) {
  const [command, ...rest] = args

  switch (command) {
    case 'status':
      return showStatus(client)
    case 'watch':
      return watchLoop(client)
    case 'stop':
      return emergencyStop(client)
    case 'config':
      return configCommand(config)
    case 'macros':
      return macrosCommand(client, rest, options, config)
    case 'library':
      return libraryCommand(client, rest, options, config)
    case 'groups':
      return groupsCommand(client, rest, options, config)
    case 'backend':
      return setBackend(client, rest)
    case 'keys':
      return keysCommand(client, rest)
    case 'hotkeys':
      return hotkeysCommand(client, rest, options)
    case 'diag':
      return diagCommand(client, rest)
    default:
      throw new UsageError(`알 수 없는 명령: ${command}`)
  }
}

// --- status ------------------------------------------------------------

async function showStatus(client) {
  const status = await client.status()
  emit(status, s => {
    console.log(`런타임 ${s.runtimeVersion} · 가동 ${Math.round(s.uptimeSeconds)}초`)
    if (s.inputError) console.log(`입력 오류: ${s.inputError}`)
    console.log('')
    table(s.activeMacros, [
      { header: '실행 중', value: m => `${dot(true)} ${m.macroId}` },
      { header: '입력 모드', value: m => m.backend },
      { header: '상태', value: m => m.state },
    ])

    // The Runtime rebuilds a macro when its file is saved, so a broken build is
    // something that happened in an editor — a terminal watching this is
    // exactly where someone would want to see it.
    const broken = (s.scriptIssues ?? []).filter(issue => issue.error)
    if (broken.length > 0) {
      console.log('')
      for (const issue of broken) {
        console.log(`빌드 실패: ${issue.macroId} (이전 코드로 계속 실행됩니다)`)
        console.log(issue.error.trim().split('\n').map(line => `  ${line}`).join('\n'))
      }
    }
  })
}

/**
 * Prints one line per change rather than redrawing a screen: the useful thing
 * to do with this is pipe it somewhere or leave it in a spare terminal, and
 * both of those want an append-only log, not a cursor-addressed dashboard.
 */
async function watchLoop(client) {
  let previous = ''
  let previousBuilds = ''
  const watch = watchStatus(client, {
    intervalMs: 1000,
    onStatus: status => {
      // Builds first: leaving this running in a spare terminal while editing a
      // macro turns it into a build log, which is most of what a watch is for.
      const builds = (status.scriptIssues ?? [])
        .map(issue => `${issue.macroId}:${issue.atUtc}:${issue.error ? 'fail' : 'ok'}`)
        .sort()
        .join('|')

      if (builds !== previousBuilds) {
        previousBuilds = builds
        for (const issue of status.scriptIssues ?? []) {
          const when = new Date().toLocaleTimeString()
          if (issue.error) {
            console.log(`${when}  ✕ ${issue.macroId} 빌드 실패 (이전 코드로 계속 실행)`)
            console.log(issue.error.trim().split('\n').map(line => `    ${line}`).join('\n'))
          } else {
            console.log(`${when}  ✓ ${issue.macroId} 빌드됨${issue.reloaded ? ' — 새 코드로 재시작' : ''}`)
          }
        }
      }

      const running = status.activeMacros.map(m => m.macroId).sort().join(', ')
      const line = running || '(정지)'
      if (line === previous) return
      previous = line
      console.log(`${new Date().toLocaleTimeString()}  ${dot(running.length > 0)} ${line}`)
    },
    onConnectionChange: state => {
      if (state === 'disconnected') {
        previous = ''
        console.log(`${new Date().toLocaleTimeString()}  ${dot(false)} 런타임 연결 끊김`)
      }
    },
  })

  await new Promise(resolve => {
    process.on('SIGINT', () => {
      watch.stop()
      resolve()
    })
  })
}

async function emergencyStop(client) {
  const stopped = await client.runtime.emergencyStop()
  emit({ stoppedCount: stopped }, r => console.log(`${r.stoppedCount}개 매크로를 정지하고 모든 키를 해제했습니다.`))
}

// --- config --------------------------------------------------------------
//
// "왜 이렇게 동작하지?"에 항상 답할 수 있게 하는 명령 (docs/api/cli-design.md
// §4). 다른 모든 명령이 이미 계산해 둔 `config`(resolveConfig의 결과)를 그냥
// 보여주기만 한다 — 별도로 다시 읽지 않는다.

async function configCommand(config) {
  const rows = Object.keys(config.values).map(key => ({
    key,
    value: config.values[key],
    ...config.sources[key],
  }))
  return emit(rows, list =>
    table(list, [
      { header: '키', value: r => r.key },
      { header: '값', value: r => String(r.value) },
      { header: '출처', value: r => describeSource(r) },
    ]),
  )
}

// --- macros ------------------------------------------------------------

async function macrosCommand(client, args, options, config) {
  const [sub, ...rest] = args

  switch (sub ?? 'list') {
    case 'list': {
      const macros = await client.macros.list()
      return emit(macros, list =>
        table(list, [
          { header: 'ID', value: m => m.id },
          { header: '이름', value: m => m.name },
          { header: '설명', value: m => m.description },
        ]),
      )
    }

    case 'new': {
      const name = need(rest[0], '이름')
      const created = await client.macros.create(name, rest.slice(1).join(' '))
      return emit(created, m => console.log(`만들었습니다: ${m.id} (${m.name})`))
    }

    case 'rm': {
      const id = need(rest[0], '매크로 id')
      await client.macros.delete(id)
      return emit({ deleted: id }, r => console.log(`삭제했습니다: ${r.deleted}`))
    }

    case 'run': {
      const id = need(rest[0], '매크로 id')
      const started = await client.macros.run(id, options.backend)
      return emit(withBackendSource(started, options, config), r => console.log(`실행: ${r.macroId} (입력 모드 ${r.backend})`))
    }

    case 'stop': {
      const id = need(rest[0], '매크로 id')
      await client.macros.stop(id)
      return emit({ stopped: id }, r => console.log(`정지: ${r.stopped}`))
    }

    case 'toggle': {
      const id = need(rest[0], '매크로 id')
      const action = await client.macros.toggle(id, options.backend)
      return emit(withBackendSource({ macroId: id, action }, options, config), r =>
        console.log(r.action === 'Started' ? `시작: ${r.macroId}` : `정지: ${r.macroId}`),
      )
    }

    case 'source': {
      const id = need(rest[0], '매크로 id')
      const { source } = await client.macros.graph(id)
      return emit({ macroId: id, source }, r => console.log(r.source))
    }

    case 'save': {
      const id = need(rest[0], '매크로 id')
      const target = rest[1]
      const source = target === undefined || target === '-' ? await readStdin() : await readFile(target, 'utf8')
      await client.macros.saveSource(id, source)
      return emit({ macroId: id }, r => console.log(`저장됨: ${r.macroId}`))
    }

    case 'graph': {
      const id = need(rest[0], '매크로 id')
      const response = await client.macros.graph(id)
      return emit(response.parse, parse => {
        if (!parse.parsable) {
          console.log(`노드로 표현할 수 없는 파일입니다 (${parse.line}번째 줄): ${parse.reason}`)
          return
        }
        console.log(JSON.stringify(parse.graph, null, 2))
      })
    }

    default:
      throw new UsageError(`알 수 없는 macros 하위 명령: ${sub}`)
  }
}

// --- library -------------------------------------------------------------
//
// The account-owned macro library, served through the Runtime's
// `/api/library/*` proxy. `get` and `run` are the interesting ones: both
// pull the server's compiled-script cache (TypeScript compiled once on the
// backend, committed to GitHub) through into the Runtime's own in-memory
// `LibraryScriptCache`, and `run` executes straight from that — no local
// Node compiler involved. Reading `compiled` back on a `get` is the
// observable proof the preload actually happened.

async function readStdin() {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

function short(hash) {
  return typeof hash === 'string' ? `${hash.slice(0, 12)}…` : String(hash)
}

async function libraryCommand(client, args, options, config) {
  const [sub, ...rest] = args
  const lang = options.lang

  switch (sub ?? 'list') {
    case 'account': {
      const account = await client.library.account()
      return emit(account, a =>
        console.log(
          a.configured && a.accountId
            ? `로그인됨: ${a.username} (${a.accountId})${a.expiresAt ? ` — 만료 ${a.expiresAt}` : ''}`
            : a.configured
              ? '로그인되어 있지 않습니다.'
              : '서버 주소가 설정되지 않았습니다 (MACROSUITE_DEPLOY_URL).',
        ),
      )
    }

    case 'login': {
      const username = need(rest[0], '아이디')
      const password = need(rest[1], '비밀번호')
      const account = await client.library.login(username, password)
      return emit(account, a => console.log(`로그인: ${a.username} (${a.accountId})`))
    }

    case 'logout': {
      const account = await client.library.logout()
      return emit(account, () => console.log('로그아웃했습니다.'))
    }

    case 'list': {
      const items = await client.library.list(lang, options.scope)
      return emit(items, list =>
        table(list, [
          { header: '소유자', value: m => m.ownerId },
          { header: 'ID', value: m => m.id },
          { header: '이름', value: m => m.name },
          { header: '공개', value: m => m.visibility },
          { header: '리비전', value: m => m.revision },
          { header: '수정', value: m => m.updatedAt },
        ]),
      )
    }

    case 'get': {
      const owner = need(rest[0], '소유자 계정')
      const id = need(rest[1], '매크로 id')
      const doc = await client.library.get(lang, owner, id)
      return emit(doc, d => {
        console.log(`${d.name} (${d.language}, ${d.visibility}) — 소유자 ${d.ownerId}, 리비전 ${d.revision}`)
        console.log(`원본 ${Buffer.byteLength(d.content, 'utf8')} bytes, sha256 ${short(d.hash)}`)
        if (d.error) console.log(`컴파일 오류 (서버): ${d.error}`)
        else if (d.compiled) {
          console.log(
            `서버 캐시 적재됨 (프리로드 완료): ${Buffer.byteLength(d.compiled.content, 'utf8')} bytes, ` +
              `${d.compiled.compiler}, hash ${short(d.compiled.hash)}`,
          )
        } else {
          console.log('컴파일 결과 없음 (json-dsl은 원본 그대로 해석됩니다).')
        }
      })
    }

    case 'run': {
      const owner = need(rest[0], '소유자 계정')
      const id = need(rest[1], '매크로 id')
      let revision = rest[2]
      if (!revision) {
        if (!isJsonMode()) console.error('리비전이 없어 최신 문서를 조회합니다…')
        revision = (await client.library.get(lang, owner, id)).revision
      }
      const started = await client.library.run(lang, owner, id, revision, options.backend)
      return emit(withBackendSource(started, options, config), r => console.log(`실행: ${r.macroId} (입력 모드 ${r.backend})`))
    }

    case 'save': {
      const id = need(rest[0], '매크로 id')
      const name = need(rest[1], '이름')
      const source = rest[2]
      const content = source === undefined || source === '-' ? await readStdin() : await readFile(source, 'utf8')
      const body = { name, content, visibility: options.visibility, ...(options.revision ? { revision: options.revision } : {}) }
      const doc = await client.library.save(lang, id, body)
      return emit(doc, d => console.log(`저장됨: ${d.id} (리비전 ${d.revision})`))
    }

    case 'copy': {
      const owner = need(rest[0], '소유자 계정')
      const id = need(rest[1], '매크로 id')
      const doc = await client.library.copy(lang, owner, id)
      return emit(doc, d => console.log(`복사됨: ${d.id} (소유자 ${d.ownerId})`))
    }

    case 'rm': {
      const id = need(rest[0], '매크로 id')
      const revision = need(rest[1] ?? options.revision, '리비전 (If-Match)')
      await client.library.delete(lang, id, revision)
      return emit({ deleted: id }, r => console.log(`삭제됨: ${r.deleted}`))
    }

    default:
      throw new UsageError(`알 수 없는 library 하위 명령: ${sub}`)
  }
}

// --- groups ------------------------------------------------------------

async function groupsCommand(client, args, options, config) {
  const [sub, ...rest] = args

  switch (sub ?? 'list') {
    case 'list': {
      const groups = await client.groups.list()
      return emit(groups, list =>
        table(list, [
          { header: '', value: g => dot(g.active) },
          { header: 'ID', value: g => g.id },
          { header: '이름', value: g => g.name },
          { header: '단축키', value: g => g.keys.join(', ') || '(없음)' },
          { header: '실행 방식', value: g => (g.mode === 'Count' ? `${runModeLabel(g.mode)} ×${g.count}` : runModeLabel(g.mode)) },
          { header: '스크립트', value: g => g.members.map(m => m.macroId).join(', ') || '(없음)' },
          { header: '입력 모드', value: g => [...new Set(g.members.map(m => m.backend))].join('/') || '-' },
        ]),
      )
    }

    case 'new': {
      const created = await client.groups.create(rest[0])
      return emit(created, g => console.log(`만들었습니다: ${g.id} (${g.name})`))
    }

    case 'rm': {
      const id = need(rest[0], '그룹 id')
      await client.groups.delete(id)
      return emit({ deleted: id }, r => console.log(`삭제했습니다: ${r.deleted}`))
    }

    case 'rename': {
      const id = need(rest[0], '그룹 id')
      const name = need(rest.slice(1).join(' '), '새 이름')
      const group = await client.groups.update(id, { name })
      return emit(group, g => console.log(`이름을 바꿨습니다: ${g.id} → ${g.name}`))
    }

    case 'toggle': {
      const id = need(rest[0], '그룹 id')
      const action = await client.groups.toggle(id)
      return emit({ groupId: id, action }, r =>
        console.log(r.action === 'Started' ? `시작: ${r.groupId}` : `정지: ${r.groupId}`),
      )
    }

    case 'add': {
      const id = need(rest[0], '그룹 id')
      const macroId = need(rest[1], '매크로 id')
      const group = await client.groups.addMember(id, macroId, options.backend)
      return emit(withBackendSource(group, options, config), g => console.log(`${g.name}에 ${macroId}를 넣었습니다 (입력 모드 ${options.backend}).`))
    }

    case 'drop': {
      const id = need(rest[0], '그룹 id')
      const macroId = need(rest[1], '매크로 id')
      await client.groups.removeMember(id, macroId)
      return emit({ groupId: id, macroId }, r => console.log(`${r.groupId}에서 ${r.macroId}를 뺐습니다.`))
    }

    case 'key': {
      const id = need(rest[0], '그룹 id')
      const key = need(rest[1], '키 이름')
      const group = await client.groups.addKey(id, key)
      return emit(group, g => console.log(`${g.name}의 단축키: ${g.keys.join(', ')}`))
    }

    case 'unkey': {
      const id = need(rest[0], '그룹 id')
      const key = need(rest[1], '키 이름')
      await client.groups.removeKey(id, key)
      return emit({ groupId: id, key }, r => console.log(`${r.groupId}에서 ${r.key}를 뺐습니다.`))
    }

    case 'mode': {
      const id = need(rest[0], '그룹 id')
      const mode = need(rest[1], '실행 방식')
      const known = RUN_MODE_OPTIONS.find(o => o.mode.toLowerCase() === mode.toLowerCase())
      if (!known) {
        throw new UsageError(
          `실행 방식은 ${RUN_MODE_OPTIONS.map(o => `${o.mode}(${o.label})`).join(', ')} 중 하나여야 합니다.`,
        )
      }

      const patch = { mode: known.mode }
      if (known.mode === 'Count') patch.count = Number(need(rest[2], '반복 횟수'))

      const group = await client.groups.update(id, patch)
      return emit(group, g => console.log(`${g.name}의 실행 방식: ${runModeLabel(g.mode)}${g.mode === 'Count' ? ` ×${g.count}` : ''}`))
    }

    default:
      throw new UsageError(`알 수 없는 groups 하위 명령: ${sub}`)
  }
}

// --- input mode --------------------------------------------------------

async function setBackend(client, args) {
  const backend = need(args[0], '입력 모드(mock 또는 sendInput)')
  if (backend !== 'mock' && backend !== 'sendInput') {
    throw new UsageError('입력 모드는 mock 또는 sendInput이어야 합니다.')
  }

  await client.groups.setBackendEverywhere(backend)
  return emit({ backend }, r =>
    console.log(
      r.backend === 'sendInput'
        ? '모든 그룹이 실제 키 입력을 보냅니다 (sendInput).'
        : '모든 그룹이 기록만 합니다 (mock).',
    ),
  )
}

async function keysCommand(client, args) {
  const [sub, ...rest] = args
  if ((sub ?? 'capture') !== 'capture') throw new UsageError(`알 수 없는 keys 하위 명령: ${sub}`)

  const seconds = rest[0] ? Number(rest[0]) : 10
  if (!Number.isFinite(seconds)) throw new UsageError('초는 숫자여야 합니다.')

  // The prompt goes to stderr so `macrosuite keys capture --json | jq` still
  // gets clean JSON on stdout while a person watching the terminal is told
  // that the command is waiting on them.
  if (!isJsonMode()) console.error(`키를 누르세요 (${seconds}초, Esc로 취소)…`)
  const captured = await client.keys.capture(seconds)

  return emit(captured, c => console.log(c.cancelled ? '취소했습니다.' : `누른 키: ${c.key}`))
}

// --- app-level trigger keys --------------------------------------------

/** Accepts `emergencyStop`, `emergency-stop`, `stop` — the exact enum spelling is the Runtime's business. */
function resolveAction(name) {
  const normalized = name.replace(/[-_\s]/g, '').toLowerCase()
  if (['emergencystop', 'stop', 'emergency'].includes(normalized)) return 'EmergencyStop'
  if (['overlaytoggle', 'overlay', 'toggle'].includes(normalized)) return 'OverlayToggle'
  throw new UsageError(`알 수 없는 트리거 이름: ${name} (emergencyStop, overlayToggle)`)
}

async function hotkeysCommand(client, args, options) {
  const [sub, ...rest] = args

  switch (sub ?? 'list') {
    case 'list': {
      const hotkeys = await client.hotkeys.list()
      return emit(hotkeys, list =>
        table(list, [
          { header: '이름', value: h => h.action },
          { header: '키', value: h => h.key ?? '미지정' },
          { header: '무엇을 하나', value: h => h.label },
          { header: '해제', value: h => (h.required ? '불가' : '가능') },
        ]),
      )
    }

    case 'set': {
      const action = resolveAction(need(rest[0], '트리거 이름'))

      let key
      if (options.capture) {
        // The Runtime's global hook reads the press and swallows it, so
        // assigning a key does not also fire it in whatever has focus.
        if (!isJsonMode()) console.error('키를 누르세요 (10초, Esc로 취소)…')
        const captured = await client.keys.capture(10)
        if (captured.cancelled) return emit({ cancelled: true }, () => console.log('취소했습니다.'))
        key = captured.key
      } else {
        key = need(rest[1], '키 이름 (또는 --capture)')
      }

      const updated = await client.hotkeys.set(action, key)
      return emit(updated, h => console.log(`${h.label}: ${h.key} (저장됨)`))
    }

    case 'clear': {
      const action = resolveAction(need(rest[0], '트리거 이름'))
      const updated = await client.hotkeys.clear(action)
      return emit(updated, h => console.log(`${h.label}: 해제됨 (저장됨)`))
    }

    default:
      throw new UsageError(`알 수 없는 hotkeys 하위 명령: ${sub}`)
  }
}

// --- diagnostics -------------------------------------------------------

async function diagCommand(client, args) {
  const [sub, ...rest] = args

  switch (sub) {
    case 'mock-events': {
      const events = await client.diagnostics.mockEvents()
      return emit(events, list => console.log(JSON.stringify(list, null, 2)))
    }

    case 'key-log': {
      const [action, ...actionArgs] = rest

      if (action === 'start') {
        const seconds = actionArgs[0] ? Number(actionArgs[0]) : 15
        await client.diagnostics.startKeyLog(seconds)
        return emit({ recordingForSeconds: seconds }, r => console.log(`${r.recordingForSeconds}초 동안 기록합니다.`))
      }

      if (action === 'stop') {
        await client.diagnostics.stopKeyLog()
        return emit({ recording: false }, () => console.log('기록을 멈췄습니다.'))
      }

      if (action === undefined) {
        const log = await client.diagnostics.keyLog()
        return emit(log, l => {
          console.log(l.recording ? '기록 중' : '기록 정지됨')
          console.log(JSON.stringify(l.entries, null, 2))
        })
      }

      throw new UsageError(`알 수 없는 key-log 하위 명령: ${action}`)
    }

    default:
      throw new UsageError(`알 수 없는 diag 하위 명령: ${sub}`)
  }
}
