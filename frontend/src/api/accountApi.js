import { api } from "@/api/client"

export function authRateLimitMessage(response) {
    if (response?.status !== 429) return null

    const seconds = Number(response.headers.get("Retry-After"))
    if (!Number.isSafeInteger(seconds) || seconds <= 0) return "Too many attempts. Try again later."
    return `Too many attempts. Try again in ${seconds} ${seconds === 1 ? "second" : "seconds"}.`
}

export async function identityConflictMessage(response) {
    if (!(response instanceof Response) || response.status !== 409) return null
    const body = await response.json().catch(() => null)
    return typeof body?.detail === "string" ? body.detail : "Username or email already taken"
}

export async function deleteAccount(password, { signal } = {}) {
    try {
        await api("/auth/me", { method: "DELETE", json: { password }, signal })
    } catch (error) {
        if (signal?.aborted) throw error
        const fallback = "Could not confirm account deletion. Try again."
        if (!(error instanceof Response)) throw new Error(fallback)
        if (error.status === 401) throw new Error("Your session has expired. Sign in again.")
        const retryMessage = authRateLimitMessage(error)
        if (retryMessage) throw new Error(retryMessage, { cause: error })

        const body = await error.json().catch(() => null)
        const message = typeof body?.detail === "string" ? body.detail : fallback
        throw new Error(message, { cause: error })
    }
}
