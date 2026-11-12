import { Button } from "@/components/ui/button"
import {
    InputGroup,
    InputGroupInput,
} from "@/components/ui/input-group"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "@/components/ui/toast"
import { EyeIcon, EyeOffIcon } from "lucide-react"

//import { useNavigate } from "react-router-dom"

function Login() {


    const login_url = import.meta.env.VITE_API_URL + "/auth/login"
    //const user_url = import.meta.env.VITE_API_URL + "/auth/user"
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const API_OPTIONS = {
        method: "POST",
        body: new URLSearchParams({ username: username, password })
    }


    const register = () => {
        navigate('/register')
    }
    //check to see if the fields are not empty
    const login = async () => {
        console.log("clicked")
        if ((username == "") || (password == "")) {
            toast.add({
                title: "Could not authenticate a user",
                description: "Please enter password and nickname",
                type: "error"
            })
        } else {
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
                }) // add actual error message toast, for now it doesn nothing
            }
        }
    };

    return (
        <>
            <div id="login-mobile" className="flex flex-col px-4 py-6 max-w-100 md:hidden lg:max-w-150 mx-auto">
                <h1 className="font-bold text-4xl text-center py-10">Login</h1>
                <div className="flex flex-col my-2 gap-3 justify-between">
                    <p className="font-semibold text-xl">Username</p>
                    <InputGroup>
                        <InputGroupInput placeholder="SmartBoy" value={username} onChange={(e) => setUsername(e.target.value)} />
                    </InputGroup>
                </div>
                <div className="flex flex-col my-2 gap-3 justify-between">
                    <p className="font-semibold text-xl">Password</p>
                    <InputGroup>
                        <InputGroupInput
                            placeholder="..."
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            type={showPassword ? "text" : "password"}
                            autoComplete="current-password"
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
                </div>
                <div className="flex flex-row justify-between mt-4 ">
                    <Button variant="default" size="lg" className="rounded-md" onClick={login} render={<button type="button" />}>Login</Button>
                    <Button variant="destructive" size="lg" className="rounded-md" render={<button type="button" />}>Register</Button>
                </div>
            </div>
            <div id="login-tablet-pc" className="flex-col px-4 py-6 max-w-100 mx-auto hidden md:flex   lg:max-w-150 ">
                <h1 className="font-bold text-4xl text-center py-10">Login</h1>
                <div className="flex flex-row my-2 gap-3 justify-between">
                    <p className="font-semibold text-xl">Username</p>
                    <InputGroup>
                        <InputGroupInput placeholder="SmartBoy" value={username} onChange={(e) => setUsername(e.target.value)} />
                    </InputGroup>
                </div>
                <div className="flex flex-row my-2 gap-3 justify-between">
                    <p className="font-semibold text-xl">Password</p>
                    <InputGroup>
                        <InputGroupInput
                            placeholder="..."
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            type={showPassword ? "text" : "password"}
                            autoComplete="current-password"
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
                </div>
                <div className="flex flex-row justify-between mt-4 ">
                    <Button variant="default" size="lg" className="rounded-md" onClick={login} render={<button type="button" />}>Login</Button>
                    <Button variant="destructive" size="lg" className="rounded-md" onClick={register} render={<button type="button" />}>Register</Button>
                </div>
            </div>
        </>


    )
}

export { Login }
