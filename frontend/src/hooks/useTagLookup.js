import { useQuery } from "@tanstack/react-query"
import { api } from "@/api/client"
import { useUser } from "@/context/AuthContext"

export function useTagLookup(ids) {
    const { user } = useUser()
    const tagIds = [...new Set(ids)].sort()

    const { data } = useQuery({
        queryKey: ["tags", user?.id, "lookup", tagIds],
        queryFn: ({ signal }) => api("/tags/lookup", {
            method: "POST",
            json: { ids: tagIds },
            signal,
        }),
        enabled: !!user?.id && tagIds.length > 0,
    })

    return data ?? []
}
