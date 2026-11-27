import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { useItemModal } from "../../context/ItemsModalContext";
import { UpdateNote } from "@/components/notes/NoteUpdateModal";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { NoteCreateModal } from "../notes/NoteCreateModal";
import { TagCreateModal } from "../tags/TagsCreateModal";
import { UpdateTag } from "@/components/tags/TagsUpdateModal";

export function ItemModalRenderer() {
    const { activeItem, closeItem, notifyItemsChanged } = useItemModal();
    const [note, setNote] = useState(null);
    const [error, setError] = useState(null);
    const [tag, setTag] = useState(null);


    useEffect(() => {
        if (
            activeItem?.type !== "note" ||
            activeItem?.action !== "update"
        ) return;

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
    }, [activeItem?.id, activeItem?.type, activeItem?.action]);
    useEffect(() => {
        if (
            activeItem?.type !== "tag" ||
            activeItem.action !== "update"
        ) return;

        let active = true;

        setTag(null);
        setError(null);

        api(`/tags/${activeItem.id}`)
            .then(data => {
                if (active) setTag(data);
            })
            .catch(error => {
                if (!active) return;
                console.error("Could not fetch tag", error);
                setError("Could not load tag");
            });

        return () => {
            active = false;
        };
    }, [activeItem?.id, activeItem?.type, activeItem?.action]);

    if (!activeItem) {
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
                ) : note && note.id === activeItem.id && activeItem.action === "update" ? (
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
                ) : activeItem.action === "create" && activeItem.type === "note" ?
                    (
                        <NoteCreateModal
                            onClose={closeItem}
                            onCreated={notifyItemsChanged} />
                    )
                    : activeItem.action === "create" && activeItem.type === "tag" ?

                        (
                            <TagCreateModal
                                onCreated={notifyItemsChanged}
                                onClose={closeItem}
                            />
                        )
                        :
                        activeItem.type === "tag" && activeItem.action === "update" && tag?.id === activeItem.id ? (
                            <UpdateTag
                                key={tag.id}
                                tag={tag}
                                onClose={closeItem}
                                onUpdated={updated => {
                                    setTag(updated);
                                    notifyItemsChanged();
                                }}
                                fetchNewTags={notifyItemsChanged}
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
