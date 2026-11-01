import { Filter } from "lucide-react";
import { Button } from "../button";
import {
    DropdownMenu,
    DropdownMenuGroup,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSub,
    DropdownMenuSubTrigger,
    DropdownMenuSubContent,
} from "../dropdown-menu";

export function FilterButton({ size }) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size={size} className="rounded-lg px-2"><Filter /></Button>} />
            <DropdownMenuContent>
                <DropdownMenuGroup>
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>Filter modes</DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            <DropdownMenuItem>Single</DropdownMenuItem>
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger>Group</DropdownMenuSubTrigger>
                                <DropdownMenuSubContent>
                                    <DropdownMenuItem>All</DropdownMenuItem>
                                    <DropdownMenuItem>Some</DropdownMenuItem>
                                </DropdownMenuSubContent>
                            </DropdownMenuSub>
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuItem>Manage tags</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive">Reset</DropdownMenuItem>
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}