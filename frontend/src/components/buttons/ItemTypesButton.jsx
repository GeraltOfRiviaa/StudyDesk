import { ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuGroup,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuCheckboxItem,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

const itemTypes = [
    { label: "Note", value: "notes" },
    { label: "File", value: "files" },
    { label: "Form", value: "forms" },
    { label: "Event", value: "events" },
]

export function ItemTypesButton({
    size,
    value = [],
    onChange,
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

                    {itemTypes.map(type => (
                        <DropdownMenuCheckboxItem
                            key={type.value}
                            checked={value.includes(type.value)}
                            onCheckedChange={() => toggleType(type.value)}
                        >
                            {type.label}
                        </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}