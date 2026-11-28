import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateNoteSchema } from "@/schemas";
import { api } from "@/api/client";
import { toast } from "@/lib/toast";

import { NoteFields } from "@/components/notes/NoteFields";
import { ItemModalLayout } from "@/components/items/shared/ItemModalLayout";
import { ItemModalHeader } from "@/components/items/shared/ItemModalHeader";
import { ItemModalFooter } from "@/components/items/shared/ItemModalFooter";
import { ItemRelationsFields } from "@/components/items/shared/ItemRelationsFields";
import { FieldGroup } from "@/components/ui/field";
import { syncItemLinks } from "@/api/linkApi";
import { useModalWork } from "@/hooks/useModalWork";

// CREATE NOTE MODAL
export function NoteCreateModal({ onClose }) {
    const { signal, write } = useModalWork();
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
        let created = false;
        const links = form.getValues("links") ?? [];
        try {
            await write(async sessionSignal => {
                const note = await api("/notes/", {
                    method: "POST",
                    json: { title: data.title, content: data.content, tags: data.tags },
                    signal: sessionSignal,
                });
                created = true;
                // The note write may outlive this modal. Link writes need its live scope.
                signal.throwIfAborted();
                await syncItemLinks("note", note.inserted_id, links, { signal, writeSignal: sessionSignal });
            });
            if (signal.aborted) return;
            toast.add({ title: "Note created", type: "success" });
        } catch (error) {
            if (signal.aborted) return;
            console.error("Could not fully save note", error);
            toast.add({
                title: created ? "Note created, but some links could not be saved" : "Could not confirm note creation",
                description: created ? "Open the note and try adding the links again." : "Check the Library before retrying.",
                type: "error",
            });
            if (!created) return;
        }

        // Do not retry note creation if a later link request fails.
        form.reset();
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
