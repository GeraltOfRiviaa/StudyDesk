import { api } from "@/api/client"
import { deleteItem } from "@/api/deleteItem"

// Keep these limits in sync with the bulk request models.
const MAX_BULK_ITEMS = 100
export const MAX_BULK_TAGS = 100

export function bulkTargetKey({ type, id }) {
    return `${type}:${id.toLowerCase()}`
}

export function bulkErrorDescription(error, targetCount, countField, label) {
    const completed = error.completedItems?.length ?? 0
    const confirmed = error[countField]
    if (!completed && confirmed === undefined) return error.message
    const countLabel = confirmed === 1 ? label.slice(0, -1) : label
    return `${error.message} ${completed} of ${targetCount} targets completed. ${confirmed ?? 0} ${countLabel} confirmed.`
}

async function postBatches(path, items, tags, signal) {
    if (!items.length) throw new Error("Select at least one item.")

    const completedItems = []
    let matched = 0
    let modified = 0
    let deleted = 0
    let skipped = 0

    for (let start = 0; start < items.length; start += MAX_BULK_ITEMS) {
        // Never send the next batch after its originating session has ended.
        signal?.throwIfAborted()
        const batch = items.slice(start, start + MAX_BULK_ITEMS)
        const json = tags ? { items: batch, tags } : { items: batch }

        try {
            const result = await api(path, { method: "POST", json, signal })
            matched += result.matched ?? 0
            modified += result.modified ?? 0
            deleted += result.deleted ?? 0
            skipped += result.skipped ?? 0
            completedItems.push(...batch)
        } catch (cause) {
            const body = cause instanceof Response
                ? await cause.json().catch(() => null)
                : null
            const detail = body?.detail
            const message = typeof detail === "string" ? detail : detail?.message

            // Only trust completed IDs that also belong to the batch that failed.
            const acknowledged = cause?.status === 503 && Array.isArray(detail?.completed_items)
                ? detail.completed_items.filter(item => typeof item?.id === "string")
                : []
            const acknowledgedKeys = new Set(acknowledged.map(bulkTargetKey))
            completedItems.push(...batch.filter(item => acknowledgedKeys.has(bulkTargetKey(item))))
            throw Object.assign(new Error(message ?? "Try again later.", { cause }), {
                completedItems,
                matched: matched + (detail?.matched ?? 0),
                modified: modified + (detail?.modified ?? 0),
                deleted: deleted + (detail?.deleted ?? 0),
            })
        }
    }

    return { matched, modified, deleted, skipped }
}

export async function bulkSetTags({ items, tags, signal }) {
    if (!tags.length || tags.length > MAX_BULK_TAGS) {
        throw new Error(`Select between 1 and ${MAX_BULK_TAGS} tags.`)
    }

    return postBatches("/bulk/tags/add", items, tags, signal)
}

export function bulkUnlinkTags({ items, signal }) {
    return postBatches("/bulk/tags/remove", items, undefined, signal)
}

export function bulkRemoveLinks({ items, signal }) {
    return postBatches("/bulk/links/remove", items, undefined, signal)
}

export function bulkDeleteItems({ items, signal }) {
    return postBatches("/bulk/delete", items, undefined, signal)
}

export async function bulkDeleteTags(items, { signal } = {}) {
    signal?.throwIfAborted()
    const results = await Promise.allSettled(items.map(item => deleteItem(item, { signal })))
    const completedItems = []
    let deleted = 0
    let skipped = 0

    results.forEach((result, index) => {
        if (result.status === "fulfilled") {
            completedItems.push(items[index])
            deleted += result.value.deleted
            if (!result.value.deleted) skipped += 1
        } else if (result.reason?.status === 404) {
            // Unavailable tags need no retry, but are not counted as deleted by this attempt.
            completedItems.push(items[index])
            skipped += 1
        }
    })

    if (completedItems.length < items.length) {
        throw Object.assign(new Error("Some tags could not be removed. Refresh and retry the remaining tags."), {
            completedItems, deleted,
        })
    }
    return { deleted, skipped, completedItems }
}
