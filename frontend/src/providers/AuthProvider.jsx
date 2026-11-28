import { useCallback, useEffect, useRef, useState } from "react"
import { api, registerSessionVerification } from "@/api/client"
import { AuthContext } from "../context/AuthContext"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "@/components/ui/toast"

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [session, setSession] = useState(null)
    const [accountDeleted, setAccountDeleted] = useState(false)
    const [loading, setLoading] = useState(true)
    const [verificationFailed, setVerificationFailed] = useState(false)
    const queryClient = useQueryClient()
    const sessionVersion = useRef(0)
    const activeSession = useRef(null)
    const authRequest = useRef(null)
    const verification = useRef(null)

    const retireSession = useCallback(() => {
        if (!activeSession.current) return
        // In-flight callbacks see an aborted session before React renders the new identity.
        activeSession.current.controller.abort()
        activeSession.current = null
        toast.close()
        // Queries can be waiting for verification, so teardown starts cancellation without awaiting it.
        void queryClient.cancelQueries()
        queryClient.clear()
    }, [queryClient])

    const clearSession = useCallback(({ accountDeleted = false, expectedSession } = {}) => {
        if (expectedSession && activeSession.current?.value !== expectedSession) return
        authRequest.current?.abort()
        authRequest.current = null
        verification.current = null
        retireSession()
        setAccountDeleted(accountDeleted)
        setVerificationFailed(false)
        setSession(null)
        setUser(null)
        setLoading(false)
    }, [retireSession])

    const startAuthRequest = useCallback(() => {
        authRequest.current?.abort()
        const controller = new AbortController()
        authRequest.current = controller
        return controller
    }, [])

    const logout = useCallback(async (expectedSession = activeSession.current?.value) => {
        if (!expectedSession || activeSession.current?.value !== expectedSession) return
        await api("/auth/logout", { method: "POST", signal: expectedSession.signal })
        clearSession({ expectedSession })
    }, [clearSession])

    const refreshUser = useCallback(() => {
        const scope = activeSession.current
        const pending = verification.current
        if (pending && pending.scope === scope && pending.request === authRequest.current) {
            return pending.promise
        }

        const request = startAuthRequest()
        const isCurrent = () => authRequest.current === request && activeSession.current === scope && !request.signal.aborted
        if (!scope) setLoading(true)

        const promise = (async () => {
            try {
                const currentUser = await api("/auth/user", { signal: request.signal })
                if (!isCurrent()) return "superseded"
                if (typeof currentUser?.id !== "string" || !currentUser.id) {
                    throw new Error("Account verification returned an invalid identity")
                }
                if (scope?.value.userId !== currentUser.id) {
                    retireSession()
                    const controller = new AbortController()
                    const value = { userId: currentUser.id, version: ++sessionVersion.current, signal: controller.signal }
                    activeSession.current = { value, controller, completedChecks: 0 }
                    setSession(value)
                }
                setUser(currentUser)
                setAccountDeleted(false)
                setVerificationFailed(false)
                return "verified"
            } catch (error) {
                if (!isCurrent()) return "superseded"
                if (error instanceof Response && error.status === 401) {
                    clearSession({ expectedSession: scope?.value })
                    return "expired"
                }
                setVerificationFailed(true)
                return "unavailable"
            } finally {
                if (verification.current?.request === request) verification.current = null
                if (authRequest.current === request) {
                    if (scope && activeSession.current === scope) scope.completedChecks += 1
                    authRequest.current = null
                    setLoading(false)
                }
            }
        })()
        verification.current = { scope, request, promise }
        return promise
    }, [clearSession, retireSession, startAuthRequest])

    const signIn = useCallback(async ({ username, password }) => {
        // Retire the old account before the credential request can change the cookie.
        clearSession()
        const request = startAuthRequest()
        try {
            await api("/auth/login", {
                method: "POST", body: new URLSearchParams({ username, password }), signal: request.signal,
            })
            if (request.signal.aborted) return "superseded"
        } catch (error) {
            if (request.signal.aborted) return "superseded"
            throw error
        } finally {
            if (authRequest.current === request) authRequest.current = null
        }
        return refreshUser()
    }, [clearSession, refreshUser, startAuthRequest])

    useEffect(() => {
        const unregister = registerSessionVerification({
            capture: () => {
                const scope = activeSession.current
                return scope && { scope, completedChecks: scope.completedChecks }
            },
            verify: ({ scope, completedChecks }) => {
                // A finished check already covers failures from requests that started before it.
                if (activeSession.current === scope && scope.completedChecks === completedChecks) {
                    return refreshUser()
                }
            },
        })
        void refreshUser()
        return () => {
            unregister()
            authRequest.current?.abort()
            authRequest.current = null
            verification.current = null
            retireSession()
        }
    }, [refreshUser, retireSession])

    return (
        <AuthContext.Provider value={{
            user,
            session,
            loading,
            verificationFailed,
            accountDeleted,
            refreshUser,
            signIn,
            clearSession,
            logout
        }}>
            {children}
        </AuthContext.Provider>
    )
}
