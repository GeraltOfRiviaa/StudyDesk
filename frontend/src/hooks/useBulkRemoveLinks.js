import { bulkRemoveLinks } from "@/api/bulkApi"
import { useBulkMutation } from "@/hooks/useBulkMutation"

export function useBulkRemoveLinks() {
    return useBulkMutation({
        mutationFn: bulkRemoveLinks,
        successMessage: ({ deleted }) => deleted
            ? `Removed ${deleted} ${deleted === 1 ? "link" : "links"}`
            : "The selected items had no links",
        errorTitle: "Could not remove links",
    })
}
