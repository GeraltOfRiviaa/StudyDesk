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
import { useNavigate } from "react-router-dom"
import { useEffect, useState } from "react"
import { useUser } from "@/AuthContext"
import { Spinner } from "./ui/spinner";
import { api } from '@/api'


function Navbar() {
    const { setUser } = useUser()
    const { user, loading } = useUser()
    const navigate = useNavigate()
    const logout = async () => {
        await api("/auth/logout", { method: "POST" })
        setUser(null)
        navigate("/")
    }

    const user_username = user?.username ?? ""
    

    return (

        <header className="flex justify-between items-center md:grid md:grid-cols-[1fr_auto_1fr] h-fit min-h-12.5 mx-4 border-2 p-2 rounded-md bg-card md:mt-4">
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
                            <DropdownMenuItem className="text-destructive" onClick={logout}>
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

            {/* Desktop right: nickname + avatar (hidden on mobile) */}
            <div className="hidden md:flex min-w-0 flex-row gap-2.5 items-center justify-end">

                {!loading ? <p className="...">Hello {user_username}!</p> : <Spinner />}
                <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="rounded-full shrink-0" type="button"><AvatarWithBadge nickname={user_username}></AvatarWithBadge></Button>} />
                    <DropdownMenuContent className="w-32">
                        <DropdownMenuGroup>
                            <DropdownMenuItem className="text-destructive" onClick={logout}>
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
