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
import { RegisterSchema } from '../schemas'
//import { useNavigate } from "react-router-dom"

function Register() {


    const register_url = import.meta.env.VITE_API_URL + "/auth/register"
    //const user_url = import.meta.env.VITE_API_URL + "/auth/user"
    const navigate = useNavigate();
    const [showPassword, setShowPassword] = useState(false);

    const form = useForm({
        resolver: zodResolver(RegisterSchema),
        defaultValues: { username: "", email: "", password: "" },
    })

    const login = () => {
        navigate('/')
    }

    async function onSubmit(data) {
            const API_OPTIONS = {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: data.email,
                    username: data.username,
                    password: data.password
                })
            }
            console.log("clicked")

            try {
                const response = await fetch(register_url, API_OPTIONS)
                if (!response.ok) {
                    toast.add({
                        title: "Could not register a user",
                        type: "error"
                    })
                    return
                }
                navigate('/')
            } catch (err) {
                console.log('Error when registering' + err)
                toast.add({
                    title: "Could not register user a user",
                    description: err,
                    type: "error"
                })
            }
        };
    return (
        <div className="flex h-dvh" onSubmit={form.handleSubmit(onSubmit)}>
            <Toaster />
            <form id="login-mobile" className="flex flex-col mx-auto my-auto  w-screen px-20 sm:hidden max-w-100 ">
                <h1 className="font-bold text-4xl text-center pb-10">Register</h1>
                <Controller
                    name="username"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <div className="flex flex-col gap-3 justify-between">
                            <p className="font-semibold text-xl">Username</p>
                            <InputGroup>
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
                        <div className="flex flex-col gap-3 justify-between">
                            <p className="font-semibold text-xl">Email</p>
                            <InputGroup>
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
                    <Button variant="default" size="lg" className="rounded-md" type="submit">Register</Button>
                    <Button variant="secondary" size="lg" className="rounded-md" onClick={login} type="button">Login</Button>
                </div>
            </form>
            <form id="login-tablet-pc" className="flex-col max-w-100 mx-auto my-auto hidden sm:flex ">
                <h1 className="font-bold text-4xl text-center pb-10">Register</h1>
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
                        <div className="flex flex-row my-2 gap-3 justify-between">
                            <p className="font-semibold text-xl">Email</p>
                            <InputGroup>
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
                        <div className="flex flex-row my-2 gap-3 justify-between">
                            <p className="font-semibold text-xl">Password</p>
                            <InputGroup className="max-w-70">
                                <InputGroupInput
                                    {...field}
                                    placeholder="verySecretPassword"
                                    type={showPassword ? "text" : "password"}
                                    autoComplete="current-password"
                                    aria-invalid={fieldState.invalid}
                                />

                                {/* Toggle button for showing/hiding password */}
                                <Button
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
                    )} />

                <div className="flex flex-row justify-between mt-4 ">
                    <Button variant="default" size="lg" className="rounded-md" type="submit">Register</Button>
                    <Button variant="secondary" size="lg" className="rounded-md" onClick={login} type="button">Login</Button>
                </div>
            </form>
        </div>


    )
}

export { Register }
