
import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { X, Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandItem,
    CommandList,
    CommandInput,
} from "@/components/ui/command";
import { useItemModal } from "@/context/ItemsModalContext";
import { Button } from "../ui/button";


export function LinkSelector({
    value = [],
    onChange,
    sourceType = null,
    sourceId = null,
}) {
    const [items, setItems] = useState([]);
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const { openItem } = useItemModal();

    // Search matching items in the database
    useEffect(() => {
        if (!query.trim()) {
            setItems([]);
            setLoading(false);
            return;
        }

        let active = true;
        setLoading(true);

        // Debounce requests while typing
        const timeout = setTimeout(async () => {
            try {
                const params = new URLSearchParams({
                    q: query.trim(),
                    limit: "20",
                });

                if (sourceType && sourceId) {
                    params.set("source_type", sourceType);
                    params.set("source_id", sourceId);
                }

                const results = await api(
                    `/links/items?${params.toString()}`
                );

                if (active) setItems(results);
            } catch (error) {
                if (active) {
                    console.error("Could not search items", error);
                    setItems([]);
                }
            } finally {
                if (active) setLoading(false);
            }
        }, 300);

        return () => {
            active = false;
            clearTimeout(timeout);
        };
    }, [query, sourceType, sourceId]);


    // Exclude items already selected
    const suggestions = items.filter(item =>
        !value.some(link =>
            link.item_id === item.id &&
            link.item_type === item.type
        )
    );


    function selectLink(item) {
        const exists = value.some(link =>
            link.item_id === item.id &&
            link.item_type === item.type
        );

        if (!exists) {
            onChange([
                ...value,
                {
                    item_id: item.id,
                    item_type: item.type,
                    title: item.title,
                },
            ]);
        }

        setQuery("");
        setItems([]);
    }


    function removeLink(link) {
        onChange(value.filter(item =>
            !(item.item_id === link.item_id &&
                item.item_type === link.item_type)
        ));
    }


    return (
        <div className="flex flex-col gap-2">

            <Command shouldFilter={false}>
                <CommandInput
                    value={query}
                    onValueChange={setQuery}
                    placeholder="Search items to link..."
                />

                {query.trim() && (
                    <CommandList>
                        <CommandGroup className="border my-2 rounded-md">
                            {suggestions.map(item => (
                                <CommandItem
                                    key={`${item.type}-${item.id}`}
                                    value={`${item.type}-${item.id}`}
                                    onSelect={() => selectLink(item)}
                                    className="mb-1 last:mb-0 cursor-pointer rounded-sm! px-3 py-2 bg-transparent! hover:bg-accent!"
                                >
                                    <Link2 className="size-4 mr-2" />

                                    <span className="flex-1 truncate">
                                        {item.title}
                                    </span>

                                    <Badge variant="secondary">
                                        {item.type}
                                    </Badge>
                                </CommandItem>
                            ))}
                        </CommandGroup>

                        {suggestions.length === 0 && (
                            <CommandEmpty>
                                {loading
                                    ? "Searching..."
                                    : "No matching items found"}
                            </CommandEmpty>
                        )}
                    </CommandList>
                )}
            </Command>


            <div className="flex flex-wrap gap-2 pt-2">
                {value.map(link => (
                    <div
                        key={`${link.item_type}-${link.item_id}`}
                        className="flex items-center gap-1"
                    >
                        <Badge
                            variant="outline"
                            className="flex items-center gap-2"
                        >
                            <Link2 className="size-3"/>
                            <Button
                                type="button"
                                onClick={() => openItem(link.item_type, link.item_id)}
                                variant="ghost"
                            >
                                {link.title}
                            </Button>

                            <span className="text-muted-foreground">
                                {link.item_type}
                            </span>
                        </Badge>

                        <button
                            type="button"
                            onClick={() => removeLink(link)}
                            aria-label={`Remove ${link.title}`}
                        >
                            <X className="size-3" />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
