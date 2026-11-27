import { useInfiniteQuery } from "@tanstack/react-query"
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

function useLibraryPages(queryKey, fetchPage, filters, enabled) {
    const query = useInfiniteQuery({
        queryKey,
        queryFn: ({ pageParam, signal }) => fetchPage({ ...filters, cursor: pageParam, signal }),
        initialPageParam: null,
        getNextPageParam: (lastPage) =>
            lastPage.has_more
                ? lastPage.next_cursor
                : undefined,
        enabled,
    })

    const items = query.data?.pages.flatMap(page => page.items) ?? []

    return {
        items,
        isLoading: query.isLoading,
        isError: query.isError,
        error: query.error,
        hasNextPage: query.hasNextPage,
        fetchNextPage: query.fetchNextPage,
        isFetchingNextPage: query.isFetchingNextPage,
        refetch: query.refetch,
    }
}
