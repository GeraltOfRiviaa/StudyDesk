import { bulkRemoveLinks } from "@/api/bulkApi"
import { useBulkMutation } from "@/hooks/useBulkMutation"
import { bulkLinkFeedback } from "@/lib/bulkFeedback"

export function useBulkRemoveLinks() {
    return useBulkMutation({
        mutationFn: bulkRemoveLinks,
        feedback: bulkLinkFeedback,
        errorTitle: "Could not remove links",
    })
}
