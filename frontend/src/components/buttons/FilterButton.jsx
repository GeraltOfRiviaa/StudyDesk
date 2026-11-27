import { Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuGroup,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSub,
    DropdownMenuSubTrigger,
    DropdownMenuSubContent,
    DropdownMenuCheckboxItem,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

const matchModes = [
    { label: "Any selected tag", value: "any" },
    { label: "All selected tags", value: "all" },
    { label: "Exactly selected tags", value: "exact" },
    { label: "Without tags", value: "none" },
]

const sortOptions = [
    { label: "Title", value: "title" },
    { label: "Created at", value: "created_at" },
    { label: "Updated at", value: "updated_at" },
]

export function FilterButton({
    size,
    itemsMode = true,
    tags = [],
    selectedTags = [],
    match = "any",
    sort = "updated_at",
    order = "desc",
    onTagsChange,
    onMatchChange,
    onSortChange,
    onOrderChange,
    onReset,
}) {
    const toggleTag = (id) => {
        const next = selectedTags.includes(id)
            ? selectedTags.filter(tagId => tagId !== id)
            : [...selectedTags, id]

        onTagsChange?.(next)
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <Button
                        variant="outline"
                        size={size}
                        className="rounded-lg px-2"
                        aria-label="Filters"
                    >
                        <Filter />
                    </Button>
                }
            />

            <DropdownMenuContent>
                <DropdownMenuGroup>

                    {/* Tag selection */}
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger
                            disabled={!itemsMode}
                            className="data-disabled:opacity-50"
                        >
                            Tags ({selectedTags.length})
                        </DropdownMenuSubTrigger>

                        <DropdownMenuSubContent>
                            {tags.length === 0 ? (
                                <DropdownMenuItem disabled>
                                    No tags available
                                </DropdownMenuItem>
                            ) : (
                                tags.map(tag => (
                                    <DropdownMenuCheckboxItem
                                        key={tag.id}
                                        checked={selectedTags.includes(tag.id)}
                                        disabled={match === "none"}
                                        onCheckedChange={() => toggleTag(tag.id)}
                                        className="text-white"
                                    >
                                        {tag.name}
                                    </DropdownMenuCheckboxItem>
                                ))
                            )}
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    {/* Tag matching */}
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger
                            disabled={!itemsMode}
                            className="data-disabled:opacity-50"
                        >
                            Filter mode
                        </DropdownMenuSubTrigger>

                        <DropdownMenuSubContent>
                            <DropdownMenuRadioGroup
                                value={match}
                                onValueChange={onMatchChange}
                            >
                                {matchModes.map(mode => (
                                    <DropdownMenuRadioItem
                                        key={mode.value}
                                        value={mode.value}
                                    >
                                        {mode.label}
                                    </DropdownMenuRadioItem>
                                ))}
                            </DropdownMenuRadioGroup>
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    <DropdownMenuSeparator />

                    {/* Sorting field */}
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            Sort by
                        </DropdownMenuSubTrigger>

                        <DropdownMenuSubContent>
                            <DropdownMenuRadioGroup
                                value={sort}
                                onValueChange={onSortChange}
                            >
                                {sortOptions.map(option => (
                                    <DropdownMenuRadioItem
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.value === "title" && !itemsMode ? "Name" : option.label}
                                    </DropdownMenuRadioItem>
                                ))}
                            </DropdownMenuRadioGroup>
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    {/* Sorting direction */}
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            Sort order
                        </DropdownMenuSubTrigger>

                        <DropdownMenuSubContent>
                            <DropdownMenuRadioGroup
                                value={order}
                                onValueChange={onOrderChange}
                            >
                                <DropdownMenuRadioItem value="asc">
                                    Ascending
                                </DropdownMenuRadioItem>

                                <DropdownMenuRadioItem value="desc">
                                    Descending
                                </DropdownMenuRadioItem>
                            </DropdownMenuRadioGroup>
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                        className="text-destructive"
                        onClick={onReset}
                    >
                        Reset filters
                    </DropdownMenuItem>

                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
