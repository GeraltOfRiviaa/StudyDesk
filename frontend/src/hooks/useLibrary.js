import { useId, useMemo, useState } from "react"
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query"
import { useUser } from "@/context/AuthContext"
import { fetchLibrary, fetchLibraryTags } from "@/api/libraryApi"

export function useLibrarySequence(viewKey) {
    const instance = useId()
    const [sequence, setSequence] = useState({ viewKey, revision: 0 })
    if (sequence.viewKey !== viewKey) {
        setSequence({ viewKey, revision: sequence.revision + 1 })
    }
    return {
        id: `${instance}:${sequence.revision}`,
        restart: () => setSequence(previous => ({ ...previous, revision: previous.revision + 1 })),
    }
}

export function useLibrary(filters, enabled, sequenceId) {
    const { session } = useUser()

    return useLibraryPages(["library", session?.userId, filters, sequenceId], fetchLibrary, filters, enabled, session)
}

export function useLibraryTags(filters, enabled, sequenceId) {
    const { session } = useUser()

    return useLibraryPages(["tags", session?.userId, "library", filters, sequenceId], fetchLibraryTags, filters, enabled, session)
}

function getNextCursor(lastPage, pageParams) {
    const cursor = lastPage?.next_cursor
    // A cursor already in the page history cannot advance this list.
    if (lastPage?.has_more && typeof cursor === "string" && cursor && !pageParams.includes(cursor)) return cursor
}

class InvalidLibraryCursor extends Error {}

export function libraryPageOptions(queryKey, fetchPage, filters, enabled) {
    return {
        queryKey,
        queryFn: async ({ pageParam, signal }) => {
            try {
                return await fetchPage({ ...filters, cursor: pageParam, signal })
            } catch (error) {
                if (pageParam && error instanceof Response && error.status === 422) {
                    const body = await error.clone().json().catch(() => null)
                    if (body?.detail === "Invalid cursor") {
                        throw new InvalidLibraryCursor("Invalid cursor", { cause: error })
                    }
                }
                throw error
            }
        },
        initialPageParam: null,
        getNextPageParam: (lastPage, _pages, _lastParam, pageParams) => getNextCursor(lastPage, pageParams),
        // Each view revision has its own pages. Remove superseded entries after the observer leaves.
        gcTime: 0,
        retry: (count, error) => count < 1 && !(error instanceof InvalidLibraryCursor),
        refetchOnReconnect: query => !(query.state.error instanceof InvalidLibraryCursor),
        enabled,
    }
}

export function hasUnusableContinuation(query) {
    return query.error instanceof InvalidLibraryCursor ||
        (!!query.data?.pages.at(-1)?.has_more && !query.hasNextPage)
}

function useLibraryPages(queryKey, fetchPage, filters, enabled, session) {
    const queryClient = useQueryClient()
    const fetchForSession = ({ signal, ...params }) => {
        session.signal.throwIfAborted()
        return fetchPage({ ...params, signal: AbortSignal.any([signal, session.signal]) })
    }
    const query = useInfiniteQuery(libraryPageOptions(queryKey, fetchForSession, filters, enabled && !!session))

    const { data } = query
    const items = useMemo(() => {
        const rows = new Map()
        for (const page of data?.pages ?? []) {
            for (const item of page.items) {
                const key = `${item.type ?? "tag"}:${item.id}`
                // An edited row can move across a cursor boundary between requests.
                if (!rows.has(key)) rows.set(key, item)
            }
        }
        return [...rows.values()]
    }, [data])
    const hasInvalidCursor = hasUnusableContinuation(query)
    const nextCursor = !hasInvalidCursor && query.hasNextPage ? data.pages.at(-1).next_cursor : null

    const fetchNextPage = () => {
        if (session?.signal.aborted) return false
        // A refresh can change the cursor before React updates this view.
        const state = queryClient.getQueryState(queryKey)
        const latest = state?.data
        if (!nextCursor || state?.fetchStatus !== "idle" || state.error instanceof InvalidLibraryCursor ||
            nextCursor !== getNextCursor(latest?.pages.at(-1), latest?.pageParams)) return false

        void query.fetchNextPage({ cancelRefetch: false })
        return true
    }

    return {
        items,
        hasData: data !== undefined,
        isSuccess: query.isSuccess,
        isError: query.isError,
        fetchStatus: query.fetchStatus,
        nextCursor,
        hasInvalidCursor,
        fetchNextPage,
        isFetchingNextPage: query.isFetchingNextPage,
        isFetchNextPageError: query.isFetchNextPageError,
        isRefetchError: query.isRefetchError,
        refetch: query.refetch,
    }
}
