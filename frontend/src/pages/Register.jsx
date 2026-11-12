import { Button } from "@/components/ui/button"
import {
    InputGroup,
    InputGroupInput,
} from "@/components/ui/input-group"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "@/components/ui/toast"
import {EyeIcon, EyeOffIcon} from "lucide-react"

//import { useNavigate } from "react-router-dom"

function Register() {


    const register_url = import.meta.env.VITE_API_URL + "/auth/register"
    //const user_url = import.meta.env.VITE_API_URL + "/auth/user"
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [email, setEmail] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const API_OPTIONS = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            email: email,
            username: username, 
            password: password 
        })
    }



    //check to see if the fields are not empty
    const login = async () => {
        console.log("clicked")
        if ((username == "") || (password == "")) {
            toast.add({
                title: "Could not register a user",
                description: "Please enter password and nickname",
                type: "error"
            })
        } else {
            try {
                const response = await fetch(register_url, API_OPTIONS)
                if (!response.ok) {
                    throw new Error("HTTP error: " + response.status)
                }
                navigate('/')
            } catch (err) {
                console.log('Error when registering' + err)
                toast.add({
                    title: "Could not register user a user",
                    description: err,
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
                    <p className="font-semibold text-xl">Email</p>
                    <InputGroup>
                        <InputGroupInput placeholder="SmartBoy" value={email} onChange={(e) => setEmail(e.target.value)}  type="email"/>
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
            <div id="login-tablet-pc" className="flex-col px-4 py-6 max-w-120 mx-auto hidden md:flex">
                <h1 className="font-bold text-4xl text-center py-10">Login</h1>
                <div className="flex flex-row my-2 gap-3 justify-between">
                    <p className="font-semibold text-xl">Username</p>
                    <InputGroup className="max-w-70">
                        <InputGroupInput placeholder="SmartBoy" value={username} onChange={(e) => setUsername(e.target.value)} />
                    </InputGroup>
                </div>
                <div className="flex flex-row my-2 gap-3 justify-between">
                    <p className="font-semibold text-xl">Email</p>
                    <InputGroup className="max-w-70">
                        <InputGroupInput placeholder="smartboy@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </InputGroup>
                </div>
                <div className="flex flex-row my-2 gap-3 justify-between">
                    <p className="font-semibold text-xl">Password</p>
                    <InputGroup className="max-w-70">
                            <InputGroupInput
                                placeholder="verySecretPassword"
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
                    <Button variant="default" size="lg" className="rounded-md" onClick={login} render={<button type="button" />}>Register</Button>
                    <Button variant="secondary" size="lg" className="rounded-md" render={<button type="button" />}>Login</Button>
                </div>
            </div>
        </>


    )
}

export { Register }
