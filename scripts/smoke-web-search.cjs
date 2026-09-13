// Real public lookup, using Electron's isolated search windows; no model or payment calls.
const { buildSync } = require('esbuild')
const { mkdtempSync, rmSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { spawnSync } = require('node:child_process')
const folder = mkdtempSync(join(tmpdir(), 'codex-search-smoke-'))
const query = process.argv[2] || 'Python official documentation'
try {
    const output = join(folder, 'search.cjs')
    buildSync({ stdin: { contents: `
        import { app } from 'electron';
        import { searchWithFallback } from './src/main/text-web-search';
        import { answerFromEvidence } from './src/main/web-answer';
        app.on('window-all-closed', () => {});
        app.whenReady().then(async () => {
            try {
                const result = await searchWithFallback(${JSON.stringify(query)});
                console.log(JSON.stringify(result));
                if (${JSON.stringify(process.argv.includes('--answer'))}) {
                    const answer = await answerFromEvidence(${JSON.stringify(query)}, result, async prompt => {
                        const response = await fetch('http://127.0.0.1:11435/v1/chat/completions', {
                            method:'POST', headers:{'Content-Type':'application/json'},
                            body:JSON.stringify({model:${JSON.stringify(process.env.LOCAL_SMOKE_MODEL || 'qwen2.5-coder:1.5b')},messages:[{role:'user',content:prompt}]})
                        });
                        if (!response.ok) throw new Error('Local inference HTTP ' + response.status);
                        const text = (await response.json()).choices[0]?.message?.content || '';
                        if (${JSON.stringify(process.env.LOCAL_SMOKE_DEBUG === '1')}) console.log('MODEL OUTPUT:', text);
                        return text;
                    });
                    console.log(answer);
                }
                app.exit(result.results.length ? 0 : 1);
            } catch(error) { console.error(String(error)); app.exit(1); }
        });`, resolveDir: process.cwd(), loader: 'ts' }, outfile: output, bundle: true, platform: 'node', external: ['electron'] })
    const env = { ...process.env }
    delete env.ELECTRON_RUN_AS_NODE
    const result = spawnSync(require('electron'), [output], { env, stdio: 'inherit', timeout: process.argv.includes('--answer') ? 180000 : 45000 })
    process.exitCode = result.status ?? 1
} finally { rmSync(folder, { recursive: true, force: true }) }
