import { useEffectEvent, useLayoutEffect, useRef, useState } from "react"

export function useLibraryInfiniteScroll({ enabled, cursor, fetchNextPage }) {
    const scrollRef = useRef(null)
    const sentinelRef = useRef(null)
    const [requestedCursors, setRequestedCursors] = useState(() => new Set())
    const wasRequested = requestedCursors.has(cursor)

    const requestPage = useEffectEvent(() => {
        if (!fetchNextPage()) return false

        // Remember attempts across observer restarts and background refreshes in this view.
        setRequestedCursors(previous => new Set(previous).add(cursor))
        return true
    })

    useLayoutEffect(() => {
        const root = scrollRef.current
        const target = sentinelRef.current
        if (!enabled || !cursor || wasRequested || !root || !target) return

        let active = true
        let started = false
        const observer = new IntersectionObserver(entries => {
            // A callback queued before cleanup can still arrive after the view changes.
            if (active && !started && entries.some(entry => entry.isIntersecting)) {
                started = requestPage()
            }
        }, { root, rootMargin: "0px 0px 160px 0px" })

        // Observing again for the next cursor also handles a viewport that is still underfilled.
        observer.observe(target)
        return () => {
            active = false
            observer.disconnect()
        }
    }, [enabled, cursor, wasRequested])

    return { scrollRef, sentinelRef, wasRequested }
}
