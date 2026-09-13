export function wantsWebSearch(text: string): boolean {
    if (/\b(don't|do not|without|no)\s+(?:use\s+)?(?:web\s+|internet\s+)?(?:search|browse)|\boffline only\b/i.test(text)) return false
    if (/\b(search|look up|browse)\b.*\b(internet|web|online|for|google)\b|\bgoogle\s+(this|for|who|what|when)|^\s*look up\b/i.test(text)) return true
    // Freshness heuristics, not a claim to classify every question.
    if (/^\s*(build|create|implement|install|open|launch|edit|fix|delete|write)\b/i.test(text)) return false
    if (/\b(latest|current|currently|today|right now|up.to.date|breaking news|this week|this month|this year)\b/i.test(text)) return true
    if (/\b(who is|who's)\b.*\b(president|prime minister|ceo|governor|mayor|leader)\b/i.test(text)) return true
    if (/\b(weather|forecast|exchange rate|stock price|live score)\b/i.test(text)) return true
    const years = text.match(/\b20\d{2}\b/g) ?? []
    return years.some(year => Number(year) >= new Date().getFullYear()) && /\b(who|what|when|which|news|price|version)\b/i.test(text)
}
export function searchQuery(text: string, now = new Date()): string {
    return text.replace(/\b(\d+)\s+years? ago\b/gi, (_, years) => `in ${now.getFullYear() - Number(years)}`)
        .replace(/^\s*search\s+(?:on\s+)?(?:the\s+)?(?:internet|web|online)\s*(?:and\s+)?(?:let me know\s*)?/i, '').trim()
}
