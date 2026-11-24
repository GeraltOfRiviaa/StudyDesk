// AuthProvider.jsx  (only the component)
import { useCallback, useEffect, useState } from "react"
import { api } from "@/api/client"
import { AuthContext } from "../context/AuthContext"
import { useQueryClient } from "@tanstack/react-query"

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    /*Starts true so pages know the check hasn't finished yet*/
    const [loading, setLoading] = useState(true)
    const queryClient = useQueryClient()

    const logout = useCallback(async () => {
        await api("/auth/logout", { method: "POST" })
        await queryClient.cancelQueries()
        queryClient.clear()
        setUser(null)
    }, [queryClient])

    /*Call this any time the user changes (login, update)*/
    const refreshUser = useCallback(async () => {
        try {
            setUser(await api("/auth/user"))
        } catch {
            setUser(null)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { refreshUser() }, [refreshUser])

    return (
        <AuthContext.Provider value={{
            user,
            setUser,
            loading,
            refreshUser,
            logout
        }}>
            {children}
        </AuthContext.Provider>
    )
}