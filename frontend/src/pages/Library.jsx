import { Search } from "@/components/ui/searches/search";
import { BulkActionsButton } from "@/components/ui/buttons/bulk-actions-button";
import { ItemTypesButton } from "@/components/ui/buttons/item-types-buttons";
import { Switch } from "@/components/ui/switch";
import { FilterButton } from "@/components/ui/buttons/filter-button";
import { useEffect, useState } from "react";
import { AddItemButton } from "@/components/ui/buttons/add-item-button";
import { api } from "@/api"
import { Spinner } from "@/components/ui/spinner";
import { Checkbox } from "@/components/ui/checkbox"
import { NoteCreateModal } from "@/components/notes/NoteCreateModal";
import { NoteRow } from "@/components/notes/NoteRow"
import { TagRow } from "@/components/tags/TagRows"
import { TagCreateModal } from "@/components/tags/TagsCreateModal";

function Library() {

    const [notes, setNotes] = useState([])
    const [tags, setTags] = useState([])
    const [createTag, setCreateTag] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState()
    const [selected, setSelected] = useState(new Set())
    const [createType, setCreateType] = useState(null)
    const [itemsMode, setItemsMode] = useState(true)

    const fetchNotes = async () => {
        try {
            const response = await api("/notes/")
            setNotes(response)
            setError(null)
        } catch {
            setError("Could not fetch notes")
        } finally {
            setLoading(false)
        }
    }

    const fetchTags = async () => {
        try {
            const response = await api("/tags/")
            setTags(response)
            setError(null)
        } catch {
            setError("Could not fetch notes")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        const fetchNotes = async () => {
            try {
                const response = await api("/notes/")
                setNotes(response)
                setError(null)
            } catch {
                setError("Could not fetch notes")
            } finally {
                setLoading(false)
            }
        }
        fetchNotes()
    }, [])

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
    const allSelected = notes.length > 0 && selected.size === notes.length
    //if there are selected notes and its not all return true, otherwise false
    const someSelected = selected.size > 0 && !allSelected

    const toggleAll = () =>
        //when user clicks, then we check if all notes are selected
        // if not we want to deselect them
        //if yes we want to create a new state with a set of all the note ids 
        setSelected(allSelected ? new Set() : new Set(notes.map(n => n.id)))

    // this function sits in here but is passed into each NoteRow
    // and from there into UpdateNoteForm
    // where it is coded into the onSubmit function of that form
    const handleNoteUpdated = (updatedNote) => {
        //set the array of notes
        setNotes(prev =>
            // loop over each note in previus set of notes
            prev.map(note =>
                //check if the id from UpdateNoteForm (the updated note) 
                // matches with the id we are currently at in the loop
                note.id === updatedNote.id
                    //if yes then combine the old note object with new note object
                    ? { ...note, ...updatedNote }
                    // if not then return the old note
                    : note
            )
        )
    }

    const handleTagUpdated = (updatedTag) => {
        //set the array of notes
        setNotes(prev =>
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
        itemsMode ? setItemsMode(false) : setItemsMode(true)
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
                {/* Header */}
                <div className="flex items-center gap-2 px-2 h-10 shrink-0 bg-card border-b">
                    <div className="flex items-center gap-2 w-2/3">
                        <Checkbox
                            //if true then check
                            checked={allSelected}
                            //if true then return this hollow check 
                            indeterminate={someSelected}
                            //
                            onCheckedChange={toggleAll}
                        />
                        <p className="text-lg">Title</p>
                    </div>
                    <div className="flex items-center gap-2 w-1/3">
                        <p className="text-lg">Tags</p>
                    </div>
                </div>

                {/* Scrollable body */}

                <div className="flex-1 min-h-0 overflow-y-auto">
                    {loading ? (<div className="flex h-full items-center justify-center p-4"><Spinner /></div>)
                        : error ? (<p className="p-4 text-center">{error}</p>)
                            : notes.length === 0 ? (
                                <div className="flex h-full flex-col items-center justify-center p-4 text-center">
                                    <p>You have nothing here!</p>
                                    <p>Start by adding a widget to the dashboard and creating an item there.</p>
                                </div>)
                                : itemsMode ?
                                    notes.map(note => (
                                        <NoteRow
                                            key={note.id}
                                            note={note}
                                            selected={selected}
                                            onToggle={toggle}
                                            onUpdated={handleNoteUpdated}
                                            onFetchNewNotes={fetchNotes}
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

                    {itemsMode? <AddItemButton size="sm" onSelectType={setCreateType} items={["Note", "File", "Form", "Event"]}/>
                    : <AddItemButton size="sm" onSelectType={setCreateTag} items={["Tag"]}/>}
                    
                </div>
                <NoteCreateModal
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
                    />
            </div>
        </div>
    )
}

export { Library }