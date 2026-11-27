import { bulkSetTags } from "@/api/bulkApi"
import { useBulkMutation } from "@/hooks/useBulkMutation"

export function useBulkSetTags() {
    return useBulkMutation({
        mutationFn: bulkSetTags,
        successMessage: ({ matched }) => `Tags applied to ${matched} selected ${matched === 1 ? "item" : "items"}`,
        errorTitle: "Could not apply tags",
        changesTags: true,
    })
}
