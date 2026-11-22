import { Checkbox } from "@/components/ui/checkbox";
import { TagBadge } from "../tags/TagBadge";
import { Badge } from "@/components/ui/badge";
import { useItemModal } from "../ItemsModalContext";
import { Button } from "../ui/button";

export function NoteRow({ note, selected, onToggle, tags }) {
    const { openItem } = useItemModal();

    const noteTags = tags.filter(tag => note.tags?.includes(tag.id));

    const formatDate = (date) =>
        date ? new Date(date).toLocaleDateString() : "—";

    return (
        <div className="grid grid-cols-[minmax(0,1fr)_7rem] md:grid-cols-[minmax(0,1fr)_11rem_7rem] lg:grid-cols-[minmax(0,1fr)_14rem_8rem_8rem] items-center gap-2 px-2 min-h-9 border-b">
            {/* Row uses the same columns as the Library header */}
            <div className="flex min-w-0 items-center gap-2">
                <Checkbox
                    checked={selected.has(note.id)}
                    onCheckedChange={() => onToggle(note.id)}
                />
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => openItem("note", note.id, "update")}
                    className="min-w-0 flex-1 truncate text-left hover:underline justify-start"
                >
                    {note.title}
                </Button>
            </div>

            <div className="flex min-w-0 items-center gap-1 overflow-hidden">
                {noteTags.slice(0, 3).map((tag, index) => (
                    <div
                        key={tag.id}
                        className={`min-w-0 shrink ${index === 1 ? "hidden md:block" : index === 2 ? "hidden lg:block" : "block"}`}
                    >
                        <div className="min-w-0 truncate *:max-w-full *:truncate">
                            <TagBadge tag={tag} />
                        </div>
                    </div>
                ))}
                {noteTags.length > 1 && (
                    <Badge variant="secondary" className="md:hidden shrink-0">
                        +{noteTags.length - 1}
                    </Badge>
                )}

                {noteTags.length > 2 && (
                    <Badge variant="secondary" className="hidden md:flex lg:hidden shrink-0">
                        +{noteTags.length - 2}
                    </Badge>
                )}

                {noteTags.length > 3 && (
                    <Badge variant="secondary" className="hidden lg:flex shrink-0">
                        +{noteTags.length - 3}
                    </Badge>
                )}
            </div>

            <span className="hidden truncate text-sm text-muted-foreground md:block">
                {formatDate(note.created_at)}
            </span>
            <span className="hidden truncate text-sm text-muted-foreground lg:block">
                {formatDate(note.updated_at)}
            </span>
        </div>
    );
}
