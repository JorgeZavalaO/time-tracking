// auth.ts
import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import { compare } from "bcryptjs";
import CredentialsProvider from "next-auth/providers/credentials";

type Credentials = { email: string; password: string };

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma), // Adapter for Prisma  
  session: { strategy: "jwt"}, // session strategy
  // proveedor de credenciales
  providers: [
    CredentialsProvider({
        name: "Administrador",
        credentials:{
            email:{ label: "Email", type: "email"},
            password:{ label: "password", type: "password"},
        },
        async authorize(creds): Promise<{ id: string; email: string; name: string } | null> {
            const { email, password } = creds as Credentials;
            if (!email || !password) throw new Error("Credenciales inválidas");
    
            // Ahora busca en User
            const user = await prisma.user.findUnique({ where: { email } });
            if (!user || user.role !== "admin") throw new Error("Acceso denegado");
    
            const ok = await compare(password, user.password);
            if (!ok) throw new Error("Credenciales inválidas");
    
            return { id: user.id.toString(), email: user.email, name: user.name ?? "" };
          },
    }),
  ],
    // --- 4) Callbacks para inyectar el ID en token y sesión ---
    callbacks: {
        async jwt({ token, user }) {
        if (user) {
            token.sub = user.id;
            // Puedes agregar más datos al token si lo necesitas
        }
        return token;
        },
        async session({ session, token }) {
        if (session.user && token.sub) {
            session.user.id = token.sub;
        }
        return session;
        },
    },
    
    // --- 5) Páginas personalizadas (opcional) ---
    pages: {
        signIn: "/auth/signin",
    },
    
    debug: process.env.NODE_ENV === "development", // Desactiva en producción
});