import { Button } from "@/components/ui/button"
import {
    InputGroup,
    InputGroupInput,
} from "@/components/ui/input-group"

function Login() {

    const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  //check to see if the fields are not empty
  const login = () => {
    if ((username == "") & (password == "")) {
      return;
    } else {
      // make api call to our backend. we'll leave this for later
    }
  };

    return (
        <>
        <div id="login-mobile" className="flex flex-col px-4 py-6 max-w-100 md:hidden lg:max-w-150 mx-auto">
            <h1 className="font-bold text-4xl text-center py-10">Login</h1>
            <div className="flex flex-col my-2 gap-3 justify-between">
                <p className="font-semibold text-xl">Username</p>
                <InputGroup>
                    <InputGroupInput placeholder="SmartBoy" />
                </InputGroup>
            </div>
            <div className="flex flex-col my-2 gap-3 justify-between">
                <p className="font-semibold text-xl">Password</p>
                <InputGroup>
                    <InputGroupInput placeholder="..." />
                </InputGroup>
            </div>
            <div className="flex flex-row justify-between mt-4 ">
                <Button variant="default" size="lg" className="rounded-md">Login</Button>
                <Button variant="destructive" size="lg" className="rounded-md">Register</Button>
            </div>
        </div>
        <div id="login-tablet-pc" className="flex-col px-4 py-6 max-w-100 mx-auto hidden md:flex   lg:max-w-150 ">
            <h1 className="font-bold text-4xl text-center py-10">Login</h1>
            <div className="flex flex-row my-2 gap-3 justify-between">
                <p className="font-semibold text-xl">Username</p>
                <InputGroup>
                    <InputGroupInput placeholder="SmartBoy" />
                </InputGroup>
            </div>
            <div className="flex flex-row my-2 gap-3 justify-between">
                <p className="font-semibold text-xl">Password</p>
                <InputGroup>
                    <InputGroupInput placeholder="..." />
                </InputGroup>
            </div>
            <div className="flex flex-row justify-between mt-4 ">
                <Button variant="default" size="lg" className="rounded-md">Login</Button>
                <Button variant="destructive" size="lg" className="rounded-md">Register</Button>
            </div>
        </div>
        </>
        
        
    )
}

export { Login }