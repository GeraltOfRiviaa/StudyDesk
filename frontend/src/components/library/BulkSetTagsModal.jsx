import { useState } from "react"
import { MAX_BULK_TAGS } from "@/api/bulkApi"
import { TagSelector } from "@/components/tags/TagSelector"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

export function BulkSetTagsModal({ itemCount, isPending, onApply, onClose }) {
    const [tags, setTags] = useState([])
    const overLimit = tags.length > MAX_BULK_TAGS

    return (
        <Dialog open onOpenChange={open => { if (!open) onClose() }}>
            <DialogContent className="max-h-[90dvh] overflow-y-auto" showCloseButton={!isPending}>
                <DialogHeader>
                    <DialogTitle>Set tags</DialogTitle>
                    <DialogDescription>
                        Add tags to {itemCount} selected {itemCount === 1 ? "item" : "items"}, keeping their existing tags.
                    </DialogDescription>
                </DialogHeader>

                <TagSelector value={tags} onChange={setTags} allowCreate={false} disabled={isPending} />
                {overLimit && (
                    <p role="alert">Select up to {MAX_BULK_TAGS} tags.</p>
                )}

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={() => onApply(tags)}
                        disabled={isPending || !tags.length || overLimit}
                    >
                        {isPending ? "Applying…" : "Apply tags"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
