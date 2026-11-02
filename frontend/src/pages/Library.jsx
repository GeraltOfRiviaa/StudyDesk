import { Search } from "@/components/ui/searches/search";
import { BulkActionsButton } from "@/components/ui/buttons/bulk-actions-button";
import { ItemTypesButton } from "@/components/ui/buttons/item-types-buttons";
import { Switch } from "@/components/ui/switch";
import { FilterButton } from "@/components/ui/buttons/filter-button";



function Library() {
    return (
        <div className="flex flex-col mx-auto mt-5 px-4 gap-7">
            <div className="mx-auto">
                <h1 className="font-bold text-4xl">Library</h1>
            </div>
            <div className="flex flex-col gap-2">
                <Search/>
                <div className="flex flex-row gap-2">
                    <BulkActionsButton size="sm"/>
                    <ItemTypesButton size="sm"/>
                    <div className="flex flex-row gap-2 my-auto">
                        <p>Tags</p>
                        <Switch/>
                        <p>Items</p>
                    </div>
                    <FilterButton/>
                </div>
            </div>
            <div>
                
                
            </div>
        </div>
    )
}

export { Library }