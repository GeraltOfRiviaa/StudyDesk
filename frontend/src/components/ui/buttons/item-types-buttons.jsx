import { ChevronDown } from "lucide-react";
import { Button } from "../button";
import { DropdownMenu, DropdownMenuGroup, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "../dropdown-menu";

export function ItemTypesButton({size}) {
    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="outline" size={size} className="rounded-lg px-2">  <ChevronDown data-icon="inline-start" /> Types</Button>} />
                <DropdownMenuContent>
                    <DropdownMenuGroup>
                        <DropdownMenuItem>
                            All
                        </DropdownMenuItem>
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
