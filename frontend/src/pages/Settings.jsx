import { Button } from "@/components/ui/button"
import {
    InputGroup,
    InputGroupInput,
} from "@/components/ui/input-group"

function Settings({nickname, email}) {
    return (
        <div id="settings-mobile" className="flex flex-col px-4 py-6 max-w-100 lg:max-w-150 mx-auto">
            <div className="flex flex-col my-2 gap-3 justify-between">
                <p className="font-semibold text-xl">Nickname</p>
                <InputGroup>
                    <InputGroupInput placeholder={nickname} />
                </InputGroup>
            </div>
            <div className="flex flex-col my-2 gap-3 justify-between">
                <p className="font-semibold text-xl">Email</p>
                <InputGroup>
                    <InputGroupInput placeholder={email} />
                </InputGroup>
            </div>
            <div className="flex flex-row justify-between mt-4 ">
                <Button variant="default" size="lg" className="rounded-md">Change password</Button>
                <Button variant="destructive" size="lg" className="rounded-md">Delete account</Button>
            </div>
        </div>
    )
}

export { Settings }