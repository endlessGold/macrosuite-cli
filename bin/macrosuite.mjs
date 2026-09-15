#!/usr/bin/env node
import { run } from '../src/main.mjs'

await run(process.argv.slice(2))
