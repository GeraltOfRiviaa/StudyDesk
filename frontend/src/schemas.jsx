import * as z from "zod"

export const UsernameField = z
    .string()
    .min(3, "Username must be at least 3 characters.")
    .max(50, "Username must be at most 50 characters.")
    .regex(/^[A-Za-z0-9_.-]+$/, "Only letters, numbers, underscores, dots and hyphens.")

export const PasswordField = z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(128, "Password must be at most 128 characters.")

export const EmailField = z.email("Enter a valid email address.").max(254)

export const RegisterSchema = z.object({
    username: UsernameField,
    email: EmailField,
    password: PasswordField,
})

export const LoginSchema = z.object({
    username: UsernameField,
    password: PasswordField
})
export const UpdateUserSchema = z.object({
    username: UsernameField.or(z.literal("")),
    email: EmailField.or(z.literal("")),
})

export const ChangePasswordSchema = z.object({
    oldPassword: z.string().min(1, "Required"),
    newPassword: PasswordField,
    confirmPassword: z.string(),
})
.refine(d => d.newPassword === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
})
.refine(d => d.newPassword !== d.oldPassword, {
    message: "New password must be different",
    path: ["newPassword"],
})
export const CreateNoteSchema = z.object({
    title: z.string().min(1, "Title is required").max(150, "Maximum 150 characters"),
    content: z.string(),
    tags: z.array(z.string())
});
export const UpdateNoteSchema = z.object({
    title: z.string().min(1, "Title is required").max(150),
    content: z.string(),
    tags: z.array(z.string()),
})