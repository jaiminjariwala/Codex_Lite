import { BrowserWindow, session } from 'electron'
import { randomUUID } from 'node:crypto'

export type SearchProvider = 'google' | 'duckduckgo'
export interface SearchResult { title: string; url: string; snippet: string }
let searchesInFlight = 0
function publishStatus(): void {
    for (const window of BrowserWindow.getAllWindows()) {
        if (!window.isDestroyed()) window.webContents.send('search:status', searchesInFlight > 0)
    }
}
export function cleanSearchResults(results: SearchResult[], provider: SearchProvider): SearchResult[] {
    const seen = new Set<string>()
    return results.flatMap(item => {
        try {
            const link = new URL(item.url)
            const wrapped = provider === 'duckduckgo' ? link.searchParams.get('uddg') : link.pathname === '/url' ? link.searchParams.get('q') || link.searchParams.get('url') : null
            const target = new URL(wrapped || item.url)
            if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password || !item.title.trim()) return []
            if (/(^|\.)(google\.com|duckduckgo\.com)$/.test(target.hostname) || seen.has(target.href)) return []
            seen.add(target.href)
            return [{ title: item.title.trim().slice(0, 200), url: target.href, snippet: item.snippet.trim().slice(0, 1500) }]
        } catch { return [] }
    }).slice(0, 5)
}

/** Isolated text-only lookup: no screenshots, app cookies, or privileged IPC. */
async function searchProvider(provider: SearchProvider, query: string, signal?: AbortSignal): Promise<SearchResult[]> {
    signal?.throwIfAborted()
    const isolated = session.fromPartition(`search-${randomUUID()}`)
    const domain = provider === 'google' ? 'google.com' : 'duckduckgo.com'
    isolated.setPermissionRequestHandler((_wc, _permission, done) => done(false))
    isolated.on('will-download', event => event.preventDefault())
    isolated.webRequest.onBeforeRequest((details, done) => {
        try {
            const url = new URL(details.url)
            done({ cancel: url.protocol !== 'https:' || !(url.hostname === domain || url.hostname.endsWith(`.${domain}`)) })
        } catch { done({ cancel: true }) }
    })
    const window = new BrowserWindow({ show: false, webPreferences: { session: isolated, sandbox: true, contextIsolation: true, nodeIntegration: false } })
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    const destroy = (): void => { if (!window.isDestroyed()) window.destroy() }
    let timer: ReturnType<typeof setTimeout> | undefined
    let rejectAbort: ((reason: unknown) => void) | undefined
    const abort = (): void => { rejectAbort?.(signal?.reason ?? new Error('Search canceled')); destroy() }
    signal?.addEventListener('abort', abort, { once: true })
    try {
        const operation = async (): Promise<SearchResult[]> => {
            const url = provider === 'google' ? `https://www.google.com/search?hl=en&q=${encodeURIComponent(query.slice(0, 600))}` : `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query.slice(0, 600))}`
            await window.loadURL(url)
            signal?.throwIfAborted()
            const page: { blocked: boolean; results: SearchResult[] } = await window.webContents.executeJavaScript(`(() => {
                const blocked = /\\/sorry\\//.test(location.pathname) || location.hostname.startsWith('consent.') || !!document.querySelector('form[action*="sorry"], #captcha, .g-recaptcha, #challenge-form, .anomaly-modal');
                if (blocked) return { blocked: true, results: [] };
                const results = ${provider === 'google'} ? Array.from(document.querySelectorAll('a:has(h3)')).map(a => {
                    const container = a.closest('.MjjYud, .g, .tF2Cxc') || a.parentElement;
                    const snippet = container?.querySelector('.VwiC3b, .IsZvec, [data-sncf]');
                    return { title: a.querySelector('h3')?.textContent || '', url: a.href, snippet: snippet?.textContent || container?.innerText || '' };
                }) : Array.from(document.querySelectorAll('.result')).map(el => ({title: el.querySelector('.result__a')?.textContent || '', url: el.querySelector('.result__a')?.href || '', snippet: el.querySelector('.result__snippet')?.textContent || ''}));
                return { blocked: false, results: results.slice(0, 20) };
            })()`)
            if (page.blocked) throw new Error(`${provider} requires human verification`)
            const results = cleanSearchResults(page.results, provider)
            if (!results.length) throw new Error(`${provider} returned no readable results`)
            return results
        }
        return await Promise.race([
            operation(),
            new Promise<never>((_, reject) => {
                rejectAbort = reject
                timer = setTimeout(() => { reject(new Error('Search timed out')); destroy() }, 15000)
                if (signal?.aborted) abort()
            })
        ])
    } finally {
        if (timer) clearTimeout(timer)
        signal?.removeEventListener('abort', abort)
        destroy()
        await isolated.clearStorageData().catch(() => {})
    }
}

export async function searchWithFallback(query: string, signal?: AbortSignal, run = searchProvider): Promise<{ provider: SearchProvider; results: SearchResult[] }> {
    for (const provider of ['google', 'duckduckgo'] as const) {
        signal?.throwIfAborted()
        try { return { provider, results: await run(provider, query, signal) } }
        catch { signal?.throwIfAborted() }
    }
    throw new Error('Google and DuckDuckGo could not return readable results. They may be blocked or unavailable. Please try again later; no current web answer was verified.')
}
export async function textWebSearch(query: string, signal?: AbortSignal): Promise<string> {
    searchesInFlight++; publishStatus()
    try { return JSON.stringify(await searchWithFallback(query, signal)) }
    finally { searchesInFlight--; publishStatus() }
}
