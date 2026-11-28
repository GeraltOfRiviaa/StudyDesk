import { api } from "@/api/client";

// Links live in their own MongoDB collection, not inside the item document.
export async function syncItemLinks(sourceType, sourceId, selectedLinks = [], { signal, writeSignal = signal } = {}) {
    const request = (path, options) => {
        // Every step must stop if the originating modal or session ends.
        signal?.throwIfAborted();
        return api(path, { ...options, signal: options?.method ? writeSignal : signal });
    };
    const sourcePath = `/links/${sourceType}/${sourceId}`;
    const existingLinks = await request(sourcePath);
    const key = item => `${item.item_type}:${item.item_id.toLowerCase()}`;

    //written in the DB
    const existing = new Map(existingLinks.map(link => [key(link), link]));
    // selected in the form
    const selected = new Map(selectedLinks.map(link => [key(link), link]));

    // Add relationships selected in the form that do not exist in MongoDB.
    for (const [linkKey, link] of selected) {
        if (existing.has(linkKey)) continue;

        try {
            await request("/links/", {
                method: "POST",
                json: {
                    item_a_type: sourceType,
                    item_a_id: sourceId,
                    item_b_type: link.item_type,
                    item_b_id: link.item_id,
                },
            });
        } catch (error) {
            if (!(error instanceof Response) || error.status !== 409) throw error;
            const body = await error.clone().json().catch(() => null);
            if (body?.detail !== "Items are already linked") throw error;

            // A concurrent save may have created the link after the initial read.
            const currentLinks = await request(sourcePath);
            if (!currentLinks.some(current => key(current) === linkKey)) throw error;
        }
    }

    // Remove relationships that were deselected in the form.
    for (const [linkKey, link] of existing) {
        if (selected.has(linkKey)) continue;
        await request(`/links/${link.link_id}`, { method: "DELETE" });
    }
}
