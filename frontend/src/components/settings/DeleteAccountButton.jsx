import { useRef, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { deleteAccount } from "@/api/accountApi"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useUser } from "@/context/AuthContext"
import { refreshAccountQueries } from "@/lib/accountQueries"

export function DeleteAccountButton() {
    const [open, setOpen] = useState(false)
    const confirmation = useRef(null)
    const { clearSession, session } = useUser()
    const queryClient = useQueryClient()
    const deletion = useMutation({
        // Keep the password out of mutation variables, which are stored in the cache.
        mutationFn: () => {
            session.signal.throwIfAborted()
            return deleteAccount(confirmation.current, { signal: session.signal })
        },
        networkMode: "always",
        retry: false,
        onSuccess: () => clearSession({ accountDeleted: true, expectedSession: session }),
        onError: (error) => {
            // Cleanup may have removed some documents before the failure.
            if (error.cause?.status === 503) void refreshAccountQueries(queryClient, session)
        },
    })

    function handleOpenChange(nextOpen) {
        if (confirmation.current !== null) return
        if (!nextOpen) deletion.reset()
        setOpen(nextOpen)
    }

    async function handleSubmit(event) {
        event.preventDefault()
        if (confirmation.current !== null) return

        const form = event.currentTarget
        const password = new FormData(form).get("password")
        if (!password) return

        confirmation.current = password
        form.reset()
        try {
            await deletion.mutateAsync()
        } catch {
            // The mutation error is shown inside the dialog.
        } finally {
            confirmation.current = null
        }
    }

    const { isPending, error } = deletion
    const incorrectPassword = error?.cause?.status === 400

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger
                render={<Button variant="destructive" size="sm" className="rounded-md" type="button" />}
            >
                Delete account
            </DialogTrigger>
            <DialogContent showCloseButton={false}>
                <DialogHeader>
                    <DialogTitle>Delete account?</DialogTitle>
                    <DialogDescription>
                        This permanently deletes your account and all your StudyDesk data.
                        Enter your password to confirm.
                    </DialogDescription>
                </DialogHeader>
                <form className="grid gap-4" onSubmit={handleSubmit}>
                    <div className="grid gap-2">
                        <Label htmlFor="delete-account-password">Password</Label>
                        <Input
                            id="delete-account-password"
                            name="password"
                            type="password"
                            autoComplete="current-password"
                            required
                            disabled={isPending}
                            aria-invalid={incorrectPassword}
                            aria-describedby={incorrectPassword ? "delete-account-error" : undefined}
                        />
                    </div>
                    {error && (
                        <p id="delete-account-error" role="alert" className="text-destructive">
                            {error.message}
                        </p>
                    )}
                    <DialogFooter>
                        <DialogClose render={<Button type="button" variant="outline" disabled={isPending} />}>
                            Cancel
                        </DialogClose>
                        <Button type="submit" variant="destructive" disabled={isPending}>
                            {isPending ? "Deleting account…" : "Delete account"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
