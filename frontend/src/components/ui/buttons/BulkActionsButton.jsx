import { ChevronDown } from "lucide-react";
import { Button } from "../button";
import { DropdownMenu, DropdownMenuGroup, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "../dropdown-menu";
import { useBulkDelete } from "@/components/api/useBulkDelete";

export function BulkActionsButton({ size, selected, onDeleted }) {
    const { bulkDelete } = useBulkDelete()

    const handleBulkDelete = async () => {
        try {
            const results = await bulkDelete(selected)
            await onDeleted?.(results)
        } catch (error) {
            console.error("Bulk deletion failed:", error)
        }
    }


    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="outline" size={size} className="rounded-lg px-2">  <ChevronDown data-icon="inline-start" /> Bulk actions</Button>} />
                <DropdownMenuContent>
                    <DropdownMenuGroup>
                        <DropdownMenuItem>
                            Set tags
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                            Unlink tags
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                            Unlink files
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" type="button" onClick={handleBulkDelete}>
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuGroup>
                </DropdownMenuContent>
            </DropdownMenu>
        </>
    )
}
