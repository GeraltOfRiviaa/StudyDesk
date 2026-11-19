
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Field,
    FieldGroup,
    FieldLabel,
    FieldDescription,
    FieldError,
} from "@/components/ui/field";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateNoteSchema, UpdateNoteSchema } from "@/schemas";
import { api } from "@/api";
import { toast } from "@/components/ui/toast";

// Converts comma-separated tags into an array
function parseTags(value) {
    return value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
}

// Reusable fields for creating and updating notes
function NoteFields({ form, prefix }) {
    return (
        <FieldGroup>
            <Controller
                name="title"
                control={form.control}
                render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor={`${prefix}-title`}>
                            Title
                        </FieldLabel>

                        <Input
                            {...field}
                            id={`${prefix}-title`}
                            placeholder="Note title"
                            maxLength={150}
                            aria-invalid={fieldState.invalid}
                        />

                        {fieldState.invalid && (
                            <FieldError errors={[fieldState.error]} />
                        )}
                    </Field>
                )}
            />

            <Controller
                name="content"
                control={form.control}
                render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor={`${prefix}-content`}>
                            Content
                        </FieldLabel>

                        <Textarea
                            {...field}
                            id={`${prefix}-content`}
                            placeholder="Write your note..."
                            className="min-h-40 resize-y"
                            aria-invalid={fieldState.invalid}
                        />

                        {fieldState.invalid && (
                            <FieldError errors={[fieldState.error]} />
                        )}
                    </Field>
                )}
            />

            <Controller
                name="tags"
                control={form.control}
                render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor={`${prefix}-tags`}>
                            Tags
                        </FieldLabel>

                        <Input
                            id={`${prefix}-tags`}
                            placeholder="school, programming, react"
                            defaultValue={field.value.join(", ")}
                            onBlur={(e) => {
                                field.onChange(
                                    parseTags(e.target.value)
                                );
                                field.onBlur();
                            }}
                            aria-invalid={fieldState.invalid}
                        />

                        <FieldDescription>
                            Separate tags with commas.
                        </FieldDescription>

                        {fieldState.invalid && (
                            <FieldError errors={[fieldState.error]} />
                        )}
                    </Field>
                )}
            />
        </FieldGroup>
    );
}

// CREATE NOTE MODAL
export function CreateNoteModal({
    open,
    onOpenChange,
    onCreated,
}) {
    const form = useForm({
        resolver: zodResolver(CreateNoteSchema),
        defaultValues: {
            title: "",
            content: "",
            tags: [],
        },
    });

    async function onSubmit(data) {
        try {
            const createdNote = await api("/notes/", {
                method: "POST",
                json: {
                    title: data.title,
                    content: data.content,
                    tags: data.tags,
                },
            });

            toast.add({
                title: "Note created",
                type: "success",
            });

            form.reset();
            onCreated?.(createdNote);
            onOpenChange(false);
        } catch {
            toast.add({
                title: "Could not create note",
                description: "Try again later",
                type: "error",
            });
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create Note</DialogTitle>
                </DialogHeader>

                <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="flex flex-col gap-4"
                >
                    <NoteFields
                        form={form}
                        prefix="create-note"
                    />

                    <DialogFooter className="sm:justify-start">
                        <Button
                            type="submit"
                            size="sm"
                            disabled={form.formState.isSubmitting}
                        >
                            Create
                        </Button>

                        <DialogClose
                            render={
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                >
                                    Cancel
                                </Button>
                            }
                        />
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// UPDATE NOTE FORM
// This component is rendered inside NoteRow's DialogContent.
export function UpdateNoteForm({
    note,
    onUpdated,
    onClose,
}) {
    const form = useForm({
        resolver: zodResolver(UpdateNoteSchema),
        defaultValues: {
            title: note.title ?? "",
            content: note.content ?? "",
            tags: note.tags ?? [],
        },
    });

    async function onSubmit(data) {
        try {
            const updatedNote = await api(`/notes/${note.id}`, {
                method: "PATCH",
                json: {
                    title: data.title,
                    content: data.content,
                    tags: data.tags,
                },
            });

            toast.add({
                title: "Note updated",
                type: "success",
            });

            onUpdated?.(updatedNote);
            onClose?.();
        } catch {
            toast.add({
                title: "Could not update note",
                description: "Try again later",
                type: "error",
            });
        }
    }

    return (
        <>
            <DialogHeader>
                <DialogTitle>Edit Note</DialogTitle>
            </DialogHeader>

            <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="flex flex-col gap-4"
            >
                <NoteFields
                    form={form}
                    prefix="edit-note"
                />

                <DialogFooter className="sm:justify-start">
                    <Button
                        type="submit"
                        size="sm"
                        disabled={form.formState.isSubmitting}
                    >
                        Save changes
                    </Button>

                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={onClose}
                    >
                        Cancel
                    </Button>
                </DialogFooter>
            </form>
        </>
    );
}
