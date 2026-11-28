import { createContext, useContext } from "react"

export const ItemModalContext = createContext(null)

export function useItemModal() {
    const context = useContext(ItemModalContext)
    if (!context) throw new Error("useItemModal must be used inside ItemModalProvider")
    return context
}
