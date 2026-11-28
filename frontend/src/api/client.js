import { LOCAL_API_URL, normalizeApiBase } from "./baseUrl"

const apiBase = normalizeApiBase(import.meta.env.VITE_API_URL) || LOCAL_API_URL
const AUTH_CONTROL_PATHS = new Set(["/auth/login", "/auth/register", "/auth/logout", "/auth/user"])
let sessionVerification

export function registerSessionVerification({ capture, verify }) {
    const registration = { capture, verify }
    sessionVerification = registration
    return () => {
        if (sessionVerification === registration) sessionVerification = undefined
    }
}

export async function api(path, { method = "GET", json, body, ...rest } = {}) {
    const pathname = path.split(/[?#]/, 1)[0].replace(/\/+$/, "")
    // Auth control requests must bypass the observer, especially the status check itself.
    const verification = AUTH_CONTROL_PATHS.has(pathname) ? undefined : sessionVerification
    const scope = verification?.capture()
    const res = await fetch(apiBase + path, {
        method,
        credentials: "include",
        headers: json ? { "Content-Type": "application/json" } : undefined,
        body: json ? JSON.stringify(json) : body,
        ...rest,
    })
    if (res.status === 401 && scope && verification === sessionVerification) {
        try {
            await verification.verify(scope)
        } catch {
            // Verification is best effort. The original response belongs to the caller.
        }
    }
    if (!res.ok) throw res
    return res.status === 204 ? null : res.json()
}
