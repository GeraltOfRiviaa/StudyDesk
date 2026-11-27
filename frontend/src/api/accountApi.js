import { api } from "@/api/client"

export async function deleteAccount(password) {
    try {
        await api("/auth/me", { method: "DELETE", json: { password } })
    } catch (error) {
        const fallback = "Could not confirm account deletion. Try again."
        if (!(error instanceof Response)) throw new Error(fallback)
        if (error.status === 401) throw new Error("Your session has expired. Sign in again.")

        const body = await error.json().catch(() => null)
        const message = typeof body?.detail === "string" ? body.detail : fallback
        throw new Error(message, { cause: error })
    }
}
