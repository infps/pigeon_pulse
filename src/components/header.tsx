"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";
import { LogOut, User, Shield, Bell, Settings } from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";
import { SettingsDialog } from "@/components/settings-dialog";
import { useState } from "react";

export function Header() {
  const pathname = usePathname();
  const { data: session } = authClient.useSession();
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Don't show header on admin pages
  if (pathname?.startsWith("/admin")) {
    return null;
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleLogout = async () => {
    await authClient.signOut();
  };

  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "SUPERADMIN";

  return (
    <header className="sticky top-0 left-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between">
        {/* Left side - Brand/Logo + Nav */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-xl font-bold">agn</span>
          </Link>
          {session?.user && (
            <nav className="hidden md:flex items-center gap-1">
              <Link href="/birds">
                <Button variant="ghost" size="sm">Birds</Button>
              </Link>
              <Link href="/races">
                <Button variant="ghost" size="sm">Races</Button>
              </Link>
              <Link href="/races/calendar">
                <Button variant="ghost" size="sm">Calendar</Button>
              </Link>
              <Link href="/payments">
                <Button variant="ghost" size="sm">Payments</Button>
              </Link>
              <Link href="/teams">
                <Button variant="ghost" size="sm">Teams</Button>
              </Link>
            </nav>
          )}
        </div>

        {/* Right side - Auth & Updates */}
        <div className="flex items-center gap-4">
          <Link href="/updates">
            <Button variant="ghost">Updates</Button>
          </Link>
          {session?.user && (
            <Link href="/notifications" aria-label="Notifications">
              <Button variant="ghost" size="icon">
                <Bell className="h-5 w-5" />
              </Button>
            </Link>
          )}
          <ModeToggle />

          {session?.user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0">
                  <Avatar>
                    <AvatarImage src={session.user.image || undefined} alt={session.user.name} />
                    <AvatarFallback>{getInitials(session.user.name)}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{session.user.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">{session.user.email}</p>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin" className="cursor-pointer">
                      <Shield className="mr-2 h-4 w-4" />
                      Admin
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => setSettingsOpen(true)}
                  className="cursor-pointer"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Display Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost">Sign In</Button>
              </Link>
              <Link href="/signup">
                <Button>Register</Button>
              </Link>
            </>
          )}
        </div>
      </div>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </header>
  );
}
