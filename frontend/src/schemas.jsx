import * as z from "zod"

export const RegisterSchema = z.object({
    username: z
        .string()
        .min(5, "Bug title must be at least 3 characters.")
        .max(50, "Bug title must be at most 50 characters.")
        .regex(
            /^[A-Za-z0-9_.-]+$/,
            "Username can only contain letters, numbers, underscores, dots and hyphens."
        ),

    email: z
        .email(),
    password: z
        .string()
        .min(8, "Password must be at least 8 characters long")
        .max(128, "Password must be at most 128 characters")
})

export const LoginSchema = z.object({
    username: z
        .string()
        .min(5, "Bug title must be at least 3 characters.")
        .max(50, "Bug title must be at most 50 characters.")
        .regex(
            /^[A-Za-z0-9_.-]+$/,
            "Username can only contain letters, numbers, underscores, dots and hyphens."
        ),
    password: z
        .string()
        .min(8, "Password must be at least 8 characters long")
        .max(128, "Password must be at most 128 characters")
})