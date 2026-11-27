import { useState } from "react"
import { toast } from "@/components/ui/toast"
import { deleteItem } from "@/api/deleteItem"

export const useBulkDelete = () => {
    const [isDeleting, setIsDeleting] = useState(false)

    const bulkDelete = async (selectedItems = []) => {
        if (isDeleting || selectedItems.length === 0) return

        setIsDeleting(true)

        try {
            const results = await Promise.allSettled(
                selectedItems.map(item =>
                    deleteItem({ type: item.type, id: item.id })
                )
            )

            const successful = results.filter(
                result => result.status === "fulfilled"
            ).length

            const failed = results.length - successful

            toast.add({
                title: "Bulk deletion completed",
                description: `Deleted: ${successful}, Failed: ${failed}`,
                type: failed > 0 ? "error" : "success",
            })

            return { successful, failed, results }

        } finally {
            setIsDeleting(false)
        }
    }

    return { bulkDelete, isDeleting }
}