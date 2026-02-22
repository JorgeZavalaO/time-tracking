"use client"

import { Calendar, Home, UserRound, Search, Settings, ClipboardList } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { useSession } from "next-auth/react"
import { Role } from "@prisma/client"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar"
import { NavUser } from "./nav-user"

// Roles que pueden ver cada sección
const ALL_ROLES = [Role.ADMIN, Role.RRHH, Role.SUPERVISOR, Role.READ_ONLY]
const WRITE_ROLES = [Role.ADMIN, Role.RRHH]
const ADMIN_ONLY = [Role.ADMIN]

const MenuAlmacen = [
  {
    title: "Dashboard",
    url: "/",
    icon: Home,
    roles: ALL_ROLES,
  },
  {
    title: "Empleados",
    url: "/empleados",
    icon: UserRound,
    roles: WRITE_ROLES,
  },
  {
    title: "Informes",
    url: "/informes",
    icon: Calendar,
    roles: ALL_ROLES,
  },
  {
    title: "Registros de entradas",
    url: "/registros",
    icon: Search,
    roles: ALL_ROLES,
  },
  {
    title: "Correcciones",
    url: "/correcciones",
    icon: ClipboardList,
    roles: WRITE_ROLES,
  },
  {
    title: "Configuración",
    url: "/configuracion",
    icon: Settings,
    roles: ADMIN_ONLY,
  },
]

export function AppSidebar() {
  const { data: session } = useSession()
  const userRole = session?.user?.role as Role | undefined

  const visibleItems = userRole
    ? MenuAlmacen.filter((item) => item.roles.includes(userRole))
    : []

  const userData = {
    name: session?.user?.name ?? "Usuario",
    email: session?.user?.email ?? "",
    avatar: "https://upload.wikimedia.org/wikipedia/commons/9/99/Sample_User_Icon.png",
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <Image src="/next.svg" alt="logo" width={80} height={48} className="h-12 w-20" />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menú</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => (
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
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={userData} />
      </SidebarFooter>
    </Sidebar>
  )
}
