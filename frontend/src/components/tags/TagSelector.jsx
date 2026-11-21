
import { useEffect, useState } from "react";
import { api } from "@/api";
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

    // [] at start
    // after user start typing we trim the query
    const suggestions = query.trim()
        // we try to find any tags that fit the criteria
        // if we find any we assign that array to suggestions
        ? tags.filter(tag =>
            // criteria = any tag that contains exactly our query
            tag.name.toLowerCase().includes(query.trim().toLowerCase()) &&
            // and also is not present in the array of already used tags
            !value.includes(tag.id)
        )
        // the query has nothing we give nothing back
        : [];

    function selectTag(tag) {
        if (!value.includes(tag.id)) {
            // sends the already listed tags + the new tag
            // back into the form
            onChange([...value, tag.id]);
        }
        setQuery("");
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

            <Command shouldFilter={false}>
                <CommandInput
                    value={query}
                    onValueChange={setQuery}
                    placeholder="Search or create tags..."
                    disabled={creating}
                    onKeyDown={event => {
                        if (event.key === "Enter" && suggestions.length === 0) {
                            handleKeyDown(event);
                        }
                    }}
                />

                {query.trim() && (
                    <CommandList>
                        <CommandGroup className="border my-2 rounded-md">
                            {suggestions.map(tag => (
                                <CommandItem
                                    key={tag.id}
                                    value={tag.id}
                                    onSelect={() => selectTag(tag)}
                                    className="mb-1 last:mb-0 cursor-pointer rounded-sm! px-3 py-2
                                            bg-transparent! hover:bg-accent!"
                                >
                                    <TagBadge tag={tag} />
                                </CommandItem>
                            ))}
                        </CommandGroup>

                        {suggestions.length === 0 && (
                            <CommandEmpty>
                                Press Enter to create "{query.trim()}"
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
