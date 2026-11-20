import { useState } from "react";
import { api } from "@/api";
import {
    Dialog,
    DialogTrigger,
    DialogContent
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { UpdateNote } from "@/components/notes/NoteUpdateModal";

export function NoteRow({ note, selected, onToggle, onUpdated, onFetchNewNotes }) {
    const [open, setOpen] = useState(false);
    const [fullNote, setFullNote] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    async function handleOpenChange(nextOpen) {
        setOpen(nextOpen);

        if (!nextOpen) {
            setFullNote(null);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const data = await api(`/notes/${note.id}`, {
                method: "GET",
            });

            setFullNote(data);
        } catch {
            setError("Could not load note");
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            {/*row*/}
            <div className="flex items-center gap-2 px-2 h-8 border-b">
                <Checkbox
                    checked={selected.has(note.id)}
                    onCheckedChange={() => onToggle(note.id)}
                />

                <DialogTrigger
                    render={<button type="button" className="flex-1 text-left truncate" />}
                >
                    {note.title}
                </DialogTrigger>
            </div>

            {/*Dialog content*/}
            <DialogContent className="flex flex-col max-h-[90dvh] overflow-y-auto sm:max-w-xl md:max-w-2xl">
                {loading ? (
                    <div className="flex flex-col gap-2">
                        <Skeleton className="h-6 w-24" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-40 w-full" />
                    </div>
                ) : error ? (
                    <p>{error}</p>
                ) : fullNote ? (
                    <UpdateNote
                        key={fullNote.id}
                        note={fullNote}
                        onUpdated={onUpdated}
                        onClose={() => setOpen(false)}
                        fetchNewNotes={onFetchNewNotes}
                    />
                ) : null}
            </DialogContent>
        </Dialog>
    );
}