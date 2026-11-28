import { Filter } from "lucide-react"
import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { TagSelector } from "@/components/tags/TagSelector"
import {
    DropdownMenu,
    DropdownMenuGroup,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSub,
    DropdownMenuSubTrigger,
    DropdownMenuSubContent,
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
    const [tagPickerOpen, setTagPickerOpen] = useState(false)
    const filterButton = useRef(null)

    return (
        <>
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <Button
                        variant="outline"
                        size={size}
                        className="rounded-lg px-2"
                        aria-label="Filters"
                        ref={filterButton}
                    >
                        <Filter />
                    </Button>
                }
            />

            <DropdownMenuContent>
                <DropdownMenuGroup>

                    <DropdownMenuItem disabled={!itemsMode || match === "none"} onClick={() => setTagPickerOpen(true)}>
                        Tags ({selectedTags.length})
                    </DropdownMenuItem>

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
        {tagPickerOpen && (
            <Dialog open onOpenChange={setTagPickerOpen}>
                <DialogContent className="max-h-[90dvh] overflow-y-auto" finalFocus={filterButton}>
                    <DialogTitle>Filter by tags</DialogTitle>
                    <DialogDescription>Tag selections apply to the Library immediately.</DialogDescription>
                    <TagSelector value={selectedTags} onChange={onTagsChange} allowCreate={false} />
                </DialogContent>
            </Dialog>
        )}
        </>
    )
}
