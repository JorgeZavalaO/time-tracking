"use client"
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock7, LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import dayjs from "dayjs";
import { toast } from "sonner"


export default function Home(){
  const router = useRouter();
  const[loading, setLoading] = useState(false)
  const [dni, setDni] = useState("")

  async function handleRegister() {
    setLoading(true)
    const res = await fetch("/api/access", {
      method: "POST",
      headers: { "Content-Type": "application/json"},
      body: JSON.stringify({dni}),
      })

    setLoading(false)

    const data = await res.json()
    if(!res.ok) {
      toast.error(data.message)
      return
    }

    const hora = dayjs(data.timestamp).format("HH:mm:ss")
    toast.success(
      data.status === "ON_TIME"
        ? `Entrada registrada ${hora} (puntual)`
        : `Tardanza registrada ${hora}`
    )
    setDni("")
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-white border-b">
        <div className="flex items-center justify-between px-6 py-2">
          <h1 className="font-bold text-xl">Sistema de control de entrada</h1>
          <Button variant="outline" onClick={() => router.push('/auth/signin')}>
            <LogIn/>
            Acceso Administrativo
          </Button>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-8">
        <section className="text-center py-12">
          <h2 className="text-2xl font-bold mb-4">Control de entrada</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">Sistema moderno para el registro de entrada de empleados al almacén, gestión de tardanzas y generación de informes.</p>
        </section>
        <div>
          <Card className="max-w-md mx-auto mb-12">
            <CardHeader className="text-center">
              <CardTitle>Registro de Entrada</CardTitle>
              <CardDescription>Registre su entrada al almacen</CardDescription>
            </CardHeader>
            <CardContent>
            <div className="space-y-4">
              <Label htmlFor="dni">DNI</Label>
              <Input 
                id="DNI"
                value={dni}
                placeholder="Ingrese su DNI (12346578)" 
                maxLength={8}
                onChange={(e) => setDni(e.target.value.replace(/\D/g,""))}
              />
            </div>
            </CardContent>
            <CardFooter >
              <Button 
                className="w-full"
                disabled={loading || dni.length !== 8}
                onClick={handleRegister}
              >
                <Clock7/>
                {loading ? "Registrando…" : "Registra entrada ahora"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </main>
      <footer className="text-center bg-muted py-4">
        <p>© {new Date().getFullYear()} Sistema de Control de Entrada. Todos los derechos reservados.</p>
      </footer>
    </div>

  )
}