import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, Controller } from "react-hook-form"
import { EyeIcon, EyeOffIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupInput } from "@/components/ui/input-group"
import { toast } from "@/components/ui/toast"
import { ChangePasswordSchema } from "@/schemas"
import { api } from "@/api"

const FIELDS = [
    { name: "oldPassword", label: "Current password", autoComplete: "current-password" },
    { name: "newPassword", label: "New password", autoComplete: "new-password" },
    { name: "confirmPassword", label: "Confirm password", autoComplete: "new-password" },
]

function ChangePassword() {
    const navigate = useNavigate()
    const [showPassword, setShowPassword] = useState(false)


    const form = useForm({
        resolver: zodResolver(ChangePasswordSchema),
        defaultValues: { oldPassword: "", newPassword: "", confirmPassword: "" },
    })

    async function onSubmit(data) {
        try {
            await api("/auth/user/password", {
                method: "PATCH",
                json: { old_password: data.oldPassword, new_password: data.newPassword },
            })
            toast.add({ title: "Password changed", type: "success" })
            navigate("/settings")
        } catch (err) {
            toast.add({
                title: "Could not change the password",
                description: err.status === 400 ? "Current password is incorrect" : "Try again later",
                type: "error",
            })
        }
    }

    return (
        <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col px-4 py-6 max-w-100 lg:max-w-150 mx-auto"
        >
            {FIELDS.map(({ name, label, autoComplete }) => (
                <Controller
                    key={name}
                    name={name}
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <div className="flex flex-col my-2 gap-3 justify-between">
                            <p className="font-semibold text-xl">{label}</p>
                            <InputGroup>
                                <InputGroupInput
                                    {...field}
                                    placeholder="..."
                                    type={showPassword ? "text" : "password"}
                                    autoComplete={autoComplete}
                                    aria-invalid={fieldState.invalid}
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-0 h-full px-3"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                                </Button>
                            </InputGroup>
                            {fieldState.invalid && (
                                <p className="text-sm text-destructive">{fieldState.error?.message}</p>
                            )}
                        </div>
                    )}
                />
            ))}

            <div className="flex flex-row justify-between mt-4">
                <Button type="submit" variant="default" size="sm" className="rounded-md">Save</Button>
                <Button type="button" variant="outline" size="sm" className="rounded-md" onClick={() => navigate("/settings")}>
                    Cancel
                </Button>
            </div>
        </form>
    )
}

export { ChangePassword }