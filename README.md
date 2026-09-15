# macrosuite-cli

`macrosuite` — [MacroSuite](https://github.com/endlessGold/macrosuite-engine)의
로컬 Runtime을 터미널에서 조작한다. 오버레이 GUI가 하는 일과 같은 일을, 같은
SDK를 통해 한다.

이 레포는 [MacroSuite 모노레포](https://github.com/endlessGold/macrosuite-engine)의
`cli/`에서 만들어 배포하는 **독립 설치용 스냅샷**이다. 편집은 모노레포
`cli/`에서 하고, 여기에는 그 결과만 올라온다 — 이 레포에 직접 커밋하지 말 것.

```bash
npm install -g github:endlessGold/macrosuite-cli
macrosuite --help
```

또는 로컬에서:

```bash
npm install
node bin/macrosuite.mjs --help
node bin/macrosuite.mjs status
```

Runtime이 먼저 떠 있어야 한다 (모노레포 쪽에서):

```bash
dotnet run --project runtime/MacroRuntime
```

## 여기에 `fetch`가 한 줄도 없는 것이 요점이다

모든 명령이 `@macrosuite/client`(이 레포에는 `vendor/macrosuite-client`로
동봉됨)를 거친다. CLI가 오버레이와 같은 일을 하면서 SDK만 가져다 쓴다면, 그
SDK가 정말로 전체 계약이라는 뜻이다. 다음 프런트엔드는 HTTP를 역설계하는
대신 거기서 시작한다.

| 경로 | 역할 |
| --- | --- |
| `bin/macrosuite.mjs` | 진입점 |
| `src/main.mjs` | 인자 파싱과 명령 표 |
| `src/output.mjs` | 표/JSON 출력. 한글 열 정렬(전각 2칸)이 여기 |
| `vendor/macrosuite-client/` | `@macrosuite/client` SDK의 사전 빌드 스냅샷 |

모든 명령이 `--json`을 지원한다. 눈으로만 읽을 수 있는 출력은 스크립트에 못 쓴다.

## 명령

```
macrosuite status | watch | stop
macrosuite macros [new|rm|run|stop|source|graph]
macrosuite library [account|login|logout|list|get|run|save|copy|rm]
macrosuite groups [new|rm|rename|toggle|add|drop|key|unkey|mode]
macrosuite hotkeys [set|clear]
macrosuite keys capture
macrosuite backend <mock|sendInput>
macrosuite diag [mock-events|key-log]
```

전체 명령 문서와 설정/안전 설계는 모노레포에 있다:

- [`docs/api/cli.md`](https://github.com/endlessGold/macrosuite-engine/blob/main/docs/api/cli.md)
- [`docs/api/cli-design.md`](https://github.com/endlessGold/macrosuite-engine/blob/main/docs/api/cli-design.md)
