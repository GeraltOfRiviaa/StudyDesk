export function bulkTagFeedback({ matched, modified }, action) {
    const noun = matched === 1 ? "item" : "items"
    return {
        title: modified ? `Tags ${action}` : action === "added" ? "No tags added" : "No tags to clear",
        description: `${modified} of ${matched} matched ${noun} changed.`,
        type: modified > 0 && modified === matched ? "success" : "info",
    }
}

export function bulkLinkFeedback({ deleted }) {
    return deleted
        ? { title: `Removed ${deleted} ${deleted === 1 ? "link" : "links"}`, type: "success" }
        : { title: "The selected items had no links", type: "info" }
}

export function bulkDeleteFeedback({ deleted, skipped }) {
    return {
        title: deleted ? "Bulk deletion completed" : "Nothing deleted",
        description: `${deleted} deleted, ${skipped} skipped.`,
        type: deleted > 0 && !skipped ? "success" : "info",
    }
}
