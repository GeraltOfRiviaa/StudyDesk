
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { ItemModalRenderer } from "@/components/items/ItemsModalRenderer"

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

    // check whether we are trying to open the same note
    // or it safe to go to another items modal
    // if its not the same note and its safe to navigate
    // then we set the active item to the new item 
    function openItem(type, id = null, action = "update") {
        if (
            activeItem?.type === type &&
            activeItem?.id === id &&
            activeItem?.action === action
        ) return;

        if (navigationGuard.current?.() === false) return;

        navigationGuard.current = null;
        setActiveItem({ type, id, action });
    }

    // check whether we can safely navigate
    // if yes then we set the active item to null
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
