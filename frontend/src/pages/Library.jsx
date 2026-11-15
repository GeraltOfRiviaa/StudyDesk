import { Search } from "@/components/ui/searches/search";
import { BulkActionsButton } from "@/components/ui/buttons/bulk-actions-button";
import { ItemTypesButton } from "@/components/ui/buttons/item-types-buttons";
import { Switch } from "@/components/ui/switch";
import { FilterButton } from "@/components/ui/buttons/filter-button";
import { useEffect, useState } from "react";
import { Plus } from 'lucide-react'
import { Button } from "@/components/ui/button";
import { AddItemButton } from "@/components/ui/buttons/add-item-button";
import { api } from "@/api"
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { Checkbox } from "@/components/ui/checkbox"

function Library() {

    const [notes, setNotes] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState()
    const [checked, setChecked] = useState(false)

    useEffect(() => {
        const fetchNotes = async () => {
            try {
                const response = await api('/notes/', { method: "GET" })
                setNotes(response)
                setLoading(false)
            } catch {
                setError("Could not fetch notes")
                setLoading(false)
            }
        }
        fetchNotes()
    }, [])


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
                        <Checkbox name="bulk-select-title" checked={checked} onCheckedChange={setChecked} />
                        <p className="text-lg">Title</p>
                    </div>
                    <div className="flex items-center gap-2 w-1/3">
                        <Checkbox name="bulk-select-tags" checked={checked} onCheckedChange={setChecked} />
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
                        notes.map(n => (
                            <div key={n.id} className="flex items-center gap-2 px-2 h-8 shrink-0 bg-card border-b">
                                <Checkbox name={`${n.id}-checkbox`} checked={checked} onCheckedChange={setChecked} />
                                <p className="truncate">{n.title}</p>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center gap-2 px-2 h-14 shrink-0 bg-card justify-between ">
                    <div className="flex flex-row gap-2 items-center">
                        <p>Items</p>
                        <Switch />
                        <p>Tags</p>
                    </div>
                    <AddItemButton size="sm" />
                </div>
            </div>
        </div>
    )
}

export { Library }