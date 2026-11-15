import { ChevronDown, PlusIcon } from "lucide-react";
import { Button } from "../button";
import { DropdownMenu, DropdownMenuGroup, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "../dropdown-menu";

export function AddItemButton({size}) {
    return (
    <>
        <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size={size} className="rounded-lg px-2"><PlusIcon/></Button>} />
            <DropdownMenuContent>
                <DropdownMenuGroup>
                    <DropdownMenuItem>
                        Note
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                        File
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                        Form
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                        Event
                    </DropdownMenuItem>
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    </>
    )
}