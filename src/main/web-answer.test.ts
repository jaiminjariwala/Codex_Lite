import { expect, it, vi } from 'vitest'
import { answerFromEvidence } from './web-answer'

const evidence = { results: [{ title: 'Example source', url: 'https://example.org/fact', snippet: 'A source excerpt.' }] }
it('resolves valid numbered citations without inventing sources', async () => {
    expect(await answerFromEvidence('Question', evidence, async () => 'Answer [1].')).toBe('Answer [1](https://example.org/fact).')
})
it('retries a plan-only response and accepts a sourced answer', async () => {
    const generate = vi.fn().mockResolvedValueOnce('First, I will search the website.').mockResolvedValueOnce('The evidence is insufficient. [Source](https://example.org/fact)')
    expect(await answerFromEvidence('An arbitrary question', evidence, generate)).toContain('evidence is insufficient')
    expect(generate).toHaveBeenCalledTimes(2)
})
it('returns honest source links after two unusable responses', async () => {
    const generate = vi.fn().mockResolvedValue('I will search for that now.')
    expect(await answerFromEvidence('Another question', evidence, generate)).toContain('could not produce a reliable sourced answer')
    expect(generate).toHaveBeenCalledTimes(2)
})
