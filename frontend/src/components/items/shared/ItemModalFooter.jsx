import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";

export function ItemModalFooter({ submitLabel, submitDisabled, onDelete, onCancel, className }) {
    return (
        <DialogFooter className={cn("shrink-0 border-t pt-3 sm:justify-between", className)}>
            {submitLabel && (
                <Button type="submit" size="sm" disabled={submitDisabled}>
                    {submitLabel}
                </Button>
            )}
            {onDelete && (
                <Button type="button" size="sm" variant="destructive" onClick={onDelete}>
                    Delete
                </Button>
            )}
            {onCancel && (
                <Button type="button" size="sm" variant="outline" onClick={onCancel}>
                    Cancel
                </Button>
            )}
        </DialogFooter>
    );
}
