import { cn } from "cn";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LinkBadge } from "@/components/links/LinkTagBadge";
import { TagBadge } from "@/components/tags/TagBadge";

export function ItemModalHeader({ title, tags, links, titleClassName, children }) {
    return (
        <DialogHeader className="shrink-0 gap-0 pb-3">
            <div className="flex items-start justify-between gap-2 pr-8">
                <DialogTitle className={cn("min-w-0 wrap-anywhere", titleClassName)}>
                    {title}
                </DialogTitle>
                {children}
            </div>

            {(tags || links) && (
                <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap gap-1">
                        {tags?.map(tag => <TagBadge key={tag.id} tag={tag} />)}
                    </div>
                    <div className="flex flex-wrap gap-1">
                        {links?.map(link => (
                            <LinkBadge key={`${link.item_type}:${link.item_id}`} link={link} />
                        ))}
                    </div>
                </div>
            )}
        </DialogHeader>
    );
}
