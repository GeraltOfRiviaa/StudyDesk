import { CalendarDays, ClipboardList, File, FileText } from "lucide-react"

export const ITEM_TYPES = {
    note: { type: "note", collection: "notes", label: "Note", pluralLabel: "Notes", Icon: FileText },
    file: { type: "file", collection: "files", label: "File", pluralLabel: "Files", Icon: File },
    form: { type: "form", collection: "forms", label: "Form", pluralLabel: "Forms", Icon: ClipboardList },
    event: { type: "event", collection: "events", label: "Event", pluralLabel: "Events", Icon: CalendarDays },
}
