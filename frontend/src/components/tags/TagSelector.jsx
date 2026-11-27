import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@/context/AuthContext";
import { useDebounce } from "@/hooks/useDebounce";
import { useTagLookup } from "@/hooks/useTagLookup";
import { api } from "@/api/client";
import { TagBadge } from "@/components/tags/TagBadge";
import { X } from "lucide-react";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandItem,
    CommandList,
    CommandInput
} from "@/components/ui/command";


export function TagSelector({ value = [], onChange, allowCreate = true, disabled = false }) {
    const [tags, setTags] = useState([]);
    const [query, setQuery] = useState("");
    const [creating, setCreating] = useState(false);
    const [chosenTags, setChosenTags] = useState([]);
    const { user } = useUser();
    const search = useDebounce(query.trim());
    const tagSearch = useQuery({
        queryKey: ["tags", user?.id, "selector", search],
        queryFn: ({ signal }) => {
            const params = new URLSearchParams({ limit: "50" });
            if (search) params.set("q", search);
            return api(`/tags/?${params}`, { signal });
        },
        enabled: !allowCreate && !!user?.id,
    });
    const searching = !allowCreate && (search !== query.trim() || tagSearch.isPending);

    useEffect(() => {
        if (!allowCreate) return;
        api("/tags/?limit=30")
            .then(setTags)
            .catch(console.error);
    }, [allowCreate]);

    const missingTagIds = allowCreate
        ? value.filter(id => !tags.some(tag => tag.id === id))
        : [];
    const extraTags = useTagLookup(missingTagIds);
    const knownTags = allowCreate ? [...tags, ...extraTags] : chosenTags;
    const selectedTags = knownTags.filter(tag => value.includes(tag.id));

    const matches = allowCreate
        ? tags.filter(tag => query.trim() && tag.name.toLowerCase().includes(query.trim().toLowerCase()))
        : searching ? [] : tagSearch.data ?? [];
    const suggestions = matches.filter(tag => !value.includes(tag.id));

    function selectTag(tag) {
        if (disabled) return;

        if (!value.includes(tag.id)) {
            if (!allowCreate) setChosenTags(prev => [...prev, tag]);
            onChange([...value, tag.id]);
        }
        setQuery("");
    }

    function removeTag(id) {
        setChosenTags(prev => prev.filter(tag => tag.id !== id));
        onChange(value.filter(tagId => tagId !== id));
    }

    async function handleKeyDown(event) {
        // if the user didn't create a tag but still 
        // pressed Enter we don't want anything to happen
        if (event.key !== "Enter" || !query.trim()) return;

        // prevents the browser from doing something we 
        // don't need like saving or creating a note 
        event.preventDefault();


        const name = query.trim();

        // loop through already saved tags 
        // and compare if they match the one
        //  the user just typed
        // return the already created tag from earlier
        const existing = knownTags.find(tag =>
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

            <Command shouldFilter={false}>
                <CommandInput
                    value={query}
                    onValueChange={setQuery}
                    aria-label="Search tags"
                    placeholder={allowCreate ? "Search or create tags..." : "Search tags..."}
                    maxLength={allowCreate ? undefined : 50}
                    disabled={creating || disabled}
                    onKeyDown={event => {
                        if (allowCreate && event.key === "Enter" && suggestions.length === 0) {
                            handleKeyDown(event);
                        }
                    }}
                />

                {(!allowCreate || query.trim()) && (
                    <CommandList>
                        {searching && <p role="status" className="px-3 py-2">Searching tags…</p>}
                        {!allowCreate && !searching && tagSearch.isError && (
                            <p role="alert" className="px-3 py-2">Could not load tags. Try searching again.</p>
                        )}
                        <CommandGroup className="border my-2 rounded-md">
                            {suggestions.map(tag => (
                                <CommandItem
                                    key={tag.id}
                                    value={tag.id}
                                    disabled={disabled}
                                    onSelect={() => selectTag(tag)}
                                    className="mb-1 last:mb-0 cursor-pointer rounded-sm! px-3 py-2
                                            bg-transparent! hover:bg-accent!"
                                >
                                    <TagBadge tag={tag} />
                                </CommandItem>
                            ))}
                        </CommandGroup>

                        {!searching && (allowCreate || !tagSearch.isError) && suggestions.length === 0 && (
                            <CommandEmpty>
                                {allowCreate ? `Press Enter to create "${query.trim()}"` : "No matching tags."}
                            </CommandEmpty>
                        )}
                    </CommandList>
                )}
            </Command>



            <div className="flex flex-wrap pt-2">
                {selectedTags.map(tag => (
                    <div
                        key={tag.id}
                        className="flex items-center gap-1"
                    >
                        <TagBadge tag={tag} />

                        <button
                            type="button"
                            disabled={disabled}
                            onClick={() => removeTag(tag.id)}
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
