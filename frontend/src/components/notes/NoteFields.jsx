import {
    Field,
    FieldLabel,
    FieldError,
} from "@/components/ui/field";

import { Controller } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

// Reusable fields for creating and updating notes
export function NoteFields({ control, prefix }) {

    return (
        <>
            <Controller
                name="title"
                control={control}
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
                control={control}
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

        </>
    );
}
