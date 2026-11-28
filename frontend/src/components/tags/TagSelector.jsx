import { useLayoutEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { api } from "@/api/client";
import { TagBadge } from "@/components/tags/TagBadge";
import { Button } from "@/components/ui/button";
import { Command, CommandGroup, CommandItem, CommandList, CommandInput } from "@/components/ui/command";
import { toast } from "@/lib/toast";
import { useUser } from "@/context/AuthContext";
import { useTagLookup } from "@/hooks/useTagLookup";
import { useTagSearch } from "@/hooks/useTagSearch";
import { refreshAccountQueries } from "@/lib/accountQueries";

function tagLabelSuffixes(tags) {
    const byName = new Map();
    for (const tag of tags) {
        const name = tag.name.normalize("NFC").toLocaleLowerCase("en");
        const group = byName.get(name) ?? new Set();
        group.add(tag.id);
        byName.set(name, group);
    }
    const suffixes = new Map();
    for (const group of byName.values()) {
        if (group.size < 2) continue;
        const shortIds = new Set([...group].map(id => id.slice(-8)));
        for (const id of group) suffixes.set(id, shortIds.size === group.size ? id.slice(-8) : id);
    }
    return suffixes;
}

export function TagSelector({ value = [], onChange, allowCreate = true, disabled = false, modalSignal }) {
    const [query, setQuery] = useState("");
    const [chosenTags, setChosenTags] = useState([]);
    const [keyboardNavigation, setKeyboardNavigation] = useState(false);
    const { session } = useUser();
    const queryClient = useQueryClient();
    const pickerLifetime = useRef(null);
    const submitting = useRef(false);
    useLayoutEffect(() => {
        const controller = new AbortController();
        pickerLifetime.current = controller.signal;
        return () => controller.abort();
    }, []);

    const search = useTagSearch(query, !disabled);
    const selectedIds = [...new Set(value.map(id => id.toLowerCase()))];
    const lookedUp = useTagLookup(selectedIds);
    const known = new Map([...chosenTags, ...search.tags, ...lookedUp].map(tag => [tag.id, tag]));
    const suggestions = search.tags.filter(tag => !selectedIds.includes(tag.id));
    const selected = selectedIds.map(id => known.get(id) ?? { id });
    const suffixes = tagLabelSuffixes([...suggestions, ...selected.filter(tag => tag.name)]);

    const creation = useMutation({
        mutationFn: name => {
            session.signal.throwIfAborted();
            return api("/tags/", {
                method: "POST", json: { name, color: "#3b82f6" }, signal: session.signal,
            });
        },
        retry: false,
        onSettled: () => {
            // A tag is independent of its parent note. Refresh even when that form has closed.
            void refreshAccountQueries(queryClient, session, { library: false });
        },
    });
    const locked = disabled || creation.isPending;
    const name = query.trim();
    const canCreate = allowCreate && !!name && search.hasResults && !search.loading && !search.error;
    const optionClass = `mb-1 last:mb-0 min-w-0 cursor-pointer rounded-sm! px-3 py-2 bg-transparent!
        ${keyboardNavigation ? "data-[selected=true]:bg-accent!" : "hover:bg-accent!"}`;

    function handleNavigation(event) {
        if (event.defaultPrevented || event.nativeEvent.isComposing) return;
        const { key, ctrlKey } = event;
        if (["ArrowUp", "ArrowDown", "Home", "End"].includes(key) ||
            (ctrlKey && ["n", "p", "j", "k"].includes(key))) {
            // cmdk preselects an option on load. Highlight it only after keyboard navigation.
            setKeyboardNavigation(true);
        }
    }

    function selectTag(tag) {
        if (disabled || modalSignal?.aborted || session.signal.aborted) return;
        if (!selectedIds.includes(tag.id)) {
            setChosenTags(previous => [...previous, tag]);
            onChange([...selectedIds, tag.id]);
        }
        setQuery("");
        setKeyboardNavigation(false);
    }

    function removeTag(id) {
        if (locked || modalSignal?.aborted || session.signal.aborted) return;
        setChosenTags(previous => previous.filter(tag => tag.id !== id));
        onChange(selectedIds.filter(tagId => tagId !== id));
    }

    async function createTag() {
        const pickerSignal = pickerLifetime.current;
        const isObsolete = () => pickerSignal?.aborted || modalSignal?.aborted || session.signal.aborted;
        if (!canCreate || locked || submitting.current || isObsolete()) return;
        submitting.current = true;
        try {
            const created = await creation.mutateAsync(name);
            if (!isObsolete()) selectTag(created);
        } catch {
            if (!isObsolete()) toast.add({
                title: "Could not confirm tag creation",
                description: "Search for the tag before retrying.",
                type: "error",
            });
        } finally {
            submitting.current = false;
        }
    }

    function renderLabel(tag) {
        return (
            <>
                <TagBadge tag={tag} />
                {suffixes.has(tag.id) && <span className="shrink-0 text-xs text-muted-foreground">· {suffixes.get(tag.id)}</span>}
            </>
        );
    }

    return (
        <div className="flex min-w-0 flex-col gap-2">
            <Command
                shouldFilter={false}
                onKeyDown={handleNavigation}
                onPointerMove={() => setKeyboardNavigation(false)}
                onBlur={() => setKeyboardNavigation(false)}
            >
                <CommandInput
                    value={query}
                    onValueChange={value => {
                        setQuery(value);
                        setKeyboardNavigation(false);
                    }}
                    aria-label="Search tags"
                    placeholder={allowCreate ? "Search or create tags..." : "Search tags..."}
                    maxLength={50}
                    disabled={locked}
                    onKeyDown={event => {
                        // Let cmdk select an option. Without one, Enter must not submit the parent form.
                        if (event.key === "Enter" && (locked || (!suggestions.length && !canCreate))) event.preventDefault();
                    }}
                />
                <CommandList>
                    {search.loading && <p role="status" className="px-3 py-2">Searching tags…</p>}
                    {!search.loading && (suggestions.length > 0 || canCreate) && (
                        <CommandGroup className="border my-2 rounded-md">
                            {suggestions.map(tag => (
                                <CommandItem key={tag.id} value={tag.id} disabled={locked}
                                    onSelect={() => selectTag(tag)} className={optionClass}>
                                    {renderLabel(tag)}
                                </CommandItem>
                            ))}
                            {canCreate && (
                                <CommandItem key="create" value="create" disabled={locked}
                                    onSelect={createTag} className={optionClass}>
                                    Create “{name}”
                                </CommandItem>
                            )}
                        </CommandGroup>
                    )}
                    {!search.loading && !search.error && !suggestions.length && !search.hasMore && !canCreate && (
                        <p className="px-3 py-2 text-sm text-muted-foreground">No matching tags.</p>
                    )}
                </CommandList>
            </Command>
            {search.error && (
                <div className="flex items-center gap-2">
                    <p role="alert" className="text-sm">Could not load tags.</p>
                    <Button type="button" variant="outline" size="sm" disabled={locked} onClick={search.retry}>Retry</Button>
                </div>
            )}
            {search.hasMore && !search.error && (
                <Button type="button" size="sm" variant="outline" className="self-start"
                    disabled={locked || search.loadingMore} onClick={search.loadMore}>
                    {search.loadingMore ? "Loading tags…" : "Load more"}
                </Button>
            )}
            <div className="flex flex-wrap gap-1">
                {selected.map(tag => (
                    <div key={tag.id} className="flex min-w-0 max-w-full items-center gap-1">
                        {tag.name ? renderLabel(tag) : (
                            <span className="truncate text-sm text-muted-foreground">Tag · {tag.id.slice(-8)}</span>
                        )}
                        <button type="button" className="shrink-0" disabled={locked}
                            onClick={() => removeTag(tag.id)}
                            aria-label={`Remove ${tag.name ?? "tag"}${suffixes.has(tag.id) || !tag.name ? ` · ${suffixes.get(tag.id) ?? tag.id.slice(-8)}` : ""}`}>
                            <X className="size-3" />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
