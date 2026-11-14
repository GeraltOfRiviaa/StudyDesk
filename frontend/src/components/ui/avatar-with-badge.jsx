import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
} from "@/components/ui/avatar"

export function AvatarWithBadge({username}) {
  const avatar_name = username.slice(0,2).toUpperCase()
  return (
    <Avatar>
      <AvatarFallback>
        {
        avatar_name
        }
      </AvatarFallback>
      <AvatarBadge className="bg-green-600 dark:bg-green-800" />
    </Avatar>
  )
}
