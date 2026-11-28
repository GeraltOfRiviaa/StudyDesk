import { useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, Controller } from "react-hook-form"
import { EyeIcon, EyeOffIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupInput } from "@/components/ui/input-group"
import { toast, Toaster } from "@/components/ui/toast"
import { LoginSchema } from "../schemas"
import { useUser } from "@/context/AuthContext"
import { api } from "@/api/client"
import { authRateLimitMessage } from "@/api/accountApi"

function Login() {
    const { refreshUser } = useUser()
    const navigate = useNavigate()
    const { state } = useLocation()
    const [showPassword, setShowPassword] = useState(false)

    const form = useForm({
        resolver: zodResolver(LoginSchema),
        defaultValues: { username: "", password: "" },
    })

    async function onSubmit(data) {
        try {
            await api("/auth/login", {
                method: "POST",
                body: new URLSearchParams({ username: data.username, password: data.password }),
            })
            /*Load the user before navigating, otherwise the Layout bounces you back*/
            await refreshUser()
            navigate("/")
        } catch (error) {
            toast.add({
                title: "Could not authenticate a user",
                description: authRateLimitMessage(error) ?? "Wrong password or username",
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
                className="flex flex-col mx-auto my-auto w-screen px-20 max-w-100 sm:px-0 lg:max-w-80"
            >
                <h1 className="font-bold text-4xl text-center py-10">Login</h1>
                {state?.accountDeleted && (
                    <p role="status" className="mb-3 text-center text-sm">Account deleted.</p>
                )}

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
                    name="password"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <div className={rowClass}>
                            <label className="font-semibold text-xl">Password</label>
                            <InputGroup className="sm:max-w-70">
                                <InputGroupInput
                                    {...field}
                                    placeholder="..."
                                    type={showPassword ? "text" : "password"}
                                    autoComplete="current-password"
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
                        Login
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="rounded-md" onClick={() => navigate("/register")}>
                        Register
                    </Button>
                </div>
            </form>
        </div>
    )
}

export { Login }
