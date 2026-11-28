import { AvatarWithBadge } from "@/components/ui/avatar-with-badge"
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "react-router-dom";
import { useUser } from "@/context/AuthContext"
import { Spinner } from "./ui/spinner";
import { toast } from "@/components/ui/toast"
import {ModeToggle} from '@/components/ThemeToggle'


function Navbar() {
    const { user, loading, session, logout } = useUser()
    async function handleLogout() {
        try {
            await logout(session)
        } catch {
            if (!session.signal.aborted) toast.add({ title: "Could not confirm logout. Try again.", type: "error" })
        }
    }

    const user_username = user?.username ?? ""
    

    return (

        <header className="flex justify-between items-center md:grid md:grid-cols-[1fr_auto_1fr] h-fit min-h-12.5 shrink-0  border-2 p-2 rounded-md bg-card ">
            {/* Left: logo */}
            <div className="min-w-0">
                <Button variant="ghost" size="sm" render={<button type="button" />}>
                    <Link to="/">
                        <div className="flex flex-row font-bold text-lg">
                            <h2>Study</h2>
                            <h2 className="text-primary">Desk</h2>
                        </div>
                    </Link>
                </Button>
            </div>

            {/* Mobile menu (hidden on md+) */}
            <div className="flex flex-row gap-2.5 items-center md:hidden">
                <ModeToggle/>
                <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="default" size="sm" className="rounded-lg px-2" render={<button type="button" />}> <Menu /> </Button>} />
                    <DropdownMenuContent>
                        <DropdownMenuGroup>
                            <DropdownMenuItem render={<Link to="/library" />}>
                                Library
                            </DropdownMenuItem>
                            <DropdownMenuItem render={<Link to="/settings" />}>
                                Settings
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={handleLogout}>
                                Logout
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Desktop nav buttons (hidden on mobile) */}
            <div className="flex-row gap-2.5 items-center hidden md:flex shrink-0 whitespace-nowrap">
                <Button variant="ghost" size="xs" className="font-semibold" render={<button type="button" />}>
                    Note
                </Button>
                <Button variant="ghost" size="xs" className="font-semibold" render={<button type="button" />}>
                    Form
                </Button>
                <Button variant="ghost" size="xs" className="font-semibold" render={<button type="button" />}>
                    File
                </Button>
                <Button variant="ghost" size="xs" className="font-semibold" render={<button type="button" />}>
                    Event
                </Button>
                <Button variant="ghost" size="xs" className="font-semibold" render={<button type="button" ></button>}>
                    <Link to="/library">
                        Library
                    </Link>
                </Button>
                <Button variant="ghost" size="xs" className="font-semibold" render={<button type="button"></button>}>
                    <Link to="/settings">
                        Settings
                    </Link>
                </Button>
            </div>

            {/* Desktop right: username + avatar (hidden on mobile) */}
            <div className="hidden md:flex min-w-0 flex-row gap-2.5 items-center justify-end">
                <ModeToggle/>
                {!loading ? <p className="max-w-60 truncate">Hello {user_username}!</p> : <Spinner />}
                <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="rounded-full shrink-0" type="button"><AvatarWithBadge username={user_username}></AvatarWithBadge></Button>} />
                    <DropdownMenuContent className="w-32">
                        <DropdownMenuGroup>
                            <DropdownMenuItem className="text-destructive" onClick={handleLogout}>
                                Logout
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

        </header>
    )
}

export { Navbar };
