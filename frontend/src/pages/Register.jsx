import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, Controller } from "react-hook-form"
import { EyeIcon, EyeOffIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupInput } from "@/components/ui/input-group"
import { toast, Toaster } from "@/components/ui/toast"
import { RegisterSchema } from "../schemas"
import { api } from "@/api/client"

function Register() {
    const navigate = useNavigate()
    const [showPassword, setShowPassword] = useState(false)

    const form = useForm({
        resolver: zodResolver(RegisterSchema),
        defaultValues: { username: "", email: "", password: "" },
    })

    async function onSubmit(data) {
        try {
            await api("/auth/register", { method: "POST", json: data })
            navigate("/")
        } catch (err) {
            toast.add({
                title: "Could not register a user",
                description: err.status === 409 ? "Username or email already taken" : "Try again later",
                type: "error",
            })
        }
    }

    /*Stacked on mobile, label next to input from sm up*/
    const rowClass = "flex flex-col sm:flex-row my-2 gap-3 sm:justify-between"

    return (
        <div className="flex h-dvh">
            <Toaster />
            <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="flex flex-col mx-auto my-auto w-screen px-20 max-w-100 sm:px-0"
            >
                <h1 className="font-bold text-4xl text-center pb-10">Register</h1>

                <Controller
                    name="username"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <div className={rowClass}>
                            <label className="font-semibold text-xl">Username</label>
                            <InputGroup className="sm:max-w-70">
                                <InputGroupInput
                                    {...field}
                                    placeholder="SmartBoy"
                                    autoComplete="username"
                                    aria-invalid={fieldState.invalid}
                                />
                            </InputGroup>
                            {fieldState.invalid && (
                                <p className="text-sm text-destructive">{fieldState.error?.message}</p>
                            )}
                        </div>
                    )}
                />

                <Controller
                    name="email"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <div className={rowClass}>
                            <label className="font-semibold text-xl">Email</label>
                            <InputGroup className="sm:max-w-70">
                                <InputGroupInput
                                    {...field}
                                    placeholder="smartboy@example.com"
                                    autoComplete="email"
                                    aria-invalid={fieldState.invalid}
                                />
                            </InputGroup>
                            {fieldState.invalid && (
                                <p className="text-sm text-destructive">{fieldState.error?.message}</p>
                            )}
                        </div>
                    )}
                />

                <Controller
                    name="password"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <div className={rowClass}>
                            <label className="font-semibold text-xl">Password</label>
                            <InputGroup className="sm:max-w-70">
                                <InputGroupInput
                                    {...field}
                                    placeholder="verySecretPassword"
                                    type={showPassword ? "text" : "password"}
                                    autoComplete="new-password"
                                    aria-invalid={fieldState.invalid}
                                />
                                {/*type="button" so it doesn't submit the form*/}
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

                <div className="flex flex-row justify-between mt-4">
                    <Button type="submit" variant="default" size="sm" className="rounded-md">
                        Register
                    </Button>
                    <Button type="button" variant="secondary" size="sm" className="rounded-md" onClick={() => navigate("/")}>
                        Login
                    </Button>
                </div>
            </form>
        </div>
    )
}

export { Register }