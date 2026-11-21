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
import { syncItemLinks } from "@/components/links/linkApi";

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
            links: [],
        },
    });

    async function onSubmit(data) {
        let createdNote;
        try {
            createdNote = await api("/notes/", {
                method: "POST",
                json: {
                    title: data.title,
                    content: data.content,
                    tags: data.tags,
                },
            });
        } catch (error) {
            console.error("Could not create note", error);
            toast.add({
                title: "Could not create note",
                description: "Try again later",
                type: "error",
            });
            return;
        }

        // POST /notes/ returns inserted_id, not a complete NotePublic object.
        try {
            await syncItemLinks("note", createdNote.inserted_id, form.getValues("links") ?? []);
            toast.add({ title: "Note created", type: "success" });
        } catch (error) {
            console.error("Note created but its links could not all be saved", error);
            toast.add({
                title: "Note created, but some links could not be saved",
                description: "Open the note and try adding them again.",
                type: "error",
            });
        }

        // Do not retry note creation if a later link request fails.
        form.reset();
        onCreated?.(createdNote);
        onOpenChange(false);
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[90dvh] flex-col overflow-hidden sm:max-w-xl md:max-w-2xl">
                <div className="flex min-h-0 flex-1 flex-col">
                    <DialogHeader className="shrink-0 pb-3">
                        <DialogTitle>Create Note</DialogTitle>
                    </DialogHeader>

                    <form
                        onSubmit={form.handleSubmit(onSubmit)}
                        className="flex min-h-0 flex-1 flex-col gap-4"
                    >
                        <div className="min-h-0 flex-1 overflow-y-auto">
                            <NoteFields
                                form={form}
                                prefix="create-note"
                            />
                        </div>

                        <DialogFooter className="shrink-0 border-t pt-3 sm:justify-between">
                            <Button
                                type="submit"
                                size="sm"
                                disabled={form.formState.isSubmitting}
                            >
                                Create
                            </Button>

                            <DialogClose
                                render={
                                    <Button type="button" size="sm" variant="outline">
                                        Cancel
                                    </Button>
                                }
                            />
                        </DialogFooter>
                    </form>
                </div>
            </DialogContent>
        </Dialog>
    );
}
