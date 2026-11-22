import { Search } from "@/components/ui/searches/search";
import { BulkActionsButton } from "@/components/ui/buttons/bulk-actions-button";
import { ItemTypesButton } from "@/components/ui/buttons/item-types-buttons";
import { Switch } from "@/components/ui/switch";
import { FilterButton } from "@/components/ui/buttons/filter-button";
import { useCallback, useEffect, useState } from "react";
import { AddItemButton } from "@/components/ui/buttons/add-item-button";
import { api } from "@/api"
import { Spinner } from "@/components/ui/spinner";
import { Checkbox } from "@/components/ui/checkbox"
import { NoteCreateModal } from "@/components/notes/NoteCreateModal";
import { NoteRow } from "@/components/notes/NoteRow"
import { TagRow } from "@/components/tags/TagRows"
import { TagCreateModal } from "@/components/tags/TagsCreateModal";
import { useItemModal } from "@/components/ItemsModalContext";

function Library() {

    const [notes, setNotes] = useState([])
    const [tags, setTags] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState()
    const [selected, setSelected] = useState(new Set())
    const [itemsMode, setItemsMode] = useState(true)
    const { itemsRevision } = useItemModal();
    const { openItem } = useItemModal();


    const fetchNotes = useCallback(async () => {
        try {
            const response = await api("/notes/")
            setNotes(response)
            setError(null)
        } catch {
            setError("Could not fetch notes")
        } finally {
            setLoading(false)
        }
    }, []);

    const fetchTags = useCallback(async () => {
        try {
            const response = await api("/tags/")
            setTags(response)
            setError(null)
        } catch {
            setError("Could not fetch notes")
        } finally {
            setLoading(false)
        }
    }, []);

    useEffect(() => {
        fetchNotes();
        fetchTags()
    }, [fetchNotes, itemsRevision, fetchTags]);

    useEffect(() => {
        fetchTags();
    }, [fetchTags]);

    //pass notes id into toggle
    const toggle = (id) => {
        //pass previous state "selected" as prev 
        // prev = {"ab1", "ab2", "ab3", "ab4"}
        // each id represents a whole state
        setSelected(prev => {
            const next = new Set(prev)
            // if the new id is in the set delete it, if not add it
            next.has(id) ? next.delete(id) : next.add(id)
            //return the whole set
            return next
        })
    }
    //if there are notes, and there is as many selected states as is notes return true, otherwise false
    const allSelected = notes.length > 0 && selected.size === notes.length || tags.length > 0 && selected.size === tags.length
    //if there are selected notes and its not all return true, otherwise false
    const someSelected = selected.size > 0 && !allSelected

    const toggleAll = () =>
        //when user clicks, then we check if all notes are selected
        // if not we want to deselect them
        //if yes we want to create a new state with a set of all the note ids 
        setSelected(allSelected ? new Set() : new Set(notes.map(n => n.id)))

    const handleTagUpdated = (updatedTag) => {
        //set the array of notes
        setTags(prev =>
            // loop over each note in previus set of notes
            prev.map(tag =>
                //check if the id from UpdateNoteForm (the updated note) 
                // matches with the id we are currently at in the loop
                tag.id === updatedTag.id
                    //if yes then combine the old note object with new note object
                    ? { ...tag, ...updatedTag }
                    // if not then return the old note
                    : tag
            )
        )
    }

    const handleLibrarySwitch = () => {
        if (itemsMode) {
            setLoading(true);
            fetchTags();
        }

        setSelected(new Set());
        setItemsMode(prev => !prev);
    }

    return (
        <div id="library-mobile" className="flex flex-col h-full overflow-hidden px-4 gap-2 mx-auto md:max-w-200 lg:max-w-250">
            <div className="shrink-0 flex flex-col gap-2">
                <h1 className="font-bold text-4xl pb-2 text-center">Library</h1>
                <Search />
                <div className="flex flex-row justify-between">
                    <div className="flex flex-row gap-2 my-auto">
                        <BulkActionsButton size="sm" />
                        <ItemTypesButton size="sm" />
                    </div>
                    <FilterButton size="sm" />
                </div>
            </div>

            <div className="flex-1 min-h-0 flex flex-col border rounded-md overflow-hidden ">
                {/* Header: use the same grid columns as NoteRow */}
                {itemsMode ? (
                    <div className="grid grid-cols-[minmax(0,1fr)_7rem] md:grid-cols-[minmax(0,1fr)_11rem_7rem] lg:grid-cols-[minmax(0,1fr)_14rem_8rem_8rem] items-center gap-2 px-2 h-10 shrink-0 bg-card border-b">
                        <div className="flex min-w-0 items-center gap-2">
                            <Checkbox
                                checked={allSelected}
                                indeterminate={someSelected}
                                onCheckedChange={toggleAll}
                            />
                            <p className="text-lg">Title</p>
                        </div>
                        <p>Tags</p>
                        <p className="hidden md:block">Created at</p>
                        <p className="hidden lg:block">Updated at</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-[minmax(0,1fr)] sm:grid-cols-[minmax(0,1fr)_7rem] md:grid-cols-[minmax(0,1fr)_8rem_8rem] items-center gap-2 px-2 h-10 shrink-0 bg-card border-b">
                        <div className="flex min-w-0 items-center gap-2">
                            <Checkbox
                                checked={allSelected}
                                indeterminate={someSelected}
                                onCheckedChange={toggleAll}
                            />
                            <p className="text-lg">Title</p>
                        </div>
                        <p className="hidden sm:block">Created at</p>
                        <p className="hidden md:block">Updated at</p>
                    </div>
                )}

                {/* Scrollable body */}

                <div className="flex-1 min-h-0 overflow-y-auto">
                    {loading ? (<div className="flex h-full items-center justify-center p-4"><Spinner /></div>)
                        : error ? (<p className="p-4 text-center">{error}</p>)
                            : (itemsMode ? notes : tags).length === 0 ? (
                                <div className="flex h-full flex-col items-center justify-center p-4 text-center">
                                    <p>You have nothing here!</p>
                                    <p>Start by adding a widget to the dashboard and creating an item there.</p>
                                </div>)
                                : itemsMode ?
                                    notes.map(note => (
                                        <NoteRow
                                            key={note.id}
                                            note={note}
                                            tags={tags}
                                            selected={selected}
                                            onToggle={toggle}
                                        />
                                    ))
                                    : tags.map(tag => (
                                        <TagRow
                                            key={tag.id}
                                            tag={tag}
                                            selected={selected}
                                            onToggle={toggle}
                                            onUpdated={handleTagUpdated}
                                            onFetchNewTags={fetchTags}
                                        />
                                    ))
                    }

                </div>

                {/* Footer */}

                <div className="flex items-center gap-2 px-2 h-14 shrink-0 bg-card justify-between ">
                    <div className="flex flex-row gap-2 items-center px-2">
                        <p>Items</p>
                        <Switch onCheckedChange={handleLibrarySwitch} />
                        <p>Tags</p>
                    </div>

                    {itemsMode ? <AddItemButton size="sm" onSelectType={type => openItem(type.toLowerCase(), null, "create")} items={["Note", "File", "Form", "Event"]}/>
                        : <AddItemButton size="sm" onSelectType={type => openItem(type.toLowerCase(), null, "create")} items={["Tag"]}/>}
                </div>

                {/*<NoteCreateModal
                    open={createType === "note"}
                    onOpenChange={(open) => {
                        if (!open) setCreateType(null);
                    }}
                    onCreated={fetchNotes}
                />
                <TagCreateModal
                    open={createTag}
                    onOpenChange={(open) => {
                        if (!open) setCreateTag(null);
                    }}
                    onCreated={fetchTags}
                />*/}
            </div>
        </div>
    )
}

export { Library }