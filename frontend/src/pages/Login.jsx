import { Button } from "@/components/ui/button"
import {
    InputGroup,
    InputGroupInput,
} from "@/components/ui/input-group"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast, Toaster } from "@/components/ui/toast"
import { EyeIcon, EyeOffIcon } from "lucide-react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, Controller } from "react-hook-form"
import { LoginSchema } from '../schemas'
import {useUser} from '@/AuthContext'
import {api} from '@/api'

function Login() {
    const { setUser } = useUser()
    const google_url = import.meta.env.VITE_API_URL + "/auth/google/login"
    const navigate = useNavigate();
    const [showPassword, setShowPassword] = useState(false);

    const form = useForm({
        resolver: zodResolver(LoginSchema),
        defaultValues: { username: "", password: "" },
    })

    const register = () => {
        navigate('/register')
    }


    async function onSubmit(data) {

        const API_OPTIONS = {
            method: "POST",
            body: new URLSearchParams({ username: data.username, password: data.password })
        }

        console.log("clicked")

        try {
            await api("/auth/login", API_OPTIONS)
            // refresh the user so ProtectedRoute sees them
            const u = await api("/auth/user")
            setUser({ id: u.id, email: u.email, username: u.nickname, created_at: u.created_at })
            navigate("/dashboard")
        } catch (err) {
            console.log(err)
            toast.add({
                title: "Could not authenticate a user",
                description: "Wrong password or nickname",
                type: "error",
            })
        }
    }

    const login_google = () => {
        console.log("clicked")
        window.location.href = google_url
    }

    return (
        <div className="flex h-dvh" >
            <Toaster />

            <form id="login-mobile" className="flex flex-col mx-auto my-auto w-screen px-20 sm:hidden max-w-100 " onSubmit={form.handleSubmit(onSubmit)}>
                <h1 className="font-bold text-4xl text-center py-10">Login</h1>
                <Controller
                    name="username"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <div className="flex flex-col gap-3">
                            <p className="font-semibold text-xl">Username</p>
                            <InputGroup>
                                <InputGroupInput
                                    {...field}
                                    placeholder="SmartBoy"
                                    aria-invalid={fieldState.invalid}
                                    autoComplete="username"
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
                        <div className="flex flex-col my-2 gap-3 justify-between">
                            <p className="font-semibold text-xl">Password</p>
                            <InputGroup>
                                <InputGroupInput
                                    {...field}
                                    placeholder="..."
                                    type={showPassword ? "text" : "password"}
                                    autoComplete="current-password"
                                    aria-invalid={fieldState.invalid}
                                />

                                {/* Toggle button for showing/hiding password */}
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-0 h-full px-3"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? (
                                        <EyeOffIcon className="h-4 w-4" />
                                    ) : (
                                        <EyeIcon className="h-4 w-4" />
                                    )}
                                </Button>
                            </InputGroup>
                            {fieldState.invalid && (
                                <p className="text-sm text-destructive">{fieldState.error?.message}</p>
                            )}
                        </div>
                    )}
                />

                <div className="flex flex-col gap-3">
                    <div className="flex flex-row justify-between mt-4 ">
                        <Button variant="default" size="lg" className="rounded-md" type="submit">Login</Button>
                        <Button variant="outline" size="lg" className="rounded-md self-center" onClick={register} type="button">Register</Button>
                    </div>
                    <Button variant="outline" size="lg" className="rounded-md" onClick={login_google} type="button">With Google</Button>
                </div>
            </form>
            <form id="login-tablet-pc" className="flex-col max-w-100 mx-auto my-auto hidden sm:flex lg:max-w-150 " onSubmit={form.handleSubmit(onSubmit)}>
                <h1 className="font-bold text-4xl text-center py-10">Login</h1>
                <Controller
                    name="username"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <div className="flex flex-row my-2 gap-3 justify-between">
                            <p className="font-semibold text-xl">Username</p>
                            <InputGroup>
                                <InputGroupInput
                                    {...field}
                                    placeholder="SmartBoy"
                                    aria-invalid={fieldState.invalid}
                                    autoComplete="username" />

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
                        <div className="flex flex-row my-2 gap-3 justify-between">
                            <p className="font-semibold text-xl">Password</p>
                            <InputGroup>
                                <InputGroupInput
                                    {...field}
                                    placeholder="..."
                                    type={showPassword ? "text" : "password"}
                                    autoComplete="current-password"
                                    aria-invalid={fieldState.invalid}
                                />

                                {/* Toggle button for showing/hiding password */}
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-0 h-full px-3"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? (
                                        <EyeOffIcon className="h-4 w-4" />
                                    ) : (
                                        <EyeIcon className="h-4 w-4" />
                                    )}
                                </Button>
                            </InputGroup>
                            {fieldState.invalid && (
                                <p className="text-sm text-destructive">{fieldState.error?.message}</p>
                            )}
                        </div>
                    )}
                />
                <div className="flex flex-row justify-between mt-4 ">
                    <Button variant="default" size="lg" className="rounded-md" type="submit">Login</Button>
                    <Button variant="outline" size="lg" className="rounded-md self-center" onClick={register} type="button">Register</Button>
                    <Button variant="outline" size="lg" className="rounded-md" onClick={login_google} type="button">With Google</Button>
                </div>
            </form>
        </div>
    )
}

export { Login }
