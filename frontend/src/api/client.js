

export async function api(path, { method = "GET", json, body, ...rest } = {}) {
    const API = import.meta.env.VITE_API_URL
    const res = await fetch(API + path, {
        method,
        credentials: "include",
        headers: json ? { "Content-Type": "application/json" } : undefined,
        body: json ? JSON.stringify(json) : body,
        ...rest,
    })
    if (!res.ok) throw res
    return res.status === 204 ? null : res.json()
}