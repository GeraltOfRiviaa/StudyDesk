import {
    Dialog, DialogClose, DialogContent, DialogFooter,
    DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSet } from "../ui/field"
import { Input } from "../ui/input"

export function NoteModal(note) {
    return (<div>
        <Dialog>
            <DialogTrigger render={
                (<div key={note.id} className="flex items-center gap-2 px-2 h-8 shrink-0 bg-card border-b">
                    <Checkbox

                        name={`${note.id}-checkbox`}
                        //Check if the notes id is in selected set, return boolean
                        checked={selected.has(note.id)}
                        //If checked changes run toggle func
                        onCheckedChange={() => toggle(note.id)}
                    />
                    <p className="truncate">{note.title}</p>
                </div>)
            } />
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{note.title}</DialogTitle>
                    <Button render={<X/>}/>
                </DialogHeader>
                <div className="-mx-4 no-scrollbar max-h-[50vh] overflow-y-auto px-4">
                    {Array.from({ length: 10 }).map((_, index) => (
                        <p key={index} className="mb-4 leading-normal">
                            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
                            eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut
                            enim ad minim veniam, quis nostrud exercitation ullamco laboris
                            nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in
                            reprehenderit in voluptate velit esse cillum dolore eu fugiat
                            nulla pariatur. Excepteur sint occaecat cupidatat non proident,
                            sunt in culpa qui officia deserunt mollit anim id est laborum.
                        </p>
                    ))}
                </div>
                <DialogFooter>
                    <DialogClose render={<Button variant="outline">Close</Button>} />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>)
}

export function NoteModalSkeleton({ note, selected, onToggle }) {
    return (
        <Dialog>
            <div className="flex items-center gap-2 px-2 h-8 shrink-0 bg-card border-b">
                <Checkbox
                    name={`${note.id}-checkbox`}
                    checked={selected.has(note.id)}
                    onCheckedChange={() => onToggle(note.id)}
                />
                <DialogTrigger
                    render={<button type="button" className="flex-1 min-w-0 h-full text-left truncate" />}
                >
                    {note.title}
                </DialogTrigger>
            </div>

            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{note.title}</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-2">
                    <Skeleton className="h-6 w-24 rounded-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-40 w-full" />
                </div>
                <DialogFooter >
                    <Button size="sm">Save changes</Button>
                    <DialogClose render={<Button size="sm" variant="outline">Cancel</Button>} />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}