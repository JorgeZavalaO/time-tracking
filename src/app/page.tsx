"use client"
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, Clock7, LogIn, QrCode, ScanLine, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { toast } from "sonner"
import { NumericKeypad } from "@/components/kiosk/NumericKeypad";
import { QrScanner } from "@/components/kiosk/QrScanner";

type KioskMode = "DNI" | "QR"


export default function Home(){
  const router = useRouter();
  const [mode, setMode] = useState<KioskMode>("DNI")
  const [loading, setLoading] = useState(false)
  const [dni, setDni] = useState("")
  const [qrToken, setQrToken] = useState("")
  const [pin, setPin] = useState("")
  const [kioskId, setKioskId] = useState("")
  const [kioskSecret, setKioskSecret] = useState("")
  const [selfieDataUrl, setSelfieDataUrl] = useState<string | null>(null)
  const [lastStatus, setLastStatus] = useState<"ok" | "error" | null>(null)
  const [lastMessage, setLastMessage] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    const savedId = localStorage.getItem("kiosk_id")
    const savedSecret = localStorage.getItem("kiosk_secret")
    if (savedId) setKioskId(savedId)
    if (savedSecret) setKioskSecret(savedSecret)
  }, [])

  const canSubmit = useMemo(() => {
    const hasIdentity = mode === "DNI" ? dni.length === 8 : qrToken.length > 6
    return hasIdentity && pin.length >= 4 && kioskId.length > 0 && kioskSecret.length > 0
  }, [dni.length, kioskId.length, kioskSecret.length, mode, pin.length, qrToken.length])

  async function toDataUrl(file: File): Promise<string> {
    return await new Promise((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(String(fr.result))
      fr.onerror = reject
      fr.readAsDataURL(file)
    })
  }

  async function onSelfieChange(file?: File) {
    if (!file) {
      setSelfieDataUrl(null)
      return
    }
    const url = await toDataUrl(file)
    setSelfieDataUrl(url)
  }

  function onDetectedQr(value: string) {
    setQrToken(value)
    toast.success("QR detectado")
  }

  async function handleRegister() {
    if (!canSubmit) return

    setLoading(true)
    setError("")
    setLastStatus(null)
    setLastMessage("")

    localStorage.setItem("kiosk_id", kioskId)
    localStorage.setItem("kiosk_secret", kioskSecret)

    const res = await fetch("/api/access", {
      method: "POST",
      headers: { "Content-Type": "application/json"},
      body: JSON.stringify({
        method: mode,
        dni: mode === "DNI" ? dni : undefined,
        qr_token: mode === "QR" ? qrToken : undefined,
        pin,
        kiosk_id: Number(kioskId),
        kiosk_secret: kioskSecret,
        device_fingerprint: `${navigator.platform}-${navigator.userAgent.slice(0, 80)}`,
        selfie_data_url: selfieDataUrl ?? undefined,
      }),
      })

    setLoading(false)

    const data = await res.json()
    if(!res.ok) {
      setError(data.message|| "Ocurrió un error desconocido")
      setLastStatus("error")
      setLastMessage(data.message|| "Ocurrió un error desconocido")
      toast.error(data.message|| "Ocurrió un error desconocido")
      return
    }

    const hora = dayjs(data.timestamp).format("HH:mm:ss")
    toast.success(
      data.status === "ON_TIME"
        ? `Entrada registrada ${hora} (puntual)`
        : `Entrada registrada ${hora} (tardanza)`
    )
    setLastStatus("ok")
    setLastMessage(data.status === "ON_TIME" ? "Entrada registrada" : "Entrada registrada con tardanza")
    setDni("")
    setQrToken("")
    setPin("")
    setSelfieDataUrl(null)
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-white border-b">
        <div className="flex items-center justify-between px-6 py-2">
          <h1 className="font-bold text-xl">Kiosko de marcación</h1>
          <Button variant="outline" onClick={() => router.push('/auth/signin')}>
            <LogIn/>
            Acceso Administrativo
          </Button>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-8">
        <section className="text-center py-12">
          <h2 className="text-2xl font-bold mb-4">Modo Kiosko A/B</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">Marca por DNI+PIN o QR+PIN con validación de kiosko autorizado.</p>
        </section>
        <div>
          <Card className="max-w-3xl mx-auto mb-12">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2">
                <ShieldCheck className="size-5" /> Marcación de acceso
              </CardTitle>
              <CardDescription>Configura kiosko y registra entrada/salida segura.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Modo de identificación</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button type="button" variant={mode === "DNI" ? "default" : "outline"} onClick={() => setMode("DNI")}>
                        DNI + PIN
                      </Button>
                      <Button type="button" variant={mode === "QR" ? "default" : "outline"} onClick={() => setMode("QR")}>
                        <QrCode className="size-4" /> QR + PIN
                      </Button>
                    </div>
                  </div>

                  {mode === "DNI" ? (
                    <div className="space-y-2">
                      <Label htmlFor="dni">DNI</Label>
                      <Input
                        autoFocus
                        id="dni"
                        value={dni}
                        placeholder="Ingrese DNI (8 dígitos)"
                        maxLength={8}
                        onChange={(e) => {
                          setDni(e.target.value.replace(/\D/g, ""))
                          if (error) setError("")
                        }}
                      />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Label className="flex items-center gap-2"><ScanLine className="size-4" /> Escáner QR</Label>
                      <QrScanner enabled={mode === "QR"} onDetected={onDetectedQr} />
                      <Input
                        value={qrToken}
                        placeholder="Fallback: ingresar código QR"
                        onChange={(e) => setQrToken(e.target.value.trim())}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="kioskId">Kiosk ID</Label>
                    <Input id="kioskId" value={kioskId} onChange={(e) => setKioskId(e.target.value.replace(/\D/g, ""))} placeholder="Ej: 1" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="kioskSecret">Kiosk Secret</Label>
                    <Input id="kioskSecret" type="password" value={kioskSecret} onChange={(e) => setKioskSecret(e.target.value)} placeholder="Secret del dispositivo" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="selfie" className="flex items-center gap-2"><Camera className="size-4" /> Selfie (opcional)</Label>
                    <Input id="selfie" type="file" accept="image/*" capture="user" onChange={(e) => onSelfieChange(e.target.files?.[0])} />
                    {selfieDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={selfieDataUrl} alt="Preview selfie" className="h-24 w-24 rounded-md object-cover border" />
                    ) : null}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="pin">PIN</Label>
                    <Input
                      id="pin"
                      type="password"
                      inputMode="numeric"
                      value={pin}
                      maxLength={8}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                      placeholder="••••"
                    />
                  </div>

                  <NumericKeypad
                    onDigit={(digit) => setPin((prev) => (prev + digit).slice(0, 8))}
                    onBackspace={() => setPin((prev) => prev.slice(0, -1))}
                    onClear={() => setPin("")}
                    disabled={loading}
                  />

                  {error && <p className="mt-1 text-sm text-destructive">{error}</p>}

                  {lastStatus ? (
                    <div className={`rounded-md p-3 text-sm ${lastStatus === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                      {lastMessage}
                    </div>
                  ) : null}
                </div>
              </div>
            </CardContent>
            <CardFooter >
              <Button 
                className="w-full"
                disabled={loading || !canSubmit}
                onClick={handleRegister}
              >
                {loading
                  ? <Clock7 className="animate-spin mr-2" />
                  : <Clock7 className="mr-2" />
                }
                {loading ? "Registrando…" : "Registrar marcación"}
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