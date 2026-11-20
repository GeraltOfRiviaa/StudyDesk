import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import { Controller } from "react-hook-form"
import { Input } from "@/components/ui/input"

// Reusable fields for creating and updating tags
export function TagFields({ form, prefix }) {
    return (
        <FieldGroup>
            <Controller
                name="name"
                control={form.control}
                render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor={`${prefix}-name`} className="text-lg">Name</FieldLabel>
                        <Input
                            {...field}
                            id={`${prefix}-name`}
                            placeholder="Tag name"
                            maxLength={50}
                            aria-invalid={fieldState.invalid}
                        />
                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                )}
            />

            <Controller
                name="color"
                control={form.control}
                render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor={`${prefix}-color`} className="text-lg">Color</FieldLabel>
                        <div className="flex items-center gap-2">
                            {/* native picker + hex text input share one value */}
                            <input
                                type="color"
                                value={field.value}
                                onChange={field.onChange}
                                className="h-9 w-12 cursor-pointer rounded border bg-transparent p-1"
                                aria-label="Pick color"
                            />
                            <Input
                                {...field}
                                id={`${prefix}-color`}
                                placeholder="#3b82f6"
                                maxLength={7}
                                aria-invalid={fieldState.invalid}
                            />
                        </div>
                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                )}
            />
        </FieldGroup>
    );
}