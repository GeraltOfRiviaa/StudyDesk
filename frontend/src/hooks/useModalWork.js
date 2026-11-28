import { useQueryClient } from "@tanstack/react-query"
import { useUser } from "@/context/AuthContext"
import { useItemModal } from "@/context/ItemsModalContext"
import { refreshAccountQueries } from "@/lib/accountQueries"

export function useModalWork() {
    const { activeItem: { signal } } = useItemModal()
    const { session } = useUser()
    const queryClient = useQueryClient()

    async function write(request) {
        signal.throwIfAborted()
        try {
            // Let a dispatched write settle after an ordinary close. Session teardown still aborts it.
            return await request(session.signal)
        } finally {
            // Even a lost response can follow a committed write.
            void refreshAccountQueries(queryClient, session)
        }
    }

    return { signal, write }
}
