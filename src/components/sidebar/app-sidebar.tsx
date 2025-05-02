"use client"

import { Calendar, Home, UserRound, Search, Settings } from "lucide-react"

import Link from "next/link"

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
// import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu"
import { NavUser } from "./nav-user"

// Menu items.
const MenuAlmacen = [
  {
    title: "Dashboard",
    url: "/",
    icon: Home,
  },
  {
    title: "Empleados",
    url: "/empleados",
    icon: UserRound,
  },
  {
    title: "Informes",
    url: "/informes",
    icon: Calendar,
  },
  {
    title: "Registros de entradas",
    url: "/registros",
    icon: Search,
  },
  {
    title: "Configuración",
    url: "/configuracion",
    icon: Settings,
  },
]

const data = {
  user: {
    name: "Jorge",
    email: "analista@dimahisac.com",
    avatar: "https://upload.wikimedia.org/wikipedia/commons/9/99/Sample_User_Icon.png",
  }
}

export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarHeader>
        <img src="/next.svg" alt="logo" className="h-12 w-20" />
      </SidebarHeader>
      <SidebarContent>
        {/* <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/">
                <Home /><span>Home</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu> */}
        <SidebarGroup>
          <SidebarGroupLabel>Almacen</SidebarGroupLabel>
          <SidebarGroupContent>
          <SidebarMenu>
            {MenuAlmacen.map((item) => (
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
        <NavUser user={data.user}/>
      </SidebarFooter>
    </Sidebar>
  )
}
