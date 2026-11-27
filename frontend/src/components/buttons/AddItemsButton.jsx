import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem
} from "@/components/ui/dropdown-menu";

export function AddItemButton({ size, onSelectType, items }) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger render={
                <Button size={size} variant="outline">
                    <PlusIcon />
                </Button>
            }>
            </DropdownMenuTrigger>

            <DropdownMenuContent>
                {items.map(type => (
                    <DropdownMenuItem
                        key={type}
                        onClick={() => onSelectType(type.toLowerCase())}
                    >
                        {type}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}