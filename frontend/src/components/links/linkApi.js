import { api } from "@/api";

// Links live in their own MongoDB collection, not inside the item document.
export async function syncItemLinks(sourceType, sourceId, selectedLinks = []) {
    const existingLinks = await api(`/links/${sourceType}/${sourceId}`);
    const key = item => `${item.item_type}:${item.item_id}`;

    const existing = new Map(existingLinks.map(link => [key(link), link]));
    const selected = new Map(selectedLinks.map(link => [key(link), link]));

    // Add relationships selected in the form that do not exist in MongoDB.
    for (const [linkKey, link] of selected) {
        if (existing.has(linkKey)) continue;

        await api("/links/", {
            method: "POST",
            json: {
                item_a_type: sourceType,
                item_a_id: sourceId,
                item_b_type: link.item_type,
                item_b_id: link.item_id,
            },
        });
    }

    // Remove relationships that were deselected in the form.
    for (const [linkKey, link] of existing) {
        if (selected.has(linkKey)) continue;
        await api(`/links/${link.link_id}`, { method: "DELETE" });
    }
}
