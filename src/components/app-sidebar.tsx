"use client"

import {
  BadgeCheck,
  Bird,
  CalendarDays,
  ChevronUp,
  CreditCard,
  Database,
  FileText,
  HelpCircle,
  Home,
  LogOut,
  Megaphone,
  Package,
  Printer,
  Settings,
  ShieldCheck,
  Trophy,
  User2,
  Users,
} from "lucide-react"
import { useState } from "react"
import { SettingsDialog } from "@/components/settings-dialog"
import { HelpDialog } from "@/components/help-dialog"
import Link from "next/link"
import { useRouter } from "next/navigation"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { authClient } from "@/lib/auth-client"
import { usePermissions } from "@/hooks/usePermissions"

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  userRole?: "BREEDER" | "ADMIN" | "SUPERADMIN"
  userName?: string
  userEmail?: string
  userImage?: string
}

// Menu items for all users
const mainMenuItems = [
  {
    title: "Breeders",
    url: "/admin/users",
    permission: "users.view",
    icon: Users,
    roles: ["ADMIN", "SUPERADMIN"],
  },
  {
    title: "Schemes",
    url: "/admin/schemes",
    permission: "schemes.manage",
    icon: FileText,
    roles: ["ADMIN", "SUPERADMIN"],
  },
  {
    title: "Events",
    url: "/admin/events",
    permission: "events.view",
    icon: CalendarDays,
    roles: ["ADMIN", "SUPERADMIN"],
  },
  {
    title: "Birds",
    url: "/admin/birds",
    permission: "birds.view",
    icon: Bird,
    roles: ["ADMIN", "SUPERADMIN"],
  },
  {
    title: "Reports",
    url: "/admin/reports",
    permission: "reports.view",
    icon: Printer,
    roles: ["ADMIN", "SUPERADMIN"],
  },
  {
    title: "Notifications",
    url: "/admin/notifications",
    permission: "notifications.view",
    icon: Megaphone,
    roles: ["ADMIN", "SUPERADMIN"],
  },
]

// Menu items only for super admin
const superAdminMenuItems = [
  {
    title: "Race Types",
    url: "/admin/race-types",
    permission: "schemes.manage",
    icon: BadgeCheck,
    roles: ["SUPERADMIN"],
  },
  {
    title: "Event Types",
    url: "/admin/event-types",
    permission: "events.manage",
    icon: CreditCard,
    roles: ["SUPERADMIN"],
  },
  {
    title: "Permissions",
    url: "/admin/permissions",
    permission: "users.permissions",
    icon: ShieldCheck,
    roles: ["SUPERADMIN"],
  },
  {
    title: "Schema",
    url: "/admin/schema",
    permission: "users.permissions",
    icon: Database,
    roles: ["SUPERADMIN"],
  },
]

export function AppSidebar({
  userRole = "BREEDER",
  userName = "User",
  userEmail = "",
  userImage,
  ...props
}: AppSidebarProps) {
  const router = useRouter()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  // Menus are filtered by permission as well as role, so an admin who has had a
  // module revoked stops seeing the door to it rather than finding it locked.
  const { can, isPending: permissionsLoading } = usePermissions()

  const handleLogout = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/")
        },
      },
    })
  }

  // Filter menu items based on user role
  const filteredMainMenu = mainMenuItems.filter((item) =>
    item.roles.includes(userRole) &&
      (permissionsLoading || !item.permission || can(item.permission))
  )
  const filteredSuperAdminMenu = superAdminMenuItems.filter((item) =>
    item.roles.includes(userRole) &&
      (permissionsLoading || !item.permission || can(item.permission))
  )

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarContent>
        {/* Main Menu Section */}
        <SidebarGroup>
          <SidebarGroupLabel>Main Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredMainMenu.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Super Admin Section */}
        {filteredSuperAdminMenu.length > 0 && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Administration</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {filteredSuperAdminMenu.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <Link href={item.url}>
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}

        {/* Help — always available */}
        <SidebarSeparator />
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setHelpOpen(true)}>
                  <HelpCircle />
                  <span>Help & Guide</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* User Profile Footer */}
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                    {userImage ? (
                      <img
                        src={userImage}
                        alt={userName}
                        className="size-8 rounded-lg"
                      />
                    ) : (
                      <User2 className="size-4" />
                    )}
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{userName}</span>
                    <span className="truncate text-xs text-sidebar-foreground/70">
                      {userEmail}
                    </span>
                  </div>
                  <ChevronUp className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="bottom"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuItem asChild>
                  <Link href="/admin/profile" className="cursor-pointer">
                    <User2 className="mr-2 size-4" />
                    <span>Profile</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setSettingsOpen(true)}
                  className="cursor-pointer"
                >
                  <Settings className="mr-2 size-4" />
                  <span>Display Settings</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 size-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </Sidebar>
  )
}
