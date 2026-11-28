import { useMemo } from "react"
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query"
import { useUser } from "@/context/AuthContext"
import { fetchLibrary, fetchLibraryTags } from "@/api/libraryApi"

export function useLibrary(filters = {}, enabled = true) {
    const { user } = useUser()

    return useLibraryPages(["library", user?.id, filters], fetchLibrary, filters, enabled && !!user?.id)
}

export function useLibraryTags(filters, enabled) {
    const { user } = useUser()

    return useLibraryPages(["tags", user?.id, "library", filters], fetchLibraryTags, filters, enabled && !!user?.id)
}

function getNextCursor(lastPage, pageParams) {
    const cursor = lastPage?.next_cursor
    // A cursor already in the page history cannot advance this list.
    if (lastPage?.has_more && cursor && !pageParams.includes(cursor)) return cursor
}

function useLibraryPages(queryKey, fetchPage, filters, enabled) {
    const queryClient = useQueryClient()
    const query = useInfiniteQuery({
        queryKey,
        queryFn: ({ pageParam, signal }) => fetchPage({ ...filters, cursor: pageParam, signal }),
        initialPageParam: null,
        getNextPageParam: (lastPage, _pages, _lastParam, pageParams) => getNextCursor(lastPage, pageParams),
        enabled,
    })

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
    const lastPage = data?.pages.at(-1)
    const nextCursor = query.hasNextPage ? lastPage.next_cursor : null

    const fetchNextPage = () => {
        // A refresh can change the cursor before React updates this view.
        const state = queryClient.getQueryState(queryKey)
        const latest = state?.data
        if (!nextCursor || state?.fetchStatus !== "idle" ||
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
        hasInvalidCursor: !!lastPage?.has_more && !query.hasNextPage,
        fetchNextPage,
        isFetchingNextPage: query.isFetchingNextPage,
        isFetchNextPageError: query.isFetchNextPageError,
        isRefetchError: query.isRefetchError,
        refetch: query.refetch,
    }
}
