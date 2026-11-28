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
import { useModalWork } from "@/hooks/useModalWork";
import { syncItemLinks } from "@/api/linkApi";
import { deleteWithToast } from "@/utils/deleteWithToast";
import { useTagLookup } from "@/hooks/useTagLookup";

// UPDATE NOTE FORM
export function UpdateNote({
    note,
    onUpdated,
    onClose
}) {
    const [viewMode, setViewMode] = useState(true);
    const [linksLoading, setLinksLoading] = useState(true);
    const [linksError, setLinksError] = useState(null);
    const allowNavigation = useRef(false);
    const { registerNavigationGuard } = useItemModal();
    const { signal, write } = useModalWork();

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
        const readSignal = AbortSignal.any([controller.signal, signal]);

        api(`/links/note/${note.id}`, { signal: readSignal })
            .then(links => {
                if (readSignal.aborted) return;
                reset({ ...defaultValues, links });
                setLinksLoading(false);
            })
            .catch(error => {
                if (readSignal.aborted) return;
                console.error("Could not load note links", error);
                setLinksError("Could not load links. Try reopening the note.");
                setLinksLoading(false);
            });

        return () => controller.abort();
    }, [note.id, defaultValues, reset, signal]);

    async function onSubmit(data) {
        if (linksLoading || linksError) return;

        let updatedNote;
        const links = form.getValues("links") ?? [];
        try {
            await write(async sessionSignal => {
                updatedNote = await api(`/notes/${note.id}`, {
                    method: "PATCH",
                    json: { title: data.title, content: data.content, tags: data.tags },
                    signal: sessionSignal,
                });
                signal.throwIfAborted();
                await syncItemLinks("note", note.id, links, { signal, writeSignal: sessionSignal });
            });
        } catch (error) {
            if (signal.aborted) return;
            console.error("Could not fully update note", error);
            if (updatedNote) onUpdated?.(updatedNote);
            toast.add({
                title: updatedNote ? "Note text saved, but links could not be fully saved" : "Could not confirm note update",
                description: updatedNote ? "Try saving the links again." : "Check the Library before retrying.",
                type: "error",
            });
            return;
        }

        if (signal.aborted) return;
        toast.add({ title: "Note updated", type: "success" });
        allowNavigation.current = true;
        onUpdated?.(updatedNote);
        onClose?.();
    }

    const handleDelete = async () => {
        try {
            await write(sessionSignal => deleteWithToast("note", note.id, { signal: sessionSignal, modalSignal: signal }));
            if (!signal.aborted) onClose?.();
        } catch {
            // The active modal already received feedback from deleteWithToast.
        }
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

