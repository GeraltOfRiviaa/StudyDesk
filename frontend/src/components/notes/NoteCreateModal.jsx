import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateNoteSchema } from "@/schemas";
import { api } from "@/api";
import { toast } from "@/components/ui/toast";

import { NoteFields } from "@/components/notes/NoteFields"

// CREATE NOTE MODAL
export function NoteCreateModal({
    open,
    onOpenChange,
    onCreated,
}) {
    const form = useForm({
        resolver: zodResolver(CreateNoteSchema),
        defaultValues: {
            title: "",
            content: "",
            tags: [],
        },
    });

    async function onSubmit(data) {
        try {
            const createdNote = await api("/notes/", {
                method: "POST",
                json: {
                    title: data.title,
                    content: data.content,
                    tags: data.tags,
                },
            });

            toast.add({
                title: "Note created",
                type: "success",
            });

            form.reset();
            onCreated?.(createdNote);
            onOpenChange(false);
        } catch {
            toast.add({
                title: "Could not create note",
                description: "Try again later",
                type: "error",
            });
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90dvh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Create Note</DialogTitle>
                </DialogHeader>

                <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="flex flex-col gap-4"
                >
                    <NoteFields
                        form={form}
                        prefix="create-note"
                    />

                    <DialogFooter className="sm:justify-start">
                        <Button
                            type="submit"
                            size="sm"
                            disabled={form.formState.isSubmitting}
                        >
                            Create
                        </Button>

                        <DialogClose
                            render={
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                >
                                    Cancel
                                </Button>
                            }
                        />
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
