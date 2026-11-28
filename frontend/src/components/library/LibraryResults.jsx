import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { TagRow } from "@/components/tags/TagRows"
import { useLibraryInfiniteScroll } from "@/hooks/useLibraryInfiniteScroll"
import { LibraryRow } from "./LibraryRow"

function LoadingRows({ itemsMode, count, label }) {
    const columns = itemsMode
        ? "grid-cols-[minmax(0,1fr)_7rem] md:grid-cols-[minmax(0,1fr)_11rem_7rem] lg:grid-cols-[minmax(0,1fr)_14rem_8rem_8rem]"
        : "grid-cols-[minmax(0,1fr)] sm:grid-cols-[minmax(0,1fr)_7rem] md:grid-cols-[minmax(0,1fr)_8rem_8rem]"

    return (
        // Keep the absolute screen-reader label inside the scroll area to avoid a document scrollbar.
        <div role="status" className="relative">
            <span className="sr-only">{label}</span>
            {Array.from({ length: count }, (_, index) => (
                <div
                    key={index}
                    aria-hidden="true"
                    className={`grid min-h-9 items-center gap-2 border-b px-2 ${columns}`}
                >
                    <div className="flex min-w-0 items-center gap-2">
                        <Skeleton className="size-4 shrink-0" />
                        {!itemsMode && <Skeleton className="size-3 shrink-0 rounded-full" />}
                        <Skeleton className="h-4 w-3/4 max-w-40" />
                    </div>
                    {itemsMode && <Skeleton className="h-4 w-16 rounded-full" />}
                    <Skeleton className={`hidden h-4 w-16 ${itemsMode ? "md:block" : "sm:block"}`} />
                    <Skeleton className={`hidden h-4 w-16 ${itemsMode ? "lg:block" : "md:block"}`} />
                </div>
            ))}
        </div>
    )
}

function ResultsError({ message, onRetry, retrying, action = "Retry" }) {
    return (
        <div className="flex flex-col items-center gap-2 px-3 py-4 text-center">
            <p role="status" className="text-sm">{message}</p>
            <Button type="button" size="sm" variant="outline" disabled={retrying} onClick={onRetry}>
                {action}
            </Button>
        </div>
    )
}

export function LibraryResults({
    itemsMode, query, rows, itemTags, selected, onToggle,
    initialLoading, initialError, initialRetrying, onInitialRetry, onReload, restricted, onReset,
}) {
    const noun = itemsMode ? "items" : "tags"
    const busy = query.fetchStatus !== "idle"
    const { scrollRef, sentinelRef, wasRequested } = useLibraryInfiniteScroll({
        enabled: !initialLoading && !initialError && !busy && query.isSuccess,
        cursor: query.nextCursor,
        fetchNextPage: query.fetchNextPage,
    })
    const retryPage = !!query.nextCursor && (query.isFetchNextPageError || wasRequested)
    const empty = !rows.length && query.isSuccess && !query.nextCursor && !query.hasInvalidCursor
    const refresh = () => query.refetch({ cancelRefetch: false })

    return (
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
            {initialLoading ? (
                <LoadingRows itemsMode={itemsMode} count={6} label={`Loading ${noun}`} />
            ) : initialError ? (
                <ResultsError message={`Could not load Library ${noun}.`} onRetry={onInitialRetry} retrying={initialRetrying} />
            ) : empty ? (
                <div className="flex min-h-full flex-col items-center justify-center gap-2 p-4 text-center">
                    <p className="font-medium">{restricted
                        ? `No ${noun} match your search or filters.`
                        : itemsMode ? "Your Library is empty." : "You don’t have any tags yet."}</p>
                    {restricted ? (
                        <Button type="button" size="sm" variant="outline" onClick={onReset}>Reset filters</Button>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            Use the Add button to create your first {itemsMode ? "note" : "tag"}.
                        </p>
                    )}
                </div>
            ) : (
                <>
                    {itemsMode ? rows.map(item => (
                        <LibraryRow key={`${item.type}:${item.id}`} item={item} tags={itemTags} selected={selected} onToggle={onToggle} />
                    )) : rows.map(tag => (
                        <TagRow key={tag.id} tag={tag} selected={selected} onToggle={onToggle} />
                    ))}

                    {query.isFetchingNextPage ? (
                        <LoadingRows itemsMode={itemsMode} count={2} label={`Loading more ${noun}`} />
                    ) : query.hasInvalidCursor ? (
                        <ResultsError message={`Could not continue loading ${noun}.`} onRetry={onReload} retrying={busy} action="Reload results" />
                    ) : query.isRefetchError ? (
                        <ResultsError message={`Could not refresh Library ${noun}.`} onRetry={refresh} retrying={busy} />
                    ) : retryPage ? (
                        <ResultsError
                            message={query.isFetchNextPageError ? `Could not load more ${noun}.` : `More ${noun} are available.`}
                            onRetry={query.fetchNextPage}
                            retrying={busy}
                        />
                    ) : query.isSuccess && rows.length > 0 && !query.nextCursor ? (
                        <p className="px-3 py-3 text-center text-xs text-muted-foreground">All {noun} loaded</p>
                    ) : null}

                    {query.nextCursor && !retryPage && <div ref={sentinelRef} aria-hidden="true" className="h-px" />}
                </>
            )}
        </div>
    )
}
