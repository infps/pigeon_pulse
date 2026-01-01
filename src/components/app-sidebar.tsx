"use client"

import {
  BadgeCheck,
  Bird,
  CalendarDays,
  ChevronUp,
  CreditCard,
  FileText,
  Home,
  LogOut,
  Package,
  Trophy,
  User2,
  Users,
} from "lucide-react"
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
    url: "/admin/breeders",
    icon: Users,
    roles: ["ADMIN", "SUPERADMIN"],
  },
  {
    title: "Schemes",
    url: "/admin/schemes",
    icon: FileText,
    roles: ["ADMIN", "SUPERADMIN"],
  },
  {
    title: "Events",
    url: "/admin/events",
    icon: CalendarDays,
    roles: ["ADMIN", "SUPERADMIN"],
  },
  {
    title: "Event Inventory",
    url: "/admin/event-inventory",
    icon: Package,
    roles: ["ADMIN", "SUPERADMIN"],
  },
  {
    title: "Races",
    url: "/admin/races",
    icon: Trophy,
    roles: ["ADMIN", "SUPERADMIN"],
  },
  {
    title: "Birds",
    url: "/admin/birds",
    icon: Bird,
    roles: ["ADMIN", "SUPERADMIN"],
  },
]

// Menu items only for super admin
const superAdminMenuItems = [
  {
    title: "Race Types",
    url: "/admin/race-types",
    icon: BadgeCheck,
    roles: ["SUPERADMIN"],
  },
  {
    title: "Event Types",
    url: "/admin/event-types",
    icon: CreditCard,
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
    item.roles.includes(userRole)
  )
  const filteredSuperAdminMenu = superAdminMenuItems.filter((item) =>
    item.roles.includes(userRole)
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
    </Sidebar>
  )
}
