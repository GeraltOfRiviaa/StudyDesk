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

function ItemDetails({ id, collection, label, onChanged, children }) {
    const [item, setItem] = useState(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        const controller = new AbortController();

        api(`/${collection}/${id}`, { signal: controller.signal })
            .then(data => {
                if (!controller.signal.aborted) setItem(data);
            })
            .catch(error => {
                if (controller.signal.aborted) return;
                console.error(`Could not fetch ${label}`, error);
                setError(true);
            });

        return () => controller.abort();
    }, [collection, id, label]);

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
        setItem(updated);
        onChanged();
    });
}

function ItemModalContent({ activeItem, onClose, onChanged }) {
    const { type, id, action } = activeItem;
    const noteType = ITEM_TYPES.note;

    if (type === noteType.type && action === "create") {
        return <NoteCreateModal onClose={onClose} onCreated={onChanged} />;
    }

    if (type === "tag" && action === "create") {
        return <TagCreateModal onClose={onClose} onCreated={onChanged} />;
    }

    if (type === noteType.type && action === "update") {
        return (
            <ItemDetails id={id} collection={noteType.collection} label="note" onChanged={onChanged}>
                {(note, onUpdated) => (
                    <UpdateNote note={note} onClose={onClose} onUpdated={onUpdated} onDeleted={onChanged} />
                )}
            </ItemDetails>
        );
    }

    if (type === "tag" && action === "update") {
        return (
            <ItemDetails id={id} collection="tags" label="tag" onChanged={onChanged}>
                {(tag, onUpdated) => (
                    <UpdateTag tag={tag} onClose={onClose} onUpdated={onUpdated} onChanged={onChanged} />
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
    const { activeItem, closeItem, notifyItemsChanged } = useItemModal();

    if (!activeItem) return null;

    return (
        <Dialog open onOpenChange={open => { if (!open) closeItem(); }}>
            <DialogContent className="flex max-h-[90dvh] flex-col overflow-hidden sm:max-w-xl md:max-w-2xl">
                <ItemModalContent
                    key={`${activeItem.type}:${activeItem.id}:${activeItem.action}`}
                    activeItem={activeItem}
                    onClose={closeItem}
                    onChanged={notifyItemsChanged}
                />
            </DialogContent>
        </Dialog>
    );
}
