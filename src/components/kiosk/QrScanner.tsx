"use client"

import { useEffect, useRef, useState } from "react"
import { BrowserQRCodeReader } from "@zxing/browser"
import type { IScannerControls } from "@zxing/browser"

type Props = {
  enabled: boolean
  onDetected: (text: string) => void
}

export function QrScanner({ enabled, onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [error, setError] = useState<string>("")
  const lastValue = useRef<string>("")
  const controlsRef = useRef<IScannerControls | null>(null)

  useEffect(() => {
    if (!enabled || !videoRef.current) return

    const reader = new BrowserQRCodeReader()
    let cancelled = false

    reader
      .decodeFromVideoDevice(undefined, videoRef.current, (result) => {
        if (cancelled || !result) return
        const value = result.getText().trim()
        if (!value || value === lastValue.current) return
        lastValue.current = value
        onDetected(value)
      })
      .then((controls) => {
        controlsRef.current = controls
      })
      .catch(() => {
        if (!cancelled) {
          setError("No se pudo abrir la cámara. Usa el ingreso manual del código.")
        }
      })

    return () => {
      cancelled = true
      controlsRef.current?.stop()
      controlsRef.current = null
    }
  }, [enabled, onDetected])

  if (!enabled) return null

  return (
    <div className="space-y-2">
      <video ref={videoRef} className="w-full rounded-md border" muted playsInline />
      {error ? <p className="text-sm text-amber-600">{error}</p> : null}
    </div>
  )
}
