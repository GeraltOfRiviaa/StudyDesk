import { Search } from "@/components/ui/searches/search";
import { BulkActionsButton } from "@/components/ui/buttons/bulk-actions-button";
import { ItemTypesButton } from "@/components/ui/buttons/item-types-buttons";
import { Switch } from "@/components/ui/switch";
import { FilterButton } from "@/components/ui/buttons/filter-button";



function Library() {
    return (
        <div className="flex flex-col min-h-full mx-auto mt-5 px-4 gap-7 md:max-w-200 lg:max-w-250">
            <div className="mx-auto">
                <h1 className="font-bold text-4xl">Library</h1>
            </div>
            <div className="flex flex-col gap-2">
                <Search />
                <div className="flex flex-row justify-between">
                    <div className="flex flex-row gap-2">
                        <BulkActionsButton size="sm" />
                        <ItemTypesButton size="sm" />
                    </div>
                    <div>
                        <div className="flex flex-row gap-2 my-auto">
                            <p>Tags</p>
                            <Switch />
                            <p>Items</p>
                            <FilterButton />
                        </div>

                    </div>

                </div>
            </div>
            <div className="flex-1 border-2 p-4 mb-2 rounded-md justify-center">
                    <p>You have nothing here!</p>
                    <p>Start by adding a widget to the dashboard and creating an item there.</p>
            </div>
        </div>
    )
}

export { Library }