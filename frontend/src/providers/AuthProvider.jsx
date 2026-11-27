// AuthProvider.jsx  (only the component)
import { useCallback, useEffect, useRef, useState } from "react"
import { api } from "@/api/client"
import { AuthContext } from "../context/AuthContext"
import { useQueryClient } from "@tanstack/react-query"

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [accountDeleted, setAccountDeleted] = useState(false)
    /*Starts true so pages know the check hasn't finished yet*/
    const [loading, setLoading] = useState(true)
    const queryClient = useQueryClient()
    const sessionVersion = useRef(0)

    const clearSession = useCallback(async ({ accountDeleted = false } = {}) => {
        sessionVersion.current += 1
        await queryClient.cancelQueries()
        queryClient.clear()
        setAccountDeleted(accountDeleted)
        setUser(null)
        setLoading(false)
    }, [queryClient])

    const logout = useCallback(async () => {
        await api("/auth/logout", { method: "POST" })
        await clearSession()
    }, [clearSession])

    /*Call this any time the user changes (login, update)*/
    const refreshUser = useCallback(async () => {
        // A refresh started before logout or deletion must not restore that session.
        const version = sessionVersion.current
        const currentUser = await api("/auth/user").catch(() => null)
        if (version !== sessionVersion.current) return
        if (currentUser) setAccountDeleted(false)
        setUser(currentUser)
        setLoading(false)
    }, [])

    useEffect(() => { refreshUser() }, [refreshUser])

    return (
        <AuthContext.Provider value={{
            user,
            setUser,
            loading,
            accountDeleted,
            refreshUser,
            clearSession,
            logout
        }}>
            {children}
        </AuthContext.Provider>
    )
}
