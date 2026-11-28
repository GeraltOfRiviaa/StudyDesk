import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { useItemModal } from "@/context/ItemsModalContext";
import { ITEM_TYPES } from "@/lib/itemTypes";
import { NoteCreateModal } from "@/components/notes/NoteCreateModal";
import { UpdateNote } from "@/components/notes/NoteUpdateModal";
import { TagCreateModal } from "@/components/tags/TagsCreateModal";
import { UpdateTag } from "@/components/tags/TagsUpdateModal";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

function ItemDetails({ id, collection, label, signal: modalSignal, children }) {
    const [item, setItem] = useState(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        const controller = new AbortController();
        const signal = AbortSignal.any([controller.signal, modalSignal]);

        api(`/${collection}/${id}`, { signal })
            .then(data => {
                if (!signal.aborted) setItem(data);
            })
            .catch(error => {
                if (signal.aborted) return;
                console.error(`Could not fetch ${label}`, error);
                setError(true);
            });

        return () => controller.abort();
    }, [collection, id, label, modalSignal]);

    if (error) {
        const message = `Could not load ${label}`;

        return (
            <>
                <DialogTitle className="sr-only">{message}</DialogTitle>
                <p role="alert">{message}</p>
            </>
        );
    }

    if (!item) {
        return (
            <>
                <DialogTitle className="sr-only">Loading {label}</DialogTitle>
                <div className="flex flex-col gap-2">
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-40 w-full" />
                </div>
            </>
        );
    }

    return children(item, updated => {
        if (!modalSignal.aborted) setItem(updated);
    });
}

function ItemModalContent({ activeItem, onClose }) {
    const { type, id, action, signal } = activeItem;
    const noteType = ITEM_TYPES.note;

    if (type === noteType.type && action === "create") {
        return <NoteCreateModal onClose={onClose} />;
    }

    if (type === "tag" && action === "create") {
        return <TagCreateModal onClose={onClose} />;
    }

    if (type === noteType.type && action === "update") {
        return (
            <ItemDetails id={id} collection={noteType.collection} label="note" signal={signal}>
                {(note, onUpdated) => (
                    <UpdateNote note={note} onClose={onClose} onUpdated={onUpdated} />
                )}
            </ItemDetails>
        );
    }

    if (type === "tag" && action === "update") {
        return (
            <ItemDetails id={id} collection="tags" label="tag" signal={signal}>
                {(tag, onUpdated) => (
                    <UpdateTag tag={tag} onClose={onClose} onUpdated={onUpdated} />
                )}
            </ItemDetails>
        );
    }

    const label = ITEM_TYPES[type]?.label ?? "Item";
    const operation = action === "create" ? "creation" : "editing";

    return (
        <>
            <DialogTitle className="sr-only">{label} unavailable</DialogTitle>
            <p>{label} {operation} is unavailable.</p>
        </>
    );
}

export function ItemModalRenderer() {
    const { activeItem, closeItem } = useItemModal();

    if (!activeItem || activeItem.signal.aborted) return null;
    const close = () => closeItem(activeItem);

    return (
        <Dialog open onOpenChange={open => { if (!open) close(); }}>
            <DialogContent className="flex max-h-[90dvh] flex-col overflow-hidden sm:max-w-xl md:max-w-2xl">
                <ItemModalContent
                    key={activeItem.opening}
                    activeItem={activeItem}
                    onClose={close}
                />
            </DialogContent>
        </Dialog>
    );
}
