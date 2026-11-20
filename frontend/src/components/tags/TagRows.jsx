import { useState } from "react";
import { api } from "@/api";
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { UpdateTag } from "@/components/tags/TagsUpdateModal";

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
            {/*row*/}
            <div className="flex items-center gap-2 px-2 h-8 border-b">
                <Checkbox
                    checked={selected.has(tag.id)}
                    onCheckedChange={() => onToggle(tag.id)}
                />
                <span
                    className="size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: tag.color }}
                />
                <DialogTrigger
                    render={<button type="button" className="flex-1 text-left truncate" />}
                >
                    {tag.name}
                </DialogTrigger>
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