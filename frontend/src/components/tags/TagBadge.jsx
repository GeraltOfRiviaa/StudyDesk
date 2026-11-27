
import { Badge } from "@/components/ui/badge";
import { getContrastColor } from "@/utils/colors"

export function TagBadge({ tag }) {
    return (
        <Badge
            className="rounded-full border-transparent"
            style={{
                backgroundColor: tag.color,
                color: getContrastColor(tag.color),
            }}
        >
            {tag.name}
        </Badge>
    );
}
