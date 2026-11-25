import { api } from "@/api/client"


// basically takes all the parameter and converts
// the into a query string and then calls the api
// with them
export async function fetchLibrary({
    collections,
    q,
    ids,
    tags,
    match,
    sort = "updated_at",
    order = "desc",
    limit = 30,
    cursor,
    signal,
} = {}) {
    //convert function params to URL params
    const params = new URLSearchParams()

    //for each collection specified append them to the query
    collections?.forEach(collection =>
        params.append("collections", collection)
    )

    //append IDs and tags to filter items by them
    ids?.forEach(id => params.append("ids", id))
    tags?.forEach(tag => params.append("tags", tag))

    //add more params if set
    if (q) params.set("q", q)
    if (match) params.set("match", match)
    if (cursor) params.set("cursor", cursor)

    params.set("sort", sort)
    params.set("order", order)
    params.set("limit", String(limit))

    //make the API call and pass the signal
    //to allow TanStack Query to cancel the request
    return api(`/library?${params.toString()}`, {
        method: "GET",    
        signal,
    })
}