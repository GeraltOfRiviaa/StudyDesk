
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { ItemModalRenderer } from "@/components/items/ItemsModalRenderer"
import { useUser } from "@/context/AuthContext"

import { ItemModalContext } from "@/context/ItemsModalContext"

export function ItemModalProvider({ children }) {
    const [activeItem, setActiveItem] = useState(null);
    const { session } = useUser();
    const activeScope = useRef(null);
    const nextOpening = useRef(0);
    const navigationGuard = useRef(null);

    useLayoutEffect(() => () => activeScope.current?.controller.abort(), []);

    const registerNavigationGuard = useCallback((guard) => {
        navigationGuard.current = guard;

        return () => {
            if (navigationGuard.current === guard) navigationGuard.current = null;
        };
    }, []);

    // Reuse the current opening, and let the editor confirm before switching items.
    function openItem(type, id = null, action = "update") {
        if (session.signal.aborted) return;
        const current = activeScope.current?.item;
        if (
            current?.type === type &&
            current?.id === id &&
            current?.action === action
        ) return;

        if (navigationGuard.current?.() === false) return;

        navigationGuard.current = null;
        activeScope.current?.controller.abort();
        const controller = new AbortController();
        const item = {
            type, id, action, opening: ++nextOpening.current,
            signal: AbortSignal.any([controller.signal, session.signal]),
        };
        activeScope.current = { controller, item };
        setActiveItem(item);
    }

    function closeItem(expected) {
        // A callback from a previous opening cannot close the current modal.
        if (expected.signal.aborted || activeScope.current?.item !== expected) return;
        if (navigationGuard.current?.() === false) return;
        navigationGuard.current = null;
        activeScope.current.controller.abort();
        activeScope.current = null;
        setActiveItem(null);
    }

    return (
        <ItemModalContext.Provider
            value={{ activeItem, openItem, closeItem, registerNavigationGuard }}
        >
            {children}
            <ItemModalRenderer />
        </ItemModalContext.Provider>
    );
}
