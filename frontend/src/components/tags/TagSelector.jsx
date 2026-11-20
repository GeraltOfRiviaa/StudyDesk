
import { useEffect, useState } from "react";
import { api } from "@/api";
import { TagBadge } from "@/components/tags/TagBadge";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";

export function TagSelector({ value = [], onChange }) {
    const [tags, setTags] = useState([]);
    const [query, setQuery] = useState("");
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        api("/tags/?limit=100")
            .then(setTags)
            .catch(console.error);
    }, []);

    const selectedTags = tags.filter(tag =>
        value.includes(tag.id)
    );

    const suggestions = query.trim()
        ? tags.filter(tag =>
            tag.name.toLowerCase().includes(query.trim().toLowerCase()) &&
            !value.includes(tag.id)
        )
        : [];

    function selectTag(tag) {
        if (!value.includes(tag.id)) {
            onChange([...value, tag.id]);
        }
        setQuery("");
    }

    async function handleKeyDown(event) {
        if (event.key !== "Enter" || !query.trim()) return;

        event.preventDefault();

        const name = query.trim();

        // Reuse an existing tag with the same name.
        const existing = tags.find(tag =>
            tag.name.toLowerCase() === name.toLowerCase()
        );

        if (existing) {
            selectTag(existing);
            return;
        }

        if (creating) return;

        setCreating(true);

        try {
            const created = await api("/tags/", {
                method: "POST",
                json: {
                    name,
                    color: "#3b82f6",
                },
            });

            setTags(prev => [...prev, created]);
            selectTag(created);
        } catch (error) {
            console.error("Could not create tag", error);
        } finally {
            setCreating(false);
        }
    }

    return (
        <div className="flex flex-col gap-2">
            <Input
                value={query}
                placeholder="Search or create tags..."
                disabled={creating}
                onChange={event => setQuery(event.target.value)}
                onKeyDown={handleKeyDown}
            />

            {suggestions.length > 0 && (
                <div className="rounded-md border p-1">
                    {suggestions.map(tag => (
                        <button
                            key={tag.id}
                            type="button"
                            className="flex w-full p-2 hover:bg-accent rounded-sm"
                            onClick={() => selectTag(tag)}
                        >
                            <TagBadge tag={tag} />
                        </button>
                    ))}
                </div>
            )}

            <div className="flex flex-wrap gap-2">
                {selectedTags.map(tag => (
                    <div
                        key={tag.id}
                        className="flex items-center gap-1"
                    >
                        <TagBadge tag={tag} />

                        <button
                            type="button"
                            onClick={() =>
                                onChange(value.filter(id => id !== tag.id))
                            }
                            aria-label={`Remove ${tag.name}`}
                        >
                            <X className="size-3" />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
