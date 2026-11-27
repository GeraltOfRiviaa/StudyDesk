import { useRef, useState } from "react"
import { ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    DropdownMenu,
    DropdownMenuGroup,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { BulkSetTagsModal } from "@/components/library/BulkSetTagsModal"
import { useBulkDelete } from "@/hooks/useBulkDelete"
import { useBulkRemoveLinks } from "@/hooks/useBulkRemoveLinks"
import { useBulkSetTags } from "@/hooks/useBulkSetTags"
import { useBulkUnlinkTags } from "@/hooks/useBulkUnlinkTags"

export function BulkActionsButton({ size, selected, itemsMode, onDeleted }) {
    const [action, setAction] = useState(null)
    const submitting = useRef(false)
    const { bulkDelete, isDeleting } = useBulkDelete()
    const setTags = useBulkSetTags()
    const unlinkTags = useBulkUnlinkTags()
    const removeLinks = useBulkRemoveLinks()
    const isPending = isDeleting || setTags.isPending || unlinkTags.isPending || removeLinks.isPending

    const itemActionsDisabled = !itemsMode || !selected.length || isPending

    const confirmations = {
        unlinkTags: {
            title: "Unlink tags",
            description: count => `Clear all tags from ${count}. The tags will still be available in the Library.`,
            submit: unlinkTags.mutateAsync,
        },
        removeLinks: {
            title: "Remove links",
            description: count => `Remove every link involving ${count}. The linked items will stay in the Library.`,
            submit: removeLinks.mutateAsync,
        },
        delete: {
            title: "Delete",
            description: count => `Permanently delete ${count}?`,
            submit: async ({ items }) => {
                const results = await bulkDelete(items)
                await onDeleted?.(results)
            },
        },
    }

    const confirmation = confirmations[action?.kind]
    const itemCount = action?.items.length ?? 0
    const noun = !itemsMode ? "tag" : "item"
    const selection = `${itemCount} selected ${noun}${itemCount === 1 ? "" : "s"}`

    const openAction = kind => setAction({ kind, items: selected })
    const closeAction = () => {
        if (!submitting.current) setAction(null)
    }

    async function submitAction(submit, tags) {
        if (!itemCount || submitting.current) return

        submitting.current = true
        try {
            await submit({ items: action.items, tags })
            setAction(null)
        } catch (error) {
            if (error.completed) {
                // Retry only the items outside the completed batches.
                setAction({ ...action, items: action.items.slice(error.completed) })
            }
            if (action.kind === "delete") console.error("Bulk deletion failed:", error)
        } finally {
            submitting.current = false
        }
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger
                    disabled={!selected.length || isPending}
                    render={
                        <Button variant="outline" size={size} className="rounded-lg px-2">
                            <ChevronDown data-icon="inline-start" />
                            Bulk actions
                        </Button>
                    }
                />
                <DropdownMenuContent>
                    <DropdownMenuGroup>
                        <DropdownMenuItem disabled={itemActionsDisabled} onClick={() => openAction("setTags")}>
                            Set tags
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled={itemActionsDisabled} onClick={() => openAction("unlinkTags")}>
                            Unlink tags
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled={itemActionsDisabled} onClick={() => openAction("removeLinks")}>
                            Remove links
                        </DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onClick={() => openAction("delete")}>
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuGroup>
                </DropdownMenuContent>
            </DropdownMenu>

            {action?.kind === "setTags" && (
                <BulkSetTagsModal
                    itemCount={itemCount}
                    isPending={isPending}
                    onApply={tags => submitAction(setTags.mutateAsync, tags)}
                    onClose={closeAction}
                />
            )}

            {/* This generates the warning*/}
            {confirmation && (
                <Dialog open onOpenChange={open => { if (!open) closeAction() }}>
                    <DialogContent showCloseButton={!isPending}>
                        <DialogHeader>
                            <DialogTitle>{confirmation.title}</DialogTitle>
                            <DialogDescription>{confirmation.description(selection)}</DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button type="button" variant="outline" disabled={isPending} onClick={closeAction}>
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                variant="destructive"
                                disabled={isPending}
                                onClick={() => submitAction(confirmation.submit)}
                            >
                                {isPending ? "Working…" : confirmation.title}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </>
    )
}
