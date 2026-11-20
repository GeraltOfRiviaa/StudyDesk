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
import { NoteFields } from "@/components/modals/NoteFields"
import { Switch } from "../ui/switch";
import Markdown from "react-markdown";
import { useState } from "react";

// UPDATE NOTE FORM
// This component is rendered inside NoteRow's DialogContent.
export function UpdateNote({
    note,
    onUpdated,
    onClose,
    fetchNewNotes
}) {
    const [viewMode, setViewMode] = useState(true);
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

    const handleCheckChange = () => {
        viewMode ? setViewMode(false) : setViewMode(true)
    }

    return (
        <>
            <DialogHeader>
                <DialogTitle className="text-2xl">
                    {viewMode ? note.title : "Edit Note"}
                </DialogTitle>
                <div className="flex flex-row pt-2 gap-2 justify-end">
                    <Switch name="note-view-mode" onCheckedChange={handleCheckChange} checked={viewMode} />
                    <p>View</p>
                </div>

            </DialogHeader>

            <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="flex flex-col gap-4"
            >
                <div >
                    {viewMode ?
                        (<div className="prose prose-sm max-w-none dark:prose-invert pb-5">
                            <Markdown>{note.content}</Markdown>
                        </div>
                        )
                        :
                        <NoteFields form={form} prefix="edit-note" />}

                </div>

                <DialogFooter className="sm:justify-start">
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
                </DialogFooter>
            </form>
        </>
    );
}

