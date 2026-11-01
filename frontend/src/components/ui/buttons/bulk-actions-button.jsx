import { ChevronDown } from "lucide-react";
import { Button } from "../button";
import { DropdownMenu, DropdownMenuGroup, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "../dropdown-menu";

export function BulkActionsButton({size}) {
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
                    <DropdownMenuItem className="text-destructive">
                        Delete
                    </DropdownMenuItem>
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    </>
    )
}
