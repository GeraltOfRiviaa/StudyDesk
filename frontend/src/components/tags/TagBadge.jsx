
import { Badge } from "@/components/ui/badge";
import { getContrastColor } from "@/utils/colors"

export function TagBadge({ tag }) {
    return (
        <Badge
            className="min-w-0 max-w-full shrink! rounded-full border-transparent"
            style={{
                backgroundColor: tag.color,
                color: getContrastColor(tag.color),
            }}
        >
            <span className="min-w-0 truncate">{tag.name}</span>
        </Badge>
    );
}
