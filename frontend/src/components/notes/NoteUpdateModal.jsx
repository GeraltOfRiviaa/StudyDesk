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
import { useState, useEffect } from "react";
import { TagBadge } from "@/components/tags/TagBadge";

// UPDATE NOTE FORM
// This component is rendered inside NoteRow's DialogContent.
export function UpdateNote({
    note,
    onUpdated,
    onClose,
    fetchNewNotes
}) {
    const [viewMode, setViewMode] = useState(true);
    const [availableTags, setAvailableTags] = useState([]);

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

    const noteTags = availableTags.filter(tag =>
        (note.tags ?? []).includes(tag.id)
    );


    const form = useForm({
        resolver: zodResolver(UpdateNoteSchema),
        defaultValues: {
            title: note.title ?? "",
            content: note.content ?? "",
            tags: note.tags ?? [],
        },
    });

    async function onSubmit(data) {
        try {
            const updatedNote = await api(`/notes/${note.id}`, {
                method: "PATCH",
                json: {
                    title: data.title,
                    content: data.content,
                    tags: data.tags,
                },
            });

            toast.add({
                title: "Note updated",
                type: "success",
            });

            onUpdated?.(updatedNote)
            onClose?.();
        } catch {
            toast.add({
                title: "Could not update note",
                description: "Try again later",
                type: "error",
            });
        }
    }

    const deleteItem = async () => {
        try {
            await api(`/notes/${note.id}`, { method: "DELETE" });

            toast.add({
                title: "Note deleted",
                type: "success",
            });
            fetchNewNotes()
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
            <DialogHeader className="sticky top-0 z-10 shrink-0 bg-transparent pb-3 gap-0">

                <DialogTitle className="text-2xl">
                    {note.title }
                </DialogTitle>
            </DialogHeader>

            <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="flex min-h-0 flex-1 flex-col gap-4"
            >
                <div className="min-h-0 flex-1 overflow-y-auto">
                    {viewMode ? (
                        <div className="flex flex-col gap-4 pb-5">
                            <div className="flex flex-wrap gap-2">
                                {noteTags.map(tag => (
                                    <TagBadge key={tag.id} tag={tag} />
                                ))}
                            </div>

                            <div className="prose prose-sm max-w-none dark:prose-invert">
                                <Markdown>{note.content}</Markdown>
                            </div>
                        </div>
                    ) : (
                        <NoteFields form={form} prefix="edit-note" />
                    )}
                </div>

                <DialogFooter className="shrink-0 border-t pt-3 sm:justify-between">

                    <div className="flex gap-2">
                        {!viewMode && (
                            <Button type="submit" size="sm" disabled={form.formState.isSubmitting}>
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

