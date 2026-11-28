import { useQueries } from "@tanstack/react-query"
import { api } from "@/api/client"
import { useUser } from "@/context/AuthContext"

const MAX_LOOKUP_IDS = 100

export function tagLookupOptions(session, ids) {
    if (!session) return []
    const tagIds = [...new Set(ids.filter(id => /^[a-f\d]{24}$/i.test(id)).map(id => id.toLowerCase()))]
    const queries = []
    // Chunk in first-seen order so appended Library rows leave completed batches intact.
    for (let start = 0; start < tagIds.length; start += MAX_LOOKUP_IDS) {
        const batch = tagIds.slice(start, start + MAX_LOOKUP_IDS).sort()
        queries.push({
            queryKey: ["tags", session.userId, "lookup", batch],
            queryFn: ({ signal }) => {
                session.signal.throwIfAborted()
                return api("/tags/lookup", {
                    method: "POST",
                    json: { ids: batch },
                    signal: AbortSignal.any([signal, session.signal]),
                })
            },
        })
    }
    return queries
}

export function useTagLookup(ids) {
    const { session } = useUser()
    const results = useQueries({ queries: tagLookupOptions(session, ids) })
    return results.flatMap(result => result.data ?? [])
}
