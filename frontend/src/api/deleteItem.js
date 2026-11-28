import { api } from "@/api/client"

export const deleteItem = async ({ type, id }) => {
    try {
        if (type === "tag"){
            const { deleted } = await api(`/${type}s/?ids=${id}&confirm=true`, { method: "DELETE" })
            return { type, id, deleted }
        }
        
        await api(`/${type}s/${id}`, { method: "DELETE" })

        return { type, id }
    } catch (error) {
        console.error(`Failed to delete ${type} ${id}:`, error)
        throw error
    }
}
