
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { ItemModalRenderer } from "@/components/ItemsModalRenderer"

const ItemModalContext = createContext(null);

export function ItemModalProvider({ children }) {
    const [activeItem, setActiveItem] = useState(null);
    const [itemsRevision, setItemsRevision] = useState(0);
    const navigationGuard = useRef(null);

    const registerNavigationGuard = useCallback((guard) => {
        navigationGuard.current = guard;

        return () => {
            if (navigationGuard.current === guard) navigationGuard.current = null;
        };
    }, []);

    function openItem(type, id) {
        if (activeItem?.type === type && activeItem?.id === id) return;
        if (navigationGuard.current?.() === false) return;
        navigationGuard.current = null;
        setActiveItem({ type, id });
    }

    function closeItem() {
        if (navigationGuard.current?.() === false) return;
        navigationGuard.current = null;
        setActiveItem(null);
    }

    function notifyItemsChanged() {
        setItemsRevision(prev => prev + 1);
    }

    return (
        <ItemModalContext.Provider
            value={{ activeItem, openItem, closeItem, itemsRevision, notifyItemsChanged, registerNavigationGuard }}
        >
            {children}
            <ItemModalRenderer />
        </ItemModalContext.Provider>
    );
}

export function useItemModal() {
    const context = useContext(ItemModalContext);

    if (!context) {
        throw new Error(
            "useItemModal must be used inside ItemModalProvider"
        );
    }

    return context;
}
