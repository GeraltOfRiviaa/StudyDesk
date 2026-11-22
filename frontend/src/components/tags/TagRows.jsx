import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useItemModal } from "@/components/ItemsModalContext";

const formatDate = (date) => date ? new Date(date).toLocaleDateString() : "—";

export function TagRow({ tag, selected, onToggle}) {
    const { openItem } = useItemModal();

    return (
            <div className="grid grid-cols-[minmax(0,1fr)] sm:grid-cols-[minmax(0,1fr)_7rem] md:grid-cols-[minmax(0,1fr)_8rem_8rem] items-center gap-2 px-2 min-h-9 border-b">
                <div className="flex min-w-0 items-center gap-2">
                    <Checkbox
                        checked={selected.has(tag.id)}
                        onCheckedChange={() => onToggle(tag.id)}
                    />
                    <span
                        className="size-3 shrink-0 rounded-full"
                        style={{ backgroundColor: tag.color }}
                    />
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => openItem("tag", tag.id, "update")}
                        className="min-w-0 flex-1 truncate text-left justify-start"
                    >
                        {tag.name}
                    </Button>
                </div>
                <span className="hidden truncate text-sm text-muted-foreground sm:block">
                    {formatDate(tag.created_at)}
                </span>
                <span className="hidden truncate text-sm text-muted-foreground md:block">
                    {formatDate(tag.updated_at)}
                </span>
            </div>
    );
}