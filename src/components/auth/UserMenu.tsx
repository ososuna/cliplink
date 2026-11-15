import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { authClient } from '@/auth/client';
import UserAvatar from '@/components/auth/UserAvatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type Props = { name: string; image: string | null };

const UserMenu = ({ name, image }: Props) => {
  // Workaround for https://github.com/withastro/astro/issues/10863
  const [open, setOpen] = useState(false);

  const signOut = async () => {
    await authClient.signOut();
    // A full load, so the persisted navbar and every island drop the old session.
    window.location.assign('/');
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        aria-label={name}
        className="rounded-full"
        onClick={() => setOpen((value) => !value)}
      >
        <UserAvatar name={name} image={image} className="h-8 w-8" decorative />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{name}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href="/dashboard">Dashboard</a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href="/my-account">My Account</a>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={signOut}>
          <LogOut /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserMenu;
