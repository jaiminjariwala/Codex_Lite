/** Follow revealed text until the reader scrolls away from the bottom. */
export function followConversation(el: HTMLElement): () => void {
    let follow = true
    let frame = 0
    let previousTop = el.scrollTop
    const update = (): void => {
        cancelAnimationFrame(frame)
        frame = requestAnimationFrame(() => { if (follow) el.scrollTop = el.scrollHeight })
    }
    const scroll = (): void => {
        if (el.scrollTop < previousTop) follow = false
        else if (el.scrollHeight - el.clientHeight - el.scrollTop < 80) follow = true
        previousTop = el.scrollTop
    }
    const wheel = (event: WheelEvent): void => { if (event.deltaY < 0) follow = false }
    const changes = new MutationObserver(update)
    changes.observe(el, { subtree: true, childList: true, characterData: true })
    const resize = new ResizeObserver(update)
    resize.observe(el)
    el.addEventListener('scroll', scroll)
    el.addEventListener('wheel', wheel, { passive: true })
    update()
    return () => { cancelAnimationFrame(frame); changes.disconnect(); resize.disconnect(); el.removeEventListener('scroll', scroll); el.removeEventListener('wheel', wheel) }
}
