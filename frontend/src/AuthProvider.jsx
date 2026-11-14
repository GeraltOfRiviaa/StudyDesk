// auth.jsx
import { createContext, useContext, useEffect, useState } from "react"
import { api } from "@/api"
import { AuthContext } from "./AuthContext"

export function AuthProvider({ children }) {
        const [user, setUser] = useState(null)
        const [loading, setLoading] = useState(true)

        useEffect(() => {
            api("/auth/user")
                .then(u => setUser({
                    id: u.id,
                    email: u.email,
                    username: u.username,
                    created_at: u.created_at,
                }))
                .catch(() => setUser(null))
                .finally(() => setLoading(false))
        }, [])

        return (
            <AuthContext.Provider value={{ user, setUser, loading }}>
                {children}
            </AuthContext.Provider>
        )

}

