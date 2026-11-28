import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TagBadge } from "@/components/tags/TagBadge";
import { useItemModal } from "@/context/ItemsModalContext";
import { ITEM_TYPES } from "@/lib/itemTypes";

function formatDate(date) {
    return date ? new Date(date).toLocaleDateString() : "—";
}

export function LibraryRow({ item, tags, selected, onToggle }) {
    const { openItem } = useItemModal();
    const { type, id, title } = item;
    const itemType = ITEM_TYPES[type];
    const Icon = itemType?.Icon;
    const itemTags = tags.filter(tag => item.tags?.includes(tag.id));

    return (
        <div className="grid grid-cols-[minmax(0,1fr)_7rem] md:grid-cols-[minmax(0,1fr)_11rem_7rem] lg:grid-cols-[minmax(0,1fr)_14rem_8rem_8rem] items-center gap-2 px-2 min-h-9 border-b">
            <div className="flex min-w-0 items-center gap-2">
                <Checkbox
                    aria-label={`Select ${itemType?.label ?? "item"} ${title}`}
                    checked={selected.has(`${type}:${id}`)}
                    onCheckedChange={() => onToggle(type, id)}
                />
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => openItem(type, id)}
                    className="min-w-0 flex-1 truncate text-left hover:underline justify-start"
                >
                    {type !== "note" && Icon && <Icon aria-hidden="true" />}
                    <span className="truncate">{title}</span>
                </Button>
            </div>

            <div className="flex min-w-0 items-center gap-1 overflow-hidden">
                {itemTags.slice(0, 3).map((tag, index) => (
                    <div
                        key={tag.id}
                        className={`min-w-0 shrink ${index === 1 ? "hidden md:block" : index === 2 ? "hidden lg:block" : "block"}`}
                    >
                        <TagBadge tag={tag} />
                    </div>
                ))}
                {itemTags.length > 1 && (
                    <Badge variant="secondary" className="md:hidden shrink-0">
                        +{itemTags.length - 1}
                    </Badge>
                )}
                {itemTags.length > 2 && (
                    <Badge variant="secondary" className="hidden md:flex lg:hidden shrink-0">
                        +{itemTags.length - 2}
                    </Badge>
                )}
                {itemTags.length > 3 && (
                    <Badge variant="secondary" className="hidden lg:flex shrink-0">
                        +{itemTags.length - 3}
                    </Badge>
                )}
            </div>

            <span className="hidden truncate text-sm text-muted-foreground md:block">
                {formatDate(item.created_at)}
            </span>
            <span className="hidden truncate text-sm text-muted-foreground lg:block">
                {formatDate(item.updated_at)}
            </span>
        </div>
    );
}
