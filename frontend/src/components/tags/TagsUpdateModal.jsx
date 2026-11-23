import { DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UpdateTagSchema } from "@/schemas";
import { api } from "@/api";
import { toast } from "@/components/ui/toast";
import { TagFields } from "@/components/tags/TagsFields"
import { useState } from "react";
import { deleteWithToast } from "@/components/api/deleteWithToast";


// UPDATE TAG FORM
// Rendered inside TagRow's DialogContent. `tag` is the detail response (with usage).
export function UpdateTag({ tag, onUpdated, onClose }) {
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const form = useForm({
        resolver: zodResolver(UpdateTagSchema),
        defaultValues: { name: tag.name ?? "", color: tag.color ?? "#3b82f6" },
    });

    async function onSubmit(data) {
        try {
            const updatedTag = await api(`/tags/${tag.id}`, {
                method: "PATCH",
                json: { name: data.name, color: data.color },
            });

            toast.add({ title: "Tag updated", type: "success" });
            onUpdated?.(updatedTag);
            onClose?.();
        } catch (err) {
            toast.add({
                title: "Could not update tag",
                description: err?.status === 409 ? "Tag already exists" : "Try again later",
                type: "error",
            });
        }
    }

    const handleDelete = async () => {
        await deleteWithToast("tag", tag.id)
        onUpdated?.()
        onClose?.()
    }

    const { total, by_collection } = tag.usage;

    return (
        <>
            <DialogHeader>
                <DialogTitle className="text-2xl">Edit Tag</DialogTitle>
            </DialogHeader>

            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
                <TagFields form={form} prefix="edit-tag" />

                {/* usage */}
                <div className="text-sm text-muted-foreground">
                    {total === 0
                        ? "Not used anywhere yet."
                        : `Used on ${total} item${total === 1 ? "" : "s"}: ` +
                        Object.entries(by_collection)
                            .filter(([, n]) => n > 0)
                            .map(([coll, n]) => `${coll} (${n})`)
                            .join(", ")}
                </div>

                {confirmingDelete ? (
                    <div className="flex flex-col gap-2">
                        <p className="text-sm">
                            {total > 0
                                ? `Used on ${total} item${total === 1 ? "" : "s"}, delete anyway?`
                                : "Delete this tag?"}
                        </p>
                        <DialogFooter className="sm:justify-start">
                            <Button type="button" size="sm" variant="destructive" onClick={handleDelete}>
                                Confirm delete
                            </Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => setConfirmingDelete(false)}>
                                Back
                            </Button>
                        </DialogFooter>
                    </div>
                ) : (
                    <DialogFooter className="sm:justify-start">
                        <Button type="submit" size="sm" disabled={form.formState.isSubmitting}>
                            Save changes
                        </Button>
                        <Button type="button" size="sm" variant="destructive" onClick={() => setConfirmingDelete(true)}>
                            Delete
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                    </DialogFooter>
                )}
            </form>
        </>
    );
}