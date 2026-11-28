import { Button } from "@/components/ui/button"
import {
    InputGroup,
    InputGroupInput,
} from "@/components/ui/input-group"
import { useNavigate } from 'react-router-dom';
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, Controller } from "react-hook-form"
import { UpdateUserSchema } from '../schemas'
import { api } from '@/api/client'
import { identityConflictMessage } from "@/api/accountApi"
import { toast } from "@/components/ui/toast"
import { useUser} from "@/context/AuthContext"
import { DeleteAccountButton } from "@/components/settings/DeleteAccountButton"

function Settings() {
    const { user, refreshUser } = useUser()
    const navigate = useNavigate()

    async function onSubmit(data) {
        /*Keep only fields the user actually filled in*/
        const changes = {}
        for (const [key, value] of Object.entries(data)) {
            if (value) changes[key] = value
        }

        try {
            await api("/auth/me", { method: "PATCH", json: changes })
            await refreshUser()
            form.reset()
            toast.add({ title: "User updated", type: "success" })
        } catch (err) {
            toast.add({
                title: "Could not update the user",
                description: await identityConflictMessage(err) ?? "Try again later",
                type: "error",
            })
        }
    }
    const form = useForm({
        /*Replace RegisterSchema with yours*/
        resolver: zodResolver(UpdateUserSchema),
        /*Leave the default values empty unless you want the user
        to see some values inserted into the fields. 
        The user will have to delete them first if they are there*/
        defaultValues: { username: "", email: "", password: "" },
    })
    const changePassword = () => {
        navigate("/settings/change/password")
    }

    return (
        <div className="flex flex-col px-4 py-6 max-w-100 lg:max-w-150 mx-auto">
            <form id="settings-mobile" onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col">
                <Controller
                    name="username"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <div className="flex flex-col my-2 gap-3 justify-between">
                            <p className="font-semibold text-xl">Username</p>
                            <InputGroup>
                                <InputGroupInput
                                    {...field}
                                    placeholder={user.username}
                                    autoComplete="username"
                                    aria-invalid={fieldState.invalid} />
                            </InputGroup>
                            {fieldState.invalid && (
                                <p className="text-sm text-destructive">
                                    {fieldState.error?.message}</p>
                            )}
                        </div>
                    )}
                />


                <Controller
                    name="email"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <div className="flex flex-col my-2 gap-3 justify-between">
                            <p className="font-semibold text-xl">Email</p>
                            <InputGroup>
                                <InputGroupInput
                                    {...field}
                                    placeholder={user.email}
                                    autoComplete="email"
                                    aria-invalid={fieldState.invalid} />
                            </InputGroup>
                            {fieldState.invalid && (
                                <p className="text-sm text-destructive">
                                    {fieldState.error?.message}</p>
                            )}
                        </div>
                    )}
                />
            </form>

            <div className="flex flex-row justify-between mt-4 ">
                <Button variant="default" size="sm" className="rounded-md" type="submit" form="settings-mobile">Save</Button>
                <Button variant="outline" size="sm" className="rounded-md" type="button" onClick={changePassword}>Change password</Button>
                <DeleteAccountButton />
            </div>
        </div>
    )
}

export { Settings }
