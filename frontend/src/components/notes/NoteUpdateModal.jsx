import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UpdateNoteSchema } from "@/schemas";
import { api } from "@/api/client";
import { toast } from "@/components/ui/toast";
import { NoteFields } from "@/components/notes/NoteFields";
import { ItemModalLayout } from "@/components/items/shared/ItemModalLayout";
import { ItemModalHeader } from "@/components/items/shared/ItemModalHeader";
import { ItemModalFooter } from "@/components/items/shared/ItemModalFooter";
import { ItemRelationsFields } from "@/components/items/shared/ItemRelationsFields";
import { FieldGroup } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import Markdown from "react-markdown";
import { useState, useEffect, useRef } from "react";
import { useItemModal } from "@/context/ItemsModalContext";
import { syncItemLinks } from "@/api/linkApi";
import { deleteWithToast } from "@/utils/deleteWithToast";
import { useTagLookup } from "@/hooks/useTagLookup";

// UPDATE NOTE FORM
export function UpdateNote({
    note,
    onUpdated,
    onClose,
    onDeleted
}) {
    const [viewMode, setViewMode] = useState(true);
    const [linksLoading, setLinksLoading] = useState(true);
    const [linksError, setLinksError] = useState(null);
    const allowNavigation = useRef(false);
    const { registerNavigationGuard } = useItemModal();

    // Use the fields from when this note opened to initialize the form once its links arrive.
    const [defaultValues] = useState(() => ({
        title: note.title ?? "",
        content: note.content ?? "",
        tags: note.tags ?? [],
        links: note.links ?? [],
    }));
    const form = useForm({
        resolver: zodResolver(UpdateNoteSchema),
        defaultValues,
    });

    const selectedTags = useWatch({ control: form.control, name: "tags" }) ?? [];
    const selectedLinks = useWatch({ control: form.control, name: "links" }) ?? [];
    const noteTags = useTagLookup(selectedTags);

    const { reset } = form;
    const isDirty = form.formState.isDirty;

    // Ask before leaving an editor that has unsaved changes.
    useEffect(() => registerNavigationGuard(() =>
        allowNavigation.current || !isDirty || window.confirm("Discard unsaved changes to this note?")
    ), [registerNavigationGuard, isDirty]);

    // The notes endpoint does not include links; fetch them separately.
    useEffect(() => {
        const controller = new AbortController();

        api(`/links/note/${note.id}`, { signal: controller.signal })
            .then(links => {
                if (controller.signal.aborted) return;
                reset({ ...defaultValues, links });
                setLinksLoading(false);
            })
            .catch(error => {
                if (controller.signal.aborted) return;
                console.error("Could not load note links", error);
                setLinksError("Could not load links. Try reopening the note.");
                setLinksLoading(false);
            });

        return () => controller.abort();
    }, [note.id, defaultValues, reset]);

    async function onSubmit(data) {
        if (linksLoading || linksError) return;

        let updatedNote;
        try {
            updatedNote = await api(`/notes/${note.id}`, {
                method: "PATCH",
                json: {
                    title: data.title,
                    content: data.content,
                    tags: data.tags,
                },
            });
        } catch (error) {
            console.error("Could not update note", error);
            toast.add({
                title: "Could not update note",
                description: "Try again later",
                type: "error",
            });
            return;
        }

        try {
            // Read the controlled field directly so it also works before
            // links is added to the Zod schema (which may strip unknown fields).
            await syncItemLinks("note", note.id, form.getValues("links") ?? []);
        } catch (error) {
            console.error("Could not save note links", error);
            onUpdated?.(updatedNote);
            toast.add({
                title: "Note text saved, but links could not be fully saved",
                description: "Try saving the links again.",
                type: "error",
            });
            return;
        }

        toast.add({ title: "Note updated", type: "success" });
        allowNavigation.current = true;
        onUpdated?.(updatedNote);
        onClose?.();
    }

    const handleDelete = async () => {
        await deleteWithToast("note", note.id)
        onDeleted?.()
        onClose?.()
    }

    return (
        <form onSubmit={event => form.handleSubmit(onSubmit)(event)} className="flex min-h-0 flex-1 flex-col">
            <ItemModalLayout
                header={
                    <ItemModalHeader title={note.title} tags={noteTags} links={selectedLinks} titleClassName="text-2xl">
                        <label className="flex shrink-0 items-center gap-2">
                            <Switch
                                name="note-view-mode"
                                checked={viewMode}
                                onCheckedChange={setViewMode}
                            />
                            View
                        </label>
                    </ItemModalHeader>
                }
                footer={
                    <ItemModalFooter
                        className="flex-row justify-start sm:justify-start"
                        submitLabel={viewMode ? undefined : "Save changes"}
                        submitDisabled={form.formState.isSubmitting || linksLoading || !!linksError}
                        onDelete={handleDelete}
                        onCancel={onClose}
                    />
                }
            >
                {viewMode ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                        <Markdown>{note.content}</Markdown>
                    </div>
                ) : linksLoading ? (
                    <p>Loading links...</p>
                ) : linksError ? (
                    <p role="alert">{linksError}</p>
                ) : (
                    <FieldGroup>
                        <NoteFields control={form.control} prefix="edit-note" />
                        <ItemRelationsFields control={form.control} sourceType="note" sourceId={note.id} />
                    </FieldGroup>
                )}
            </ItemModalLayout>
        </form>
    );
}

