import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query"
import { fetchLibraryTags } from "@/api/libraryApi"
import { useUser } from "@/context/AuthContext"
import { useDebounce } from "@/hooks/useDebounce"
import { hasUnusableContinuation, libraryPageOptions } from "@/hooks/useLibrary"

export function tagSearchOptions(session, term, enabled = true) {
    const key = ["tags", session?.userId, "picker", term]
    const fetchPage = ({ signal, ...params }) => {
        session.signal.throwIfAborted()
        return fetchLibraryTags({ ...params, signal: AbortSignal.any([signal, session.signal]) })
    }
    return {
        ...libraryPageOptions(key, fetchPage, { q: term, sort: "name", order: "asc" },
            enabled && !!session && term !== null),
        staleTime: 60_000,
        gcTime: 120_000,
    }
}

export function useTagSearch(query, enabled) {
    const { session } = useUser()
    const queryClient = useQueryClient()
    const term = query.trim()
    const debouncedTerm = useDebounce(term)
    // Detach the old observer during debounce so unused requests can be canceled immediately.
    const settled = term === debouncedTerm
    const options = tagSearchOptions(session, settled ? term : null, enabled)
    const search = useInfiniteQuery(options)
    const tags = new Map()
    for (const page of search.data?.pages ?? []) {
        for (const tag of page.items) tags.set(tag.id, tag)
    }
    const invalidCursor = hasUnusableContinuation(search)
    return {
        tags: [...tags.values()],
        loading: enabled && (!settled || search.isPending),
        hasResults: settled && !!search.data,
        error: search.isError || invalidCursor,
        hasMore: search.hasNextPage && !invalidCursor,
        loadingMore: search.isFetchingNextPage,
        loadMore: () => search.fetchNextPage({ cancelRefetch: false }),
        retry: () => {
            if (invalidCursor) return queryClient.resetQueries({ queryKey: options.queryKey, exact: true })
            if (search.isFetchNextPageError) return search.fetchNextPage({ cancelRefetch: false })
            return search.refetch({ cancelRefetch: false })
        },
    }
}
