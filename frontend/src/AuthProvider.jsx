// AuthProvider.jsx  (only the component)
import { useCallback, useEffect, useState } from "react"
import { api } from "@/api"
import { AuthContext } from "./AuthContext"

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    /*Starts true so pages know the check hasn't finished yet*/
    const [loading, setLoading] = useState(true)

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
        <AuthContext.Provider value={{ user, setUser, loading, refreshUser }}>
            {children}
        </AuthContext.Provider>
    )
}