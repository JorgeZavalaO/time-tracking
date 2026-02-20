"use client"

import React, { useEffect, useState } from "react"

type Kiosk = {
  id: number | string
  name: string
  is_active?: boolean
  last_seen?: string | null
  createdAt?: string
  secret?: string | null
}

export default function KioskManager() {
  const [kiosks, setKiosks] = useState<Kiosk[]>([])
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState("")
  const [creating, setCreating] = useState(false)
  const [rotatingId, setRotatingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [newSecret, setNewSecret] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch("/api/kiosks", { credentials: "same-origin" })
      const json = await res.json()
      setKiosks(json.items ?? [])
    } catch (e) {
      console.error(e)
      setError("Error al cargar kiosks")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleCreate(e?: React.FormEvent) {
    e?.preventDefault()
    if (!name.trim()) return
    setCreating(true)
    setNewSecret(null)
    setError(null)
    try {
      const res = await fetch("/api/kiosks", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw json
      if (json?.secret) setNewSecret(json.secret)
      setName("")
      await load()
    } catch (err: any) {
      console.error(err)
      setError(err?.error ?? "No se pudo crear kiosk")
    } finally {
      setCreating(false)
    }
  }

  async function handleRotate(id: number | string) {
    if (!confirm("Rotar secret del kiosk?")) return
    setRotatingId(Number(id))
    setNewSecret(null)
    setError(null)
    try {
      const res = await fetch(`/api/kiosks/${id}`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rotateSecret: true }),
      })
      const json = await res.json()
      if (!res.ok) throw json
      if (json?.secret) setNewSecret(json.secret)
      await load()
    } catch (err: any) {
      console.error(err)
      setError(err?.error ?? "No se pudo rotar secret")
    } finally {
      setRotatingId(null)
    }
  }

  async function handleDelete(id: number | string) {
    if (!confirm("Eliminar kiosk?")) return
    setDeletingId(Number(id))
    setError(null)
    try {
      const res = await fetch(`/api/kiosks/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      })
      const json = await res.json()
      if (!res.ok && !json.ok) throw json
      await load()
    } catch (err) {
      console.error(err)
      setError("No se pudo eliminar")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-medium">Kiosks</h2>

      <form onSubmit={handleCreate} className="flex gap-2 items-center">
        <input
          className="border rounded px-2 py-1"
          placeholder="Nombre del kiosk"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="px-3 py-1 rounded bg-primary text-white" type="submit" disabled={creating}>
          {creating ? "Creando…" : "Crear"}
        </button>
        <button type="button" className="px-3 py-1 rounded border" onClick={() => load()} disabled={loading}>
          Refrescar
        </button>
      </form>

      {newSecret && (
        <div className="rounded-md border p-3 bg-yellow-50">
          <div className="text-sm text-muted-foreground">Secret generado (guárdalo ahora):</div>
          <pre className="mt-2 font-mono text-sm">{newSecret}</pre>
        </div>
      )}

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-3 text-left">ID</th>
              <th className="p-3 text-left">Nombre</th>
              <th className="p-3 text-left">Última conexión</th>
              <th className="p-3 text-left">Activo</th>
              <th className="p-3 text-center w-48">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="p-4 text-center text-muted-foreground">Cargando…</td>
              </tr>
            ) : kiosks.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-4 text-center text-muted-foreground">— Sin kiosks —</td>
              </tr>
            ) : (
              kiosks.map((k) => (
                <tr key={String(k.id)} className="hover:bg-accent/10">
                  <td className="p-3">{String(k.id)}</td>
                  <td className="p-3">{k.name}</td>
                  <td className="p-3">{k.last_seen ? new Date(k.last_seen).toLocaleString() : "—"}</td>
                  <td className="p-3">{k.is_active ? "Sí" : "No"}</td>
                  <td className="p-3 text-center space-x-2">
                    <button className="px-2 py-1 border rounded" onClick={() => handleRotate(k.id)} disabled={rotatingId === Number(k.id)}>
                      {rotatingId === Number(k.id) ? "Rotando…" : "Rotar secret"}
                    </button>
                    <button className="px-2 py-1 bg-red-600 text-white rounded" onClick={() => handleDelete(k.id)} disabled={deletingId === Number(k.id)}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
