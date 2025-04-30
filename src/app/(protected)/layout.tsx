import React from "react";
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation";


import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/sidebar/app-sidebar";

import "../globals.css";


export default async function ProtectedLayout({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  const session = await auth();
  if (!session) {
    redirect("/auth/signin");
  }

  return (
    <>
      <SidebarProvider defaultOpen={true}>
        <AppSidebar />
        <main className=" flex flex-col w-full p-4">
          <SidebarTrigger className="md:hidden fixed top-4 left-4 z-50" />
          {children}
        </main>
      </SidebarProvider>
    </>
  );
}