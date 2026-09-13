import { expect, it, vi } from 'vitest'
vi.mock('electron', () => ({ BrowserWindow: {}, session: {} }))
import { cleanSearchResults, searchWithFallback } from './text-web-search'
import { wantsWebSearch, searchQuery } from '../shared/web-search'

it('resolves relative years before searching without hardcoding the answer', () => {
    expect(searchQuery('search on internet and let me know who was the president of china 30 years ago', new Date('2026-09-13'))).toBe('who was the president of china in 1996')
    expect(searchQuery('who led France 1 year ago', new Date('2026-09-13'))).toBe('who led France in 2025')
})

it('uses Google without a second lookup when it succeeds', async () => {
    const run = vi.fn().mockResolvedValue([{ title: 'Source', url: 'https://example.com', snippet: 'Evidence' }])
    expect((await searchWithFallback('question', undefined, run)).provider).toBe('google')
    expect(run).toHaveBeenCalledTimes(1)
})
it('falls back when Google is blocked', async () => {
    const run = vi.fn().mockRejectedValueOnce(new Error('CAPTCHA')).mockResolvedValueOnce([])
    expect((await searchWithFallback('question', undefined, run)).provider).toBe('duckduckgo')
    expect(run.mock.calls.map(call => call[0])).toEqual(['google', 'duckduckgo'])
})
it('reports failure instead of inventing a current answer', async () => {
    await expect(searchWithFallback('question', undefined, vi.fn().mockRejectedValue(new Error('offline')))).rejects.toThrow('no current web answer')
})
it('does not fall back after cancellation', async () => {
    const controller = new AbortController()
    const run = vi.fn().mockImplementation(async () => { controller.abort(); throw new Error('canceled') })
    await expect(searchWithFallback('question', controller.signal, run)).rejects.toBeDefined()
    expect(run).toHaveBeenCalledTimes(1)
})
it('unwraps links and drops unsafe URLs and duplicates', () => {
    const item = { title: 'Source', snippet: 'Evidence', url: 'https://www.google.com/url?q=https%3A%2F%2Fexample.com%2F' }
    expect(cleanSearchResults([item, item, { ...item, url: 'javascript:alert(1)' }], 'google')).toEqual([{ title: 'Source', snippet: 'Evidence', url: 'https://example.com/' }])
})
it.each(['Who is the president of the USA?', 'What is the latest release?', 'Search Google for Python news', 'Weather tomorrow', 'What is the exchange rate today?'])('searches fresh questions: %s', text => expect(wantsWebSearch(text)).toBe(true))
it.each(['Write a Python sorting function', 'Explain photosynthesis', 'Do not search the web. Who is president?', 'Offline only: latest release?'])('avoids unnecessary or forbidden searches: %s', text => expect(wantsWebSearch(text)).toBe(false))
