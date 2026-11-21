import { useEffect, useState } from "react";
import { api } from "@/api";
import { useItemModal } from "./ItemsModalContext";
import { UpdateNote } from "@/components/notes/NoteUpdateModal";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";

export function ItemModalRenderer() {
    const { activeItem, closeItem, notifyItemsChanged } = useItemModal();
    const [note, setNote] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!activeItem || activeItem.type !== "note") {
            return;
        }

        let active = true;
        setNote(null);
        setError(null);

        api(`/notes/${activeItem.id}`)
            .then(data => {
                if (active) setNote(data);
            })
            .catch(error => {
                if (!active) return;
                console.error("Could not fetch note", error);
                setError("Could not load note");
            });

        return () => {
            active = false;
        };
    }, [activeItem?.id, activeItem?.type]);

    if (!activeItem || activeItem.type !== "note") {
        return null;
    }

    return (
        <Dialog
            open
            onOpenChange={open => {
                if (!open) closeItem();
            }}
        >
            <DialogContent className="flex max-h-[90dvh] flex-col overflow-hidden sm:max-w-xl md:max-w-2xl">
                {error ? (
                    <>
                        <DialogTitle className="sr-only">Could not load note</DialogTitle>
                        <p>{error}</p>
                    </>
                ) : note && note.id === activeItem.id ? (
                    <UpdateNote
                        key={note.id}
                        note={note}
                        onClose={closeItem}
                        onUpdated={updated => {
                            setNote(updated);
                            notifyItemsChanged();
                        }}
                        onDeleted={notifyItemsChanged}
                    />
                ) : (
                    <>
                        <DialogTitle className="sr-only">Loading note</DialogTitle>
                        <div className="flex flex-col gap-2">
                            <Skeleton className="h-6 w-24" />
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-40 w-full" />
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
