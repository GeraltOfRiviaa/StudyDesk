
import { Badge } from "@/components/ui/badge";
import { Link2 } from "lucide-react";
import { useItemModal } from "@/context/ItemsModalContext";

export function LinkBadge({ link }) {
    const { openItem } = useItemModal();

    return (
        <Badge
            variant="outline"
            className="gap-1 cursor-pointer hover:bg-accent"
            render={
                <button
                    type="button"
                    onClick={() => openItem(link.item_type, link.item_id)}
                />
            }
        >
            <Link2 className="size-3" />
            <span className="truncate">{link.title}</span>
        </Badge>
    );
}
