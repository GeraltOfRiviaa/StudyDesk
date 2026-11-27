import { bulkUnlinkTags } from "@/api/bulkApi"
import { useBulkMutation } from "@/hooks/useBulkMutation"

export function useBulkUnlinkTags() {
    return useBulkMutation({
        mutationFn: bulkUnlinkTags,
        successMessage: ({ matched }) => `Tags cleared from ${matched} selected ${matched === 1 ? "item" : "items"}`,
        errorTitle: "Could not clear tags",
        changesTags: true,
    })
}
