import {
    DialogClose, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateTagSchema } from "@/schemas";
import { api } from "@/api/client";
import { toast } from "@/lib/toast";
import { TagFields } from "@/components/tags/TagsFields"
import { useModalWork } from "@/hooks/useModalWork"

// CREATE TAG MODAL
export function TagCreateModal({ onClose }) {
    const { signal, write } = useModalWork();
    const form = useForm({
        resolver: zodResolver(CreateTagSchema),
        defaultValues: { name: "", color: "#3b82f6" },
    });
    async function onSubmit(data) {
        try {
            await write(sessionSignal => api("/tags/", {
                method: "POST",
                json: { name: data.name, color: data.color },
                signal: sessionSignal,
            }));
            if (signal.aborted) return;

            toast.add({ title: "Tag created", type: "success" });
            form.reset();
            onClose?.();
        } catch {
            if (signal.aborted) return;
            toast.add({
                title: "Could not confirm tag creation",
                description: "Check your tags before retrying.",
                type: "error",
            });
        }
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <DialogHeader className="shrink-0 pb-3">
                    <DialogTitle>Create Tag</DialogTitle>
                </DialogHeader>

                <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
                    <div className="min-h-0 flex-1 overflow-y-auto">
                        <TagFields form={form} prefix="create-tag" />
                    </div>
                    <DialogFooter className="shrink-0 border-t pt-3 sm:justify-start">
                        <Button type="submit" size="sm" disabled={form.formState.isSubmitting}>
                            Create
                        </Button>
                        <DialogClose
                            render={<Button type="button" size="sm" variant="outline">Cancel</Button>}
                        />
                    </DialogFooter>
                </form>
        </div>
    );
}
