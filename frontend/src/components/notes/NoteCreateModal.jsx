import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateNoteSchema } from "@/schemas";
import { api } from "@/api/client";
import { toast } from "@/components/ui/toast";

import { NoteFields } from "@/components/notes/NoteFields";
import { ItemModalLayout } from "@/components/items/shared/ItemModalLayout";
import { ItemModalHeader } from "@/components/items/shared/ItemModalHeader";
import { ItemModalFooter } from "@/components/items/shared/ItemModalFooter";
import { ItemRelationsFields } from "@/components/items/shared/ItemRelationsFields";
import { FieldGroup } from "@/components/ui/field";
import { syncItemLinks } from "@/api/linkApi";

// CREATE NOTE MODAL
export function NoteCreateModal({
    onClose,
    onCreated
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
        onCreated?.()
        onClose?.()
    }

    return (
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
            <ItemModalLayout
                header={<ItemModalHeader title="Create Note" />}
                footer={
                    <ItemModalFooter
                        submitLabel="Create"
                        submitDisabled={form.formState.isSubmitting}
                        onCancel={onClose}
                    />
                }
            >
                <FieldGroup>
                    <NoteFields control={form.control} prefix="create-note" />
                    <ItemRelationsFields control={form.control} />
                </FieldGroup>
            </ItemModalLayout>
        </form>
    );
}
