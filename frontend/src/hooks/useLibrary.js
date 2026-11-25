import { useInfiniteQuery } from "@tanstack/react-query"
import { useUser } from "@/context/AuthContext"
import { fetchLibrary } from "@/api/libraryApi"

export function useLibrary(filters = {}) {
    const { user } = useUser()

    const query = useInfiniteQuery({
        queryKey: ["library", user?.id, filters],

        //calls function to retrieve items
        queryFn: ({ pageParam, signal }) =>
            fetchLibrary({
                ...filters,
                cursor: pageParam,
                signal,
            }),

        //start fetching without cursor
        initialPageParam: null,

        //gets the next cursor from the backend response.
        getNextPageParam: (lastPage) =>
            lastPage.has_more
                ? lastPage.next_cursor
                : undefined,
        //do not fetch if user not authenticated
        enabled: !!user?.id,
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