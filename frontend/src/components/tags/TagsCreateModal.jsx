import {
    Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateTagSchema } from "@/schemas";
import { api } from "@/api";
import { toast } from "@/components/ui/toast";
import { TagFields } from "@/components/tags/TagsFields"

// CREATE TAG MODAL
export function TagCreateModal({ open, onOpenChange, onCreated }) {
    const form = useForm({
        resolver: zodResolver(CreateTagSchema),
        defaultValues: { name: "", color: "#3b82f6" },
    });

    async function onSubmit(data) {
        try {
            const createdTag = await api("/tags/", {
                method: "POST",
                json: { name: data.name, color: data.color },
            });

            toast.add({ title: "Tag created", type: "success" });
            form.reset();
            onCreated?.(createdTag);
            onOpenChange(false);
        } catch (err) {
            toast.add({
                title: "Could not create tag",
                description: err?.status === 409 ? "Tag already exists" : "Try again later",
                type: "error",
            });
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90dvh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Create Tag</DialogTitle>
                </DialogHeader>

                <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
                    <TagFields form={form} prefix="create-tag" />

                    <DialogFooter className="sm:justify-start">
                        <Button type="submit" size="sm" disabled={form.formState.isSubmitting}>
                            Create
                        </Button>
                        <DialogClose
                            render={<Button type="button" size="sm" variant="outline">Cancel</Button>}
                        />
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}