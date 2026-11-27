import { api } from "@/api/client"

// Keep these limits in sync with the bulk request models.
const MAX_BULK_ITEMS = 100
export const MAX_BULK_TAGS = 100

async function postBatches(path, items, tags) {
    if (!items.length) throw new Error("Select at least one item.")

    let completed = 0
    let matched = 0
    let deleted = 0

    for (let start = 0; start < items.length; start += MAX_BULK_ITEMS) {
        const batch = items.slice(start, start + MAX_BULK_ITEMS)
        const json = tags ? { items: batch, tags } : { items: batch }

        try {
            const result = await api(path, { method: "POST", json })
            matched += result.matched ?? 0
            deleted += result.deleted ?? 0
            completed += batch.length
        } catch (cause) {
            const body = cause instanceof Response
                ? await cause.json().catch(() => null)
                : null
            const message = typeof body?.detail === "string"
                ? body.detail
                : "Try again later."

            throw Object.assign(new Error(message, { cause }), { completed })
        }
    }

    return { matched, deleted }
}

export async function bulkSetTags({ items, tags }) {
    if (!tags.length || tags.length > MAX_BULK_TAGS) {
        throw new Error(`Select between 1 and ${MAX_BULK_TAGS} tags.`)
    }

    return postBatches("/bulk/tags/add", items, tags)
}

export function bulkUnlinkTags({ items }) {
    return postBatches("/bulk/tags/remove", items)
}

export function bulkRemoveLinks({ items }) {
    return postBatches("/bulk/links/remove", items)
}
