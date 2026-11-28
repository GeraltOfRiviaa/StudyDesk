import { Search } from "@/components/searches/Search"
import { BulkActionsButton } from "@/components/buttons/BulkActionsButton"
import { ItemTypesButton } from "@/components/buttons/ItemTypesButton"
import { Switch } from "@/components/ui/switch"
import { FilterButton } from "@/components/buttons/FilterButton"
import { AddItemButton } from "@/components/buttons/AddItemsButton"
import { Checkbox } from "@/components/ui/checkbox"
import { LibraryResults } from "@/components/library/LibraryResults"

import { useEffect, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/api/client"
import { useUser } from "@/context/AuthContext"
import { useItemModal } from "@/context/ItemsModalContext"
import { useLibraryFilters } from "@/hooks/useLibraryFilters"
import { useLibrary, useLibraryTags } from "@/hooks/useLibrary"
import { useDebounce } from "@/hooks/useDebounce"
import { useTagLookup } from "@/hooks/useTagLookup"
import { ITEM_TYPES } from "@/lib/itemTypes"

const itemCreateOptions = Object.values(ITEM_TYPES).map(({ type, label }) => ({
    type,
    label,
    disabled: type !== ITEM_TYPES.note.type,
}))

const tagCreateOptions = [{ type: "tag", label: "Tag" }]

const getRowKey = ({ type = "tag", id }) => `${type}:${id}`

function emptySelection(viewKey) {
    return { viewKey, keys: new Set(), autoSelect: false, lastRows: null, lastLoadedKeys: new Set() }
}

function hasRestrictiveFilters(filters, itemsMode) {
    if (!itemsMode) return !!filters.q.trim()

    // The API treats an empty list, "all", and all four collections as the same scope.
    const restrictsType = filters.collections.length > 0 && !filters.collections.includes("all")
        && Object.values(ITEM_TYPES).some(({ collection }) => !filters.collections.includes(collection))
    return !!filters.q || restrictsType || filters.match === "none" || filters.tags.length > 0
}

function Library() {
    const [itemsMode, setItemsMode] = useState(true)
    const [unavailableKeys, setUnavailableKeys] = useState(() => new Set())

    const { user } = useUser()
    const { itemsRevision, openItem } = useItemModal()
    const queryClient = useQueryClient()

    // Read filters from URL
    const { filters, setFilter, resetFilters } = useLibraryFilters()
    const viewKey = JSON.stringify([user?.id, itemsMode, filters])
    const [selection, setSelection] = useState(() => emptySelection(viewKey))
    const selected = selection.keys

    // Update the URL immediately, but debounce the API search
    const debouncedSearch = useDebounce(filters.q, 300)
    const isSearchPending = filters.q !== debouncedSearch

    const handleResetFilters = () => resetFilters({ preserveItemFilters: !itemsMode })

    const itemsQuery = useLibrary({
        ...filters,
        q: debouncedSearch,
        tags: filters.match === "none" ? [] : filters.tags,
    }, itemsMode && !isSearchPending)

    const tagSort = ["title", "created_at", "updated_at"].includes(filters.sort)
        ? filters.sort
        : "updated_at"
    const libraryTagsQuery = useLibraryTags({
        q: debouncedSearch.trim(),
        sort: tagSort === "title" ? "name" : tagSort,
        order: filters.order,
    }, !itemsMode && !isSearchPending)

    const pickerTagsQuery = useQuery({
        queryKey: ["tags", user?.id],
        queryFn: ({ signal }) => api("/tags/", { signal }),
        enabled: itemsMode && !!user?.id,
    })

    const pickerTags = pickerTagsQuery.data ?? []
    const listedTagIds = new Set(pickerTags.map(tag => tag.id))
    const missingItemTagIds = itemsMode && pickerTagsQuery.data !== undefined
        ? itemsQuery.items.flatMap(item => item.tags ?? [])
            .filter(id => !listedTagIds.has(id))
        : []
    const extraTags = useTagLookup(missingItemTagIds)
    const itemTags = [...pickerTags, ...extraTags]

    const activeQuery = itemsMode ? itemsQuery : libraryTagsQuery
    const pickerMissing = itemsMode && pickerTagsQuery.data === undefined
    const pickerFailed = pickerMissing && pickerTagsQuery.isError
    const listFailed = activeQuery.isError && activeQuery.items.length === 0
    const initialError = !isSearchPending && (listFailed || pickerFailed)
    const initialLoading = isSearchPending || (!initialError && (!activeQuery.hasData || pickerMissing))
    const displayedItems = initialLoading || initialError ? [] :
        activeQuery.items.filter(item => !unavailableKeys.has(getRowKey(item)))

    const retryInitialLoad = () => {
        if (listFailed) void activeQuery.refetch({ cancelRefetch: false })
        if (pickerFailed) void pickerTagsQuery.refetch({ cancelRefetch: false })
    }

    // Refresh cached data when an item changes
    useEffect(() => {
        if (!itemsRevision) return

        queryClient.invalidateQueries({
            queryKey: ["library", user?.id],
        })

        queryClient.invalidateQueries({
            queryKey: ["tags", user?.id],
        })
    }, [itemsRevision, queryClient, user?.id])

    const toggle = (type, id) => {
        const key = getRowKey({ type, id })

        setSelection(previous => {
            const keys = new Set(previous.keys)
            // Removing a row turns off automatic selection and keeps the rest selected.
            if (keys.delete(key)) return { ...previous, keys, autoSelect: false }
            keys.add(key)
            return { ...previous, keys }
        })
    }

    const displayedKeys = displayedItems.map(getRowKey)
    const selectedKeys = displayedKeys.filter(key => selected.has(key))

    // The URL also changes through navigation, so clear selection before rendering a new view.
    if (selection.viewKey !== viewKey) {
        setSelection(emptySelection(viewKey))
    } else if (!initialLoading && !initialError && activeQuery.isSuccess &&
        activeQuery.fetchStatus === "idle" && selection.lastRows !== activeQuery.items) {
        // Reconcile only successful results. The previous rows distinguish new arrivals from existing ones.
        const keys = new Set(displayedKeys.filter(key => selected.has(key) ||
            (selection.autoSelect && !selection.lastLoadedKeys.has(key))))
        setSelection({ ...selection, keys, lastRows: activeQuery.items, lastLoadedKeys: new Set(displayedKeys) })
    }

    const allSelected = displayedKeys.length > 0 && selectedKeys.length === displayedKeys.length
    const someSelected = selectedKeys.length > 0 && !allSelected

    const toggleAll = () => {
        setSelection(previous => ({
            ...previous,
            keys: new Set(allSelected ? [] : displayedKeys),
            autoSelect: !allSelected,
            lastLoadedKeys: new Set(displayedKeys),
        }))
    }

    // Clear confirmed deletions here. The bulk dialog owns its separate retry snapshot.
    const handleDeleteSettled = async (completedItems) => {
        if (completedItems.length) {
            const completedKeys = new Set(completedItems.map(getRowKey))
            setSelection(previous => ({
                ...previous,
                keys: new Set([...previous.keys].filter(key => !completedKeys.has(key))),
            }))
            // A cached page can still show a deleted row even after the deletion request succeeds.
            setUnavailableKeys(previous => new Set([...previous, ...completedKeys]))
        }

        await Promise.all([
            queryClient.invalidateQueries({
                queryKey: ["library", user?.id],
            }),
            queryClient.invalidateQueries({
                queryKey: ["tags", user?.id],
            }),
        ])
    }

    // Convert selection keys into objects for bulk actions
    const selectedItems = selectedKeys.map(key => {
        const [type, id] = key.split(":")
        return { type, id }
    })
    const selectAll = (
        <Checkbox
            aria-label={itemsMode ? "Select all loaded items" : "Select all loaded tags"}
            checked={allSelected}
            indeterminate={someSelected}
            disabled={displayedItems.length === 0}
            onCheckedChange={toggleAll}
        />
    )

    return (
        <div
            id="library-mobile"
            className="flex flex-col h-full overflow-hidden px-4 gap-2 mx-auto md:max-w-200 lg:max-w-250"
        >
            {/* Library controls */}
            <div className="shrink-0 flex flex-col gap-2">
                <h1 className="font-bold text-4xl pb-2 text-center">
                    Library
                </h1>

                <Search
                    value={filters.q}
                    onChange={value => setFilter("q", value)}
                    placeholder={itemsMode ? "Search by title..." : "Search by name..."}
                    maxLength={150}
                />

                <div className="flex flex-wrap justify-between gap-2">
                    <div className="my-auto flex flex-wrap gap-2">
                        <BulkActionsButton
                            size="sm"
                            itemsMode={itemsMode}
                            selected={selectedItems}
                            onDeleteSettled={handleDeleteSettled}
                        />

                        <ItemTypesButton
                            size="sm"
                            disabled={!itemsMode}
                            value={filters.collections}
                            onChange={value => setFilter("collections", value)}
                        />
                    </div>

                    <FilterButton
                        size="sm"
                        itemsMode={itemsMode}
                        tags={pickerTags}
                        selectedTags={filters.match === "none" ? [] : filters.tags}
                        match={filters.match}
                        sort={itemsMode ? filters.sort : tagSort}
                        order={filters.order}
                        onTagsChange={value => setFilter("tags", value)}
                        onMatchChange={value => setFilter("match", value)}
                        onSortChange={value => setFilter("sort", value)}
                        onOrderChange={value => setFilter("order", value)}
                        onReset={handleResetFilters}
                    />
                </div>
            </div>

            {/* Library table */}
            <div className="flex-1 min-h-0 flex flex-col border rounded-md overflow-hidden">

                {/* Header */}
                {itemsMode ? (
                    <div className="grid grid-cols-[minmax(0,1fr)_7rem] md:grid-cols-[minmax(0,1fr)_11rem_7rem] lg:grid-cols-[minmax(0,1fr)_14rem_8rem_8rem] items-center gap-2 px-2 h-10 shrink-0 bg-card border-b overflow-y-hidden [scrollbar-gutter:stable]">
                        <div className="flex min-w-0 items-center gap-2">
                            {selectAll}
                            <p className="text-lg">Title</p>
                        </div>

                        <p>Tags</p>
                        <p className="hidden md:block">Created at</p>
                        <p className="hidden lg:block">Updated at</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-[minmax(0,1fr)] sm:grid-cols-[minmax(0,1fr)_7rem] md:grid-cols-[minmax(0,1fr)_8rem_8rem] items-center gap-2 px-2 h-10 shrink-0 bg-card border-b overflow-y-hidden [scrollbar-gutter:stable]">
                        <div className="flex min-w-0 items-center gap-2">
                            {selectAll}
                            <p className="text-lg">Name</p>
                        </div>

                        <p className="hidden sm:block">Created at</p>
                        <p className="hidden md:block">Updated at</p>
                    </div>
                )}

                {/* A new view gets its own scroll position and observer cursor history. */}
                <LibraryResults
                    key={viewKey}
                    itemsMode={itemsMode}
                    query={activeQuery}
                    rows={displayedItems}
                    itemTags={itemTags}
                    selected={selected}
                    onToggle={toggle}
                    initialLoading={initialLoading}
                    initialError={initialError}
                    initialRetrying={(listFailed && activeQuery.fetchStatus !== "idle") ||
                        (pickerFailed && pickerTagsQuery.fetchStatus !== "idle")}
                    onInitialRetry={retryInitialLoad}
                    restricted={hasRestrictiveFilters(filters, itemsMode)}
                    onReset={handleResetFilters}
                />

                {/* Footer */}
                <div className="grid min-h-14 shrink-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1 border-t bg-card px-2 py-2 min-[400px]:grid-cols-[auto_minmax(0,1fr)_auto]">
                    <div className="flex shrink-0 items-center gap-2">
                        <p>Items</p>

                        <Switch
                            aria-label="Show tags"
                            checked={!itemsMode}
                            onCheckedChange={checked => setItemsMode(!checked)}
                        />

                        <p>Tags</p>
                    </div>

                    <p role="status" className="min-w-0 text-center text-xs tabular-nums text-muted-foreground sm:text-sm">
                        {selectedKeys.length} selected · {displayedItems.length} loaded
                    </p>

                    <div className="col-span-full justify-self-center min-[400px]:col-auto min-[400px]:justify-self-end">
                        <AddItemButton
                            size="sm"
                            onSelectType={type => openItem(type, null, "create")}
                            items={itemsMode ? itemCreateOptions : tagCreateOptions}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}

export { Library }
