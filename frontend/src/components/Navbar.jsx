import { AvatarBadge } from "@/components/ui/avatar";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "react-router-dom";

function Navbar() {
    return (
        <div className=" flex justify-between w-full h-fit min-h-12.5">
            <h2>Study</h2>
            <h2 className="text-primary">Desk</h2>
            <div className="gap-2.5">
                <AvatarBadge />
                {/*Instead of Sam use the name of the user*/}
                <p>Hello Sam!</p>

                <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="default" />}>
                        <Menu />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuGroup>
                            <DropdownMenuLabel>
                                <Link to="/library"> Library</Link>
                            </DropdownMenuLabel>
                            <DropdownMenuItem>
                                <Link to="/settings">Settings</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                <Link to="/settings" className="text-destructive">Logout</Link>
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}

export { Navbar };
