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
import { bulkErrorDescription, bulkTargetKey } from "@/api/bulkApi"
import { useUser } from "@/context/AuthContext"

export function BulkActionsButton({ size, selected, itemsMode, onDeleteSettled }) {
    const { session } = useUser()
    const [action, setAction] = useState(null)
    const submitting = useRef(false)
    const bulkDelete = useBulkDelete(onDeleteSettled)
    const setTags = useBulkSetTags()
    const unlinkTags = useBulkUnlinkTags()
    const removeLinks = useBulkRemoveLinks()
    const isPending = bulkDelete.isPending || setTags.isPending || unlinkTags.isPending || removeLinks.isPending

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
            submit: bulkDelete.mutateAsync,
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
        if (!itemCount || submitting.current || session.signal.aborted) return

        submitting.current = true
        try {
            await submit({ items: action.items, tags })
            if (!session.signal.aborted) setAction(null)
        } catch (error) {
            if (session.signal.aborted) return
            // A failed batch can report completed targets anywhere in the selection.
            const completed = new Set((error.completedItems ?? []).map(bulkTargetKey))
            const remaining = action.items.filter(item => !completed.has(bulkTargetKey(item)))
            const [field, label] = {
                setTags: ["modified", "modifications"],
                unlinkTags: ["modified", "modifications"],
                removeLinks: ["deleted", "link removals"],
                delete: ["deleted", "deletions"],
            }[action.kind]
            const errorMessage = bulkErrorDescription(error, action.items.length, field, label)
            setAction(remaining.length ? { ...action, items: remaining, errorMessage } : null)
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
                    errorMessage={action.errorMessage}
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
                        {action.errorMessage && <p role="alert" className="text-destructive">{action.errorMessage}</p>}
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
