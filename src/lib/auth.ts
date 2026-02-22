// auth.ts
import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import { compare } from "bcryptjs";
import CredentialsProvider from "next-auth/providers/credentials";
import { Role } from "@prisma/client"

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
        async authorize(creds): Promise<{ id: string; email: string; name: string; role: Role } | null> {
            const { email, password } = creds as Credentials;
            if (!email || !password) throw new Error("Credenciales inválidas");
    
            const user = await prisma.user.findUnique({ where: { email } });
            // Solo roles con acceso al panel de administración
            if (!user || user.role === Role.READ_ONLY) throw new Error("Acceso denegado");
    
            const ok = await compare(password, user.password);
            if (!ok) throw new Error("Credenciales inválidas");
    
            return { id: user.id.toString(), email: user.email, name: user.name ?? "", role: user.role };
          },
    }),
  ],
    callbacks: {
        async jwt({ token, user }) {
        if (user) {
            token.sub = user.id;
            // Propagar el rol en el token para evitar consultas a DB en cada request
            token.role = (user as { role?: Role }).role
        }
        return token;
        },
        async session({ session, token }) {
        if (session.user && token.sub) {
            session.user.id = token.sub;
            session.user.role = token.role as Role;
        }
        return session;
        },
    },
    
    pages: {
        signIn: "/auth/signin",
    },
    
    debug: process.env.NODE_ENV === "development",
});