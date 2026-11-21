import {
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UpdateNoteSchema } from "@/schemas";
import { api } from "@/api";
import { toast } from "@/components/ui/toast";
import { NoteFields } from "@/components/notes/NoteFields"
import { Switch } from "@/components/ui/switch";
import Markdown from "react-markdown";
import { useState, useEffect, useRef } from "react";
import { TagBadge } from "@/components/tags/TagBadge";
import { useItemModal } from "@/components/ItemsModalContext";
import { syncItemLinks } from "@/components/links/linkApi";
import { Link2 } from "lucide-react";
import { Badge } from "../ui/badge";
import { LinkBadge } from "@/components/links/LinkTagBadge";
// UPDATE NOTE FORM
export function UpdateNote({
    note,
    onUpdated,
    onClose,
    onDeleted
}) {
    const [viewMode, setViewMode] = useState(true);
    const [availableTags, setAvailableTags] = useState([]);
    const [linksLoading, setLinksLoading] = useState(true);
    const [linksError, setLinksError] = useState(null);
    const allowNavigation = useRef(false);
    const { registerNavigationGuard } = useItemModal();
    const { openItem } = useItemModal();

    useEffect(() => {
        async function fetchTags() {
            try {
                const tags = await api("/tags/?limit=100");
                setAvailableTags(tags);
            } catch (error) {
                console.error("Could not fetch tags", error);
            }
        }

        fetchTags();
    }, []);

    


    const form = useForm({
        resolver: zodResolver(UpdateNoteSchema),
        defaultValues: {
            title: note.title ?? "",
            content: note.content ?? "",
            tags: note.tags ?? [],
            links: note.links ?? [],
        },
    });

    const selectedTags = form.watch("tags") ?? [];

    const noteTags = availableTags.filter(tag =>
        selectedTags.includes(tag.id)
    );

    const { reset } = form;
    const isDirty = form.formState.isDirty;

    // Ask before leaving an editor that has unsaved changes.
    useEffect(() => registerNavigationGuard(() =>
        allowNavigation.current || !isDirty || window.confirm("Discard unsaved changes to this note?")
    ), [registerNavigationGuard, isDirty]);

    // The notes endpoint does not include links; fetch them separately.
    useEffect(() => {
        let active = true;
        setLinksLoading(true);
        setLinksError(null);

        api(`/links/note/${note.id}`)
            .then(links => {
                if (!active) return;
                reset({
                    title: note.title ?? "",
                    content: note.content ?? "",
                    tags: note.tags ?? [],
                    links,
                });
                setLinksLoading(false);
            })
            .catch(error => {
                if (!active) return;
                console.error("Could not load note links", error);
                setLinksError("Could not load links. Try reopening the note.");
                setLinksLoading(false);
            });

        return () => { active = false; };
    }, [note.id, reset]);

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

    const deleteItem = async () => {
        try {
            await api(`/notes/${note.id}`, { method: "DELETE" });

            toast.add({
                title: "Note deleted",
                type: "success",
            });
            allowNavigation.current = true;
            onDeleted?.(note.id);
            onClose?.();
        } catch {
            toast.add({
                title: "Could not delete the note",
                description: "Try again later",
                type: "error",
            });
        }
    }

    return (
        <div className="flex min-h-0 flex-col">
            <DialogHeader className="shrink-0 bg-transparent pb-3 gap-0">
                <DialogTitle className="flex text-2xl">
                    {note.title}
                </DialogTitle>

                <div className="flex flex-wrap flex-col gap-1">
                    <div className="flex flex-wrap flex-row gap-1">
                        {noteTags.map(tag => (
                            <TagBadge key={tag.id} tag={tag} />
                        ))}
                    </div>

                    <div className="flex flex-wrap flex-row gap-1">
                        {(form.watch("links") ?? []).map(link => (
                            <LinkBadge
                                key={`${link.item_type}-${link.item_id}`}
                                link={link}
                            />
                        ))}
                    </div>
                </div>

            </DialogHeader>

            <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="flex min-h-0 flex-1 flex-col gap-4"
            >
                <div className="min-h-0 flex-1 overflow-y-auto">
                    {viewMode ? (
                        <div className="flex flex-col">
                            <div className="prose prose-sm max-w-none dark:prose-invert">
                                <Markdown>{note.content}</Markdown>
                            </div>
                        </div>
                    ) : linksLoading ? (
                        <p>Loading links...</p>
                    ) : linksError ? (
                        <p role="alert">{linksError}</p>
                    ) : (
                        <NoteFields form={form} prefix="edit-note" noteId={note.id} />
                    )}
                </div>

                <DialogFooter className="shrink-0 border-t pt-3 sm:justify-between">

                    <div className="flex gap-2">
                        {!viewMode && (
                            <Button type="submit" size="sm" disabled={form.formState.isSubmitting || linksLoading || !!linksError}>
                                Save changes
                            </Button>
                        )}
                        <Button type="button" size="sm" variant="destructive" onClick={deleteItem}>
                            Delete
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                    </div>

                    <div className="flex flex-row gap-2 pt-2">
                        <Switch
                            name="note-view-mode"
                            checked={viewMode}
                            onCheckedChange={setViewMode}
                        />
                        <p>View</p>
                    </div>
                </DialogFooter>
            </form>
        </div>
    );
}

