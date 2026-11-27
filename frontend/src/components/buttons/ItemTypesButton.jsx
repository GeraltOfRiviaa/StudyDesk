import { ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ITEM_TYPES } from "@/lib/itemTypes"
import {
    DropdownMenu,
    DropdownMenuGroup,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuCheckboxItem,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

const itemTypes = Object.values(ITEM_TYPES)

export function ItemTypesButton({
    size,
    value = [],
    onChange,
    disabled = false,
}) {
    const allSelected = value.length === 0

    const toggleType = (type) => {
        const next = value.includes(type)
            ? value.filter(item => item !== type)
            : [...value, type]

        // An empty array represents all collections
        onChange?.(
            next.length === itemTypes.length ? [] : next
        )
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                disabled={disabled}
                render={
                    <Button
                        variant="outline"
                        size={size}
                        className="rounded-lg px-2"
                    >
                        <ChevronDown data-icon="inline-start" />

                        Types {value.length > 0 && `(${value.length})`}
                    </Button>
                }
            />

            <DropdownMenuContent>
                <DropdownMenuGroup>
                    <DropdownMenuCheckboxItem
                        checked={allSelected}
                        onCheckedChange={() => onChange?.([])}
                    >
                        All
                    </DropdownMenuCheckboxItem>

                    <DropdownMenuSeparator />

                    {itemTypes.map(({ collection, label }) => (
                        <DropdownMenuCheckboxItem
                            key={collection}
                            checked={value.includes(collection)}
                            onCheckedChange={() => toggleType(collection)}
                        >
                            {label}
                        </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
