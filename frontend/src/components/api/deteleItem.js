import { api } from "@/api"

export const deleteItem = async ({ type, id }) => {
    try {
        await api(`/${type}/${id}`, { method: "DELETE" })
        return { type, id }
    } catch (error) {
        console.error(`Failed to delete ${type} ${id}:`, error)
        throw error
    }
}