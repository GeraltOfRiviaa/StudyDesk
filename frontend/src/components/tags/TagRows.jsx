import { useState } from "react";
import { api } from "@/api";
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { UpdateTag } from "@/components/tags/TagsUpdateModal";

const formatDate = (date) => date ? new Date(date).toLocaleDateString() : "—";

export function TagRow({ tag, selected, onToggle, onUpdated, onFetchNewTags }) {
    const [open, setOpen] = useState(false);
    const [fullTag, setFullTag] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    async function handleOpenChange(nextOpen) {
        setOpen(nextOpen);

        if (!nextOpen) {
            setFullTag(null);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // detail route also returns usage counts
            const data = await api(`/tags/${tag.id}`, { method: "GET" });
            setFullTag(data);
        } catch {
            setError("Could not load tag");
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            {/* Same grid columns as the Library tags header */}
            <div className="grid grid-cols-[minmax(0,1fr)] sm:grid-cols-[minmax(0,1fr)_7rem] md:grid-cols-[minmax(0,1fr)_8rem_8rem] items-center gap-2 px-2 min-h-9 border-b">
                <div className="flex min-w-0 items-center gap-2">
                    <Checkbox
                        checked={selected.has(tag.id)}
                        onCheckedChange={() => onToggle(tag.id)}
                    />
                    <span
                        className="size-3 shrink-0 rounded-full"
                        style={{ backgroundColor: tag.color }}
                    />
                    <DialogTrigger
                        render={<button type="button" className="min-w-0 flex-1 truncate text-left" />}
                    >
                        {tag.name}
                    </DialogTrigger>
                </div>
                <span className="hidden truncate text-sm text-muted-foreground sm:block">
                    {formatDate(tag.created_at)}
                </span>
                <span className="hidden truncate text-sm text-muted-foreground md:block">
                    {formatDate(tag.updated_at)}
                </span>
            </div>

            {/*Dialog content*/}
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
                {loading ? (
                    <div className="flex flex-col gap-2">
                        <Skeleton className="h-6 w-24" />
                        <Skeleton className="h-9 w-full" />
                        <Skeleton className="h-9 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                    </div>
                ) : error ? (
                    <p>{error}</p>
                ) : fullTag ? (
                    <UpdateTag
                        key={fullTag.id}
                        tag={fullTag}
                        onUpdated={onUpdated}
                        onClose={() => setOpen(false)}
                        fetchNewTags={onFetchNewTags}
                    />
                ) : null}
            </DialogContent>
        </Dialog>
    );
}