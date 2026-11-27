import { useSearchParams } from "react-router-dom"

export function useLibraryFilters() {
    const [searchParams, setSearchParams] = useSearchParams()

    // read filters from the URL or use default values
    const filters = {
        q: searchParams.get("q") ?? "",
        collections: searchParams.getAll("collections"),
        tags: searchParams.getAll("tags"),
        match: searchParams.get("match") ?? "any",
        sort: searchParams.get("sort") ?? "updated_at",
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

    // Remove all filters and restore default values
    const resetFilters = () => {
        setSearchParams({}, { replace: true })
    }

    return {
        filters,
        setFilter,
        resetFilters,
    }
}