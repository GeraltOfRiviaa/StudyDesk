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

function Login() {


    const login_url = import.meta.env.VITE_API_URL + "/auth/login"
    //const user_url = import.meta.env.VITE_API_URL + "/auth/user"
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
            const token_response = await fetch(login_url, API_OPTIONS)
            if (!token_response.ok) {
                throw new Error("HTTP error: " + token_response.status)
            }
            const token = await token_response.json()
            localStorage.setItem("jwt_token", token.access_token)
            navigate('/dashboard')
        } catch (err) {
            console.log('Error when logging in ' + err)
            toast.add({
                title: "Could not authenticate a user",
                description: "Wrong password or nickname",
                type: "error"
            })
        }
    }



    return (
        <div className="flex h-dvh" onSubmit={form.handleSubmit(onSubmit)}>
            <Toaster />

            <form id="login-mobile" className="flex flex-col mx-auto my-auto w-screen px-20 sm:hidden max-w-100 ">
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

                <div className="flex flex-row justify-between mt-4 ">
                    <Button variant="default" size="lg" className="rounded-md" type="submit">Login</Button>
                    <Button variant="destructive" size="lg" className="rounded-md" onClick={register} type="button">Register</Button>
                </div>
            </form>
            <form id="login-tablet-pc" className="flex-col max-w-100 mx-auto my-auto hidden sm:flex lg:max-w-150 ">
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
                    <Button variant="destructive" size="lg" className="rounded-md" onClick={register} type="button">Register</Button>
                </div>
            </form>
        </div>
    )
}

export { Login }
