import { Search } from "@/components/ui/searches/search";
import { BulkActionsButton } from "@/components/ui/buttons/bulk-actions-button";
import { ItemTypesButton } from "@/components/ui/buttons/item-types-buttons";
import { Switch } from "@/components/ui/switch";
import { FilterButton } from "@/components/ui/buttons/filter-button";
import { useEffect, useState } from "react";
import { Ad, Plus } from 'lucide-react'
import { Button } from "@/components/ui/button";
import { AddItemButton } from "@/components/ui/buttons/add-item-button";
import { api } from "@/api"
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { Checkbox } from "@/components/ui/checkbox"
import { CreateNoteModal } from "@/components/modals/NoteModal";
import { NoteRow } from "@/components/modals/NoteRow"

function Library() {

    const [notes, setNotes] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState()
    const [selected, setSelected] = useState(new Set())
    const [createType, setCreateType] = useState(null)

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

    const handleNoteUpdated = (updatedNote) => {
        setNotes(prev =>
            prev.map(note =>
                note.id === updatedNote.id
                    ? { ...note, ...updatedNote }
                    : note
            )
        )
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
                    {loading ? (
                        <div className="flex h-full items-center justify-center p-4"><Spinner /></div>
                    ) : error ? (
                        <p className="p-4 text-center">{error}</p>
                    ) : notes.length === 0 ? (
                        <div className="flex h-full flex-col items-center justify-center p-4 text-center">
                            <p>You have nothing here!</p>
                            <p>Start by adding a widget to the dashboard and creating an item there.</p>
                        </div>
                    ) : (
                        notes.map(note => (
                            <NoteRow
                                key={note.id}
                                note={note}
                                selected={selected}
                                onToggle={toggle}
                                onUpdated={handleNoteUpdated}
                            />
                        ))
                    )}
                </div>

                {/* Footer */}

                <div className="flex items-center gap-2 px-2 h-14 shrink-0 bg-card justify-between ">
                    <div className="flex flex-row gap-2 items-center px-2">
                        <p>Items</p>
                        <Switch />
                        <p>Tags</p>
                    </div>

                    <AddItemButton size="sm" onSelectType={setCreateType} />
                </div>
                <CreateNoteModal
                    open={createType === "note"}
                    onOpenChange={(open) => {
                        if (!open) setCreateType(null);
                    }}
                    onCreated={fetchNotes}
                />
            </div>
        </div>
    )
}

export { Library }