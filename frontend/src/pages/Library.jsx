import { Search } from "@/components/searches/Search"
import { BulkActionsButton } from "@/components/buttons/BulkActionsButton"
import { ItemTypesButton } from "@/components/buttons/ItemTypesButton"
import { Switch } from "@/components/ui/switch"
import { FilterButton } from "@/components/buttons/FilterButton"
import { AddItemButton } from "@/components/buttons/AddItemsButton"
import { Spinner } from "@/components/ui/spinner"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { LibraryRow } from "@/components/library/LibraryRow"
import { TagRow } from "@/components/tags/TagRows"

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

function Library() {
    const [selected, setSelected] = useState(new Set())
    const [itemsMode, setItemsMode] = useState(true)

    const { user } = useUser()
    const { itemsRevision, openItem } = useItemModal()
    const queryClient = useQueryClient()

    // Read filters from URL
    const { filters, setFilter, resetFilters } = useLibraryFilters()

    // Update the URL immediately, but debounce the API search
    const debouncedSearch = useDebounce(filters.q, 300)
    const isSearchPending = filters.q !== debouncedSearch

    const handleFilterChange = (key, value) => {
        setSelected(new Set())
        setFilter(key, value)
    }

    const handleResetFilters = () => {
        setSelected(new Set())
        resetFilters({ preserveItemFilters: !itemsMode })
    }

    const itemsQuery = useLibrary({
        ...filters,
        q: debouncedSearch,
        tags: filters.match === "none" ? [] : filters.tags,
    }, itemsMode)

    const tagSort = ["title", "created_at", "updated_at"].includes(filters.sort)
        ? filters.sort
        : "updated_at"
    const libraryTagsQuery = useLibraryTags({
        q: debouncedSearch.trim(),
        sort: tagSort === "title" ? "name" : tagSort,
        order: filters.order,
    }, !itemsMode)

    const pickerTagsQuery = useQuery({
        queryKey: ["tags", user?.id],
        queryFn: ({ signal }) => api("/tags/", { signal }),
        enabled: itemsMode && !!user?.id,
    })

    const pickerTags = pickerTagsQuery.data ?? []
    const listedTagIds = new Set(pickerTags.map(tag => tag.id))
    const missingItemTagIds = itemsMode && pickerTagsQuery.isSuccess
        ? itemsQuery.items.flatMap(item => item.tags ?? [])
            .filter(id => !listedTagIds.has(id))
        : []
    const extraTags = useTagLookup(missingItemTagIds)
    const itemTags = [...pickerTags, ...extraTags]

    const {
        items: displayedItems,
        isLoading,
        error,
        hasNextPage,
        fetchNextPage,
        isFetchingNextPage,
        refetch,
    } = itemsMode ? itemsQuery : libraryTagsQuery
    const loading = isSearchPending || isLoading || (itemsMode && pickerTagsQuery.isLoading)
    const displayError = error || (itemsMode && pickerTagsQuery.error)

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

    // Toggle individual item selection
    const toggle = (type, id) => {
        const key = `${type}:${id}`

        setSelected(prev => {
            const next = new Set(prev)

            next.has(key)
                ? next.delete(key)
                : next.add(key)

            return next
        })
    }

    // Generate selection keys for currently displayed items
    const displayedKeys = displayedItems.map(item =>
        `${itemsMode ? item.type : "tag"}:${item.id}`
    )

    const allSelected =
        displayedKeys.length > 0 &&
        displayedKeys.every(key => selected.has(key))

    const someSelected =
        displayedKeys.some(key => selected.has(key)) &&
        !allSelected

    // Select or deselect all currently loaded items
    const toggleAll = () => {
        setSelected(prev => {
            const next = new Set(prev)

            displayedKeys.forEach(key => {
                allSelected
                    ? next.delete(key)
                    : next.add(key)
            })

            return next
        })
    }

    // Refresh data after bulk deletion
    const handleDeleted = async () => {
        setSelected(new Set())

        await Promise.all([
            queryClient.invalidateQueries({
                queryKey: ["library", user?.id],
            }),
            queryClient.invalidateQueries({
                queryKey: ["tags", user?.id],
            }),
        ])
    }

    // Switch between items and tags
    const handleLibrarySwitch = () => {
        setSelected(new Set())
        setItemsMode(prev => !prev)
    }

    // Convert selection keys into objects for bulk actions
    const selectedItems = displayedKeys.filter(key => selected.has(key)).map(key => {
        const [type, id] = key.split(":")
        return { type, id }
    })

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
                    onChange={value => handleFilterChange("q", value)}
                    placeholder={itemsMode ? "Search by title..." : "Search by name..."}
                    maxLength={150}
                />

                <div className="flex flex-row justify-between">
                    <div className="flex flex-row gap-2 my-auto">
                        <BulkActionsButton
                            size="sm"
                            itemsMode={itemsMode}
                            selected={loading || displayError ? [] : selectedItems}
                            onDeleted={handleDeleted}
                        />

                        <ItemTypesButton
                            size="sm"
                            disabled={!itemsMode}
                            value={filters.collections}
                            onChange={value => handleFilterChange("collections", value)}
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
                        onTagsChange={value => handleFilterChange("tags", value)}
                        onMatchChange={value => handleFilterChange("match", value)}
                        onSortChange={value => handleFilterChange("sort", value)}
                        onOrderChange={value => handleFilterChange("order", value)}
                        onReset={handleResetFilters}
                    />
                </div>
            </div>

            {/* Library table */}
            <div className="flex-1 min-h-0 flex flex-col border rounded-md overflow-hidden">

                {/* Header */}
                {itemsMode ? (
                    <div className="grid grid-cols-[minmax(0,1fr)_7rem] md:grid-cols-[minmax(0,1fr)_11rem_7rem] lg:grid-cols-[minmax(0,1fr)_14rem_8rem_8rem] items-center gap-2 px-2 h-10 shrink-0 bg-card border-b">
                        <div className="flex min-w-0 items-center gap-2">
                            <Checkbox
                                checked={allSelected}
                                indeterminate={someSelected}
                                disabled={loading || !!displayError}
                                onCheckedChange={toggleAll}
                            />
                            <p className="text-lg">Title</p>
                        </div>

                        <p>Tags</p>
                        <p className="hidden md:block">Created at</p>
                        <p className="hidden lg:block">Updated at</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-[minmax(0,1fr)] sm:grid-cols-[minmax(0,1fr)_7rem] md:grid-cols-[minmax(0,1fr)_8rem_8rem] items-center gap-2 px-2 h-10 shrink-0 bg-card border-b">
                        <div className="flex min-w-0 items-center gap-2">
                            <Checkbox
                                checked={allSelected}
                                indeterminate={someSelected}
                                disabled={loading || !!displayError}
                                onCheckedChange={toggleAll}
                            />
                            <p className="text-lg">Name</p>
                        </div>

                        <p className="hidden sm:block">Created at</p>
                        <p className="hidden md:block">Updated at</p>
                    </div>
                )}

                {/* Scrollable body */}
                <div className="flex-1 min-h-0 overflow-y-auto">
                    {loading ? (
                        <div className="flex h-full items-center justify-center p-4">
                            <Spinner />
                        </div>
                    ) : displayError ? (
                        <div className="flex flex-col items-center gap-2 p-4">
                            <p>Could not fetch Library data.</p>

                            <Button
                                variant="outline"
                                onClick={() => {
                                    refetch()
                                    if (itemsMode) pickerTagsQuery.refetch()
                                }}
                            >
                                Retry
                            </Button>
                        </div>
                    ) : displayedItems.length === 0 ? (
                        <div className="flex h-full flex-col items-center justify-center p-4 text-center">
                            <p>{itemsMode ? "No items found." : "No tags found."}</p>
                        </div>
                    ) : itemsMode ? (
                        displayedItems.map(item => (
                            <LibraryRow
                                key={`${item.type}:${item.id}`}
                                item={item}
                                tags={itemTags}
                                selected={selected}
                                onToggle={toggle}
                            />
                        ))
                    ) : (
                        displayedItems.map(tag => (
                            <TagRow
                                key={tag.id}
                                tag={tag}
                                selected={selected}
                                onToggle={toggle}
                            />
                        ))
                    )}

                    {hasNextPage && !loading && !displayError && (
                        <div className="flex justify-center p-4">
                            <Button
                                variant="outline"
                                disabled={isFetchingNextPage}
                                onClick={() => fetchNextPage()}
                            >
                                {isFetchingNextPage
                                    ? "Loading..."
                                    : "Load more"}
                            </Button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center gap-2 px-2 h-14 shrink-0 bg-card justify-between">
                    <div className="flex flex-row gap-2 items-center px-2">
                        <p>Items</p>

                        <Switch
                            checked={!itemsMode}
                            onCheckedChange={handleLibrarySwitch}
                        />

                        <p>Tags</p>
                    </div>

                    <AddItemButton
                        size="sm"
                        onSelectType={type => openItem(type, null, "create")}
                        items={itemsMode ? itemCreateOptions : tagCreateOptions}
                    />
                </div>
            </div>
        </div>
    )
}

export { Library }
