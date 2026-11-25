import { Search } from "@/components/ui/searches/search"
import { BulkActionsButton } from "@/components/buttons/BulkActionsButton"
import { ItemTypesButton } from "@/components/buttons/ItemTypesButton"
import { Switch } from "@/components/ui/switch"
import { FilterButton } from "@/components/buttons/FilterButton"
import { AddItemButton } from "@/components/buttons/AddItemsButton"
import { Spinner } from "@/components/ui/spinner"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { NoteRow } from "@/components/notes/NoteRow"
import { TagRow } from "@/components/tags/TagRows"

import { useEffect, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/api/client"
import { useUser } from "@/context/AuthContext"
import { useItemModal } from "@/context/ItemsModalContext"
import { useLibraryFilters } from "@/hooks/useLibraryFilters"
import { useLibrary } from "@/hooks/useLibrary"

function Library() {
    const [selected, setSelected] = useState(new Set())
    const [itemsMode, setItemsMode] = useState(true)

    const { user } = useUser()
    const { itemsRevision, openItem } = useItemModal()
    const queryClient = useQueryClient()

    // Read filters from URL
    const { filters, setFilter, resetFilters } = useLibraryFilters()

    // Fetch Library items
    const {
        items,
        isLoading,
        isError,
        error,
        hasNextPage,
        fetchNextPage,
        isFetchingNextPage,
        refetch,
    } = useLibrary(filters)

    // Fetch tags separately
    const tagsQuery = useQuery({
        queryKey: ["tags", user?.id],
        queryFn: ({ signal }) => api("/tags/", { signal }),
        enabled: !!user?.id,
    })

    const tags = tagsQuery.data ?? []

    // Determine which data should currently be displayed
    const displayedItems = itemsMode ? items : tags
    const loading = itemsMode
        ? isLoading || tagsQuery.isLoading
        : tagsQuery.isLoading

    const displayError = itemsMode
        ? error || tagsQuery.error
        : tagsQuery.error

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

    // Update tags stored in the query cache
    const handleTagUpdated = (updatedTag) => {
        queryClient.setQueryData(
            ["tags", user?.id],
            prev => prev?.map(tag =>
                tag.id === updatedTag.id
                    ? { ...tag, ...updatedTag }
                    : tag
            )
        )
    }

    // Switch between items and tags
    const handleLibrarySwitch = () => {
        setSelected(new Set())
        setItemsMode(prev => !prev)
    }

    // Convert selection keys into objects for bulk deletion
    const selectedItems = [...selected].map(key => {
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

                <Search />

                <div className="flex flex-row justify-between">
                    <div className="flex flex-row gap-2 my-auto">
                        <BulkActionsButton
                            type="button"
                            size="sm"
                            selected={selectedItems}
                            onDeleted={handleDeleted}
                        />

                        <ItemTypesButton size="sm" />
                    </div>

                    <FilterButton size="sm" />
                </div>
            </div>

            {/* Library table */}
            <div className="flex-1 min-h-0 flex flex-col border rounded-md overflow-hidden">

                {/* Header */}
                {itemsMode ? (
                    <div className="grid grid-cols-[minmax(0,1fr)_7rem] md:grid-cols-[minmax(0,1fr)_11rem_7rem] lg:grid-cols-[minmax(0,1fr)_14rem_8rem_8rem] items-center gap-2 px-2 h-10 shrink-0 bg-card border-b">
                        <div className="flex min-w-0 items-center gap-2">
                            <Checkbox
                                checked={someSelected ? "indeterminate" : allSelected}
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
                                checked={someSelected ? "indeterminate" : allSelected}
                                onCheckedChange={toggleAll}
                            />
                            <p className="text-lg">Title</p>
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
                                    if (itemsMode) refetch()
                                    tagsQuery.refetch()
                                }}
                            >
                                Retry
                            </Button>
                        </div>
                    ) : displayedItems.length === 0 ? (
                        <div className="flex h-full flex-col items-center justify-center p-4 text-center">
                            <p>No items found.</p>
                        </div>
                    ) : itemsMode ? (
                        items.map(item =>
                            item.type === "note" ? (
                                <NoteRow
                                    key={`${item.type}:${item.id}`}
                                    note={item}
                                    tags={tags}
                                    selected={selected}
                                    onToggle={toggle}
                                />
                            ) : (
                                <div
                                    key={`${item.type}:${item.id}`}
                                    className="flex items-center gap-2 p-2 border-b"
                                >
                                    <Checkbox
                                        checked={selected.has(`${item.type}:${item.id}`)}
                                        onCheckedChange={() => toggle(item.type, item.id)}
                                    />

                                    <button
                                        className="text-left truncate"
                                        onClick={() => openItem(item.type, item.id)}
                                    >
                                        {item.title}
                                    </button>
                                </div>
                            )
                        )
                    ) : (
                        tags.map(tag => (
                            <TagRow
                                key={tag.id}
                                tag={tag}
                                selected={selected}
                                onToggle={toggle}
                                onUpdated={handleTagUpdated}
                                onFetchNewTags={tagsQuery.refetch}
                            />
                        ))
                    )}

                    {/* Temporary pagination control */}
                    {itemsMode && hasNextPage && !displayError && (
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
                        onSelectType={type =>
                            openItem(type.toLowerCase(), null, "create")
                        }
                        items={itemsMode
                            ? ["Note", "File", "Form", "Event"]
                            : ["Tag"]}
                    />
                </div>
            </div>
        </div>
    )
}

export { Library }