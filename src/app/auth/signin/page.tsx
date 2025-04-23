"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export default function SingInPage() {
    const [email, setEmail] = useState("")
    const  [password, setPassword] = useState("")
    const[loading, setLoading] = useState(false)
    const router = useRouter() // para redireccion despues de iniciar sesion

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        const res = await signIn("credentials", {
            redirect: false,
            email,
            password,
        })

        setLoading(false)

        if (res?.ok) router.push("/registros")
            else alert(res?.error ?? "Error de autenticacion")
    }
    return (
        <div className="flex item-center justify-center mnin-h-screen bg-gray-100">
            <form 
                onSubmit={handleSubmit}
                className="bg-card rounded-lg shadow-md w-full maz-w-sm p-6 space-y-4"
            >
                <h1 className="text-2xl font-semibold text-center">Iniciar sesión</h1>
                <label className="block space-y-1">
                    <span className="text-sm">Email</span>
                    <Input
                        type="email"
                        placeholder="admin@empresa.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </label>

                <label className="block space-y-1">
                    <span className="text-sm">Contraseña</span>
                    <Input 
                        type="password"
                        placeholder="********"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </label>

                <Button
                    type="submit"
                    className="w-full"
                    disabled={loading}
                >
                    {loading?"Entrando..." : "Entrar"}
                </Button>
            </form>
        </div>
    )
}