import { api } from "@/api/client"

export const deleteItem = async ({ type, id }, { signal } = {}) => {
    signal?.throwIfAborted()
    try {
        if (type === "tag"){
            const { deleted } = await api(`/${type}s/?ids=${id}&confirm=true`, { method: "DELETE", signal })
            return { type, id, deleted }
        }
        
        await api(`/${type}s/${id}`, { method: "DELETE", signal })

        return { type, id }
    } catch (error) {
        if (!signal?.aborted) console.error(`Failed to delete ${type} ${id}:`, error)
        throw error
    }
}
