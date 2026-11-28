import { useId } from "react";
import { Controller } from "react-hook-form";
import { LinkSelector } from "@/components/links/LinkSelector";
import { TagSelector } from "@/components/tags/TagSelector";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { useItemModal } from "@/context/ItemsModalContext";

export function ItemRelationsFields({ control, sourceType, sourceId }) {
    const id = useId();
    const { activeItem } = useItemModal();

    return (
        <>
            <Controller
                name="tags"
                control={control}
                render={({ field, fieldState }) => (
                    <Field
                        data-invalid={fieldState.invalid}
                        aria-labelledby={`${id}-tags`}
                        aria-describedby={`${id}-tags-help`}
                    >
                        <FieldLabel id={`${id}-tags`} className="text-lg">Tags</FieldLabel>
                        <FieldDescription id={`${id}-tags-help`} className="sr-only">
                            Choose the tags to attach when you submit.
                        </FieldDescription>
                        <TagSelector value={field.value ?? []} onChange={field.onChange} modalSignal={activeItem.signal} />
                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                )}
            />

            <Controller
                name="links"
                control={control}
                render={({ field, fieldState }) => (
                    <Field
                        data-invalid={fieldState.invalid}
                        aria-labelledby={`${id}-links`}
                        aria-describedby={`${id}-links-help`}
                    >
                        <FieldLabel id={`${id}-links`} className="text-lg">Links</FieldLabel>
                        <FieldDescription id={`${id}-links-help`} className="sr-only">
                            Choose the items to link when you submit.
                        </FieldDescription>
                        <LinkSelector
                            value={field.value ?? []}
                            onChange={field.onChange}
                            sourceType={sourceType}
                            sourceId={sourceId}
                        />
                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                )}
            />
        </>
    );
}
