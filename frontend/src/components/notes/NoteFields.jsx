import {
    Field,
    FieldGroup,
    FieldLabel,
    FieldError,
} from "@/components/ui/field";

import { Controller } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {TagSelector} from "@/components/tags/TagSelector";

// Converts comma-separated tags into an array
function parseTags(value) {
    return value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
}
// Reusable fields for creating and updating notes
export function NoteFields({ form, prefix }) {
    return (
        <FieldGroup>
            <Controller
                name="title"
                control={form.control}
                render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor={`${prefix}-title`} className="text-lg">
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
                        <FieldLabel htmlFor={`${prefix}-content`} className="text-lg">
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
                        <FieldLabel>Tags</FieldLabel>

                        <TagSelector
                            value={field.value ?? []}
                            onChange={field.onChange}
                        />

                        {fieldState.invalid && (
                            <FieldError errors={[fieldState.error]} />
                        )}
                    </Field>
                )}
            />

        </FieldGroup>
    );
}