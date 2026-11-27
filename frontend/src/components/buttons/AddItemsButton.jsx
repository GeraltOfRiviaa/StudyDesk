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
                <Button size={size} variant="outline" aria-label="Add item">
                    <PlusIcon />
                </Button>
            }>
            </DropdownMenuTrigger>

            <DropdownMenuContent>
                {items.map(({ type, label, disabled }) => (
                    <DropdownMenuItem
                        key={type}
                        disabled={disabled}
                        onClick={() => onSelectType(type)}
                    >
                        {label}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
