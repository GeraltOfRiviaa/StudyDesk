export function ItemModalLayout({ header, footer, children }) {
    return (
        <div className="flex min-h-0 flex-1 flex-col">
            {header}

            <div className="flex min-h-0 flex-1 flex-col gap-4">
                <div className="min-h-0 flex-1 overflow-y-auto">
                    {children}
                </div>
                {footer}
            </div>
        </div>
    );
}
