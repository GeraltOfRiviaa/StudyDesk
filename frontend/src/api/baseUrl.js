export const LOCAL_API_URL = "http://localhost:8000"

export function normalizeApiBase(value) {
    const configured = value?.trim()
    if (!configured) return ""

    const base = configured.replace(/\/+$/, "")
    if (base && !/[\\\s?#]/.test(configured)) {
        // An ingress can serve the API under a same-origin prefix such as /api.
        if (base.startsWith("/") && !base.startsWith("//")) return base
        if (/^https?:\/\/[^/]/i.test(base)) {
            try {
                const url = new URL(base)
                if (!url.username && !url.password) return url.href.replace(/\/+$/, "")
            } catch {
                // Invalid absolute URLs use the same configuration error.
            }
        }
    }
    throw new Error("VITE_API_URL must be an HTTP(S) URL or a same-origin API prefix such as /api.")
}
