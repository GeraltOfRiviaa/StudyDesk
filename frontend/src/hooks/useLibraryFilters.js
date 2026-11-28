import { useEffect } from "react"
import { useSearchParams } from "react-router-dom"

export function normalizeLibrarySort(params) {
    if (params.get("sort") !== "tags") return params
    const normalized = new URLSearchParams(params)
    normalized.set("sort", "updated_at")
    return normalized
}

export function useLibraryFilters() {
    const [searchParams, setSearchParams] = useSearchParams()
    const params = normalizeLibrarySort(searchParams)

    useEffect(() => {
        const normalized = normalizeLibrarySort(searchParams)
        if (normalized !== searchParams) setSearchParams(normalized, { replace: true })
    }, [searchParams, setSearchParams])

    // read filters from the URL or use default values
    const filters = {
        q: searchParams.get("q") ?? "",
        collections: searchParams.getAll("collections"),
        tags: searchParams.getAll("tags"),
        match: searchParams.get("match") ?? "any",
        sort: params.get("sort") ?? "updated_at",
        order: searchParams.get("order") ?? "desc",
    }

    // update a filter while preserving the other filters
    const setFilter = (key, value) => {
        setSearchParams(prev => {
            const params = new URLSearchParams(prev)

            params.delete(key)

            if (Array.isArray(value)) {
                value.forEach(item => params.append(key, item))
            } else if (value !== "" && value != null) {
                params.set(key, value)
            }

            return params
        }, { replace: true })
    }

    const resetFilters = ({ preserveItemFilters = false } = {}) => {
        setSearchParams(prev => {
            if (!preserveItemFilters) return new URLSearchParams()

            const params = new URLSearchParams(prev)
            for (const key of ["q", "sort", "order"]) {
                params.delete(key)
            }
            return params
        }, { replace: true })
    }

    return {
        filters,
        setFilter,
        resetFilters,
    }
}
