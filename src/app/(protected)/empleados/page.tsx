'use client'

import { useState } from 'react'
import { CollaboratorForm } from '@/components/CollaboratorForm'
import { ConfirmDeleteButton } from '@/components/ui/ConfirmDeleteButton'
import { useCollaborators } from '@/hooks/useCollaborators'
import { useDeleteCollaborator } from '@/hooks/useCollaboratorMutations'
import useDebounce from '@/hooks/useDebounce'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  BadgeCheck, Clock, Tag, X, Search, KeyRound, QrCode, Users,
} from 'lucide-react'

const PAGE_SIZE = 10

/** Iniciales para el avatar */
function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

/** Formatea días (string CSV o array) en abreviados legibles */
const DAY_SHORT: Record<string, string> = {
  MON: 'Lu', TUE: 'Ma', WED: 'Mi', THU: 'Ju', FRI: 'Vi', SAT: 'Sá', SUN: 'Do',
}
function formatDays(raw: string | string[]) {
  const arr = Array.isArray(raw) ? raw : raw.split(',')
  return arr.map((d) => DAY_SHORT[d.trim()] ?? d.trim()).join(' ')
}

export default function EmpleadosPage() {
  const [page, setPage] = useState(1)
  const [searchRaw, setSearchRaw] = useState('')
  const [tagFilterRaw, setTagFilterRaw] = useState('')
  const [tagFilter, setTagFilter] = useState<string | undefined>(undefined)
  const search = useDebounce(searchRaw, 400)

  const { data, isFetching } = useCollaborators(page, PAGE_SIZE, search, tagFilter)
  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const deleteMutation = useDeleteCollaborator(page, PAGE_SIZE, search)

  return (
    <TooltipProvider delayDuration={300}>
      <section className="flex flex-col gap-6 max-w-6xl">

        {/* ── Cabecera ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Colaboradores</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isFetching ? '…' : `${total} registro${total !== 1 ? 's' : ''}`}
              {tagFilter && <> · etiqueta <span className="font-medium text-foreground">"{tagFilter}"</span></>}
            </p>
          </div>
          <CollaboratorForm page={page} pageSize={PAGE_SIZE} search={search} onClose={() => {}} />
        </div>

        {/* ── Filtros ── */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* Buscador */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-8 h-8 text-sm"
              placeholder="Buscar DNI o nombre…"
              value={searchRaw}
              onChange={(e) => { setSearchRaw(e.target.value); setPage(1) }}
            />
          </div>

          {/* Filtro etiqueta */}
          <form
            className="flex gap-1.5 items-center"
            onSubmit={(e) => {
              e.preventDefault()
              setTagFilter(tagFilterRaw.trim() || undefined)
              setPage(1)
            }}
          >
            <div className="relative flex items-center">
              <Tag className="absolute left-2.5 size-3.5 text-muted-foreground pointer-events-none" />
              <Input
                className="pl-8 h-8 text-sm w-40"
                placeholder="Etiqueta"
                value={tagFilterRaw}
                onChange={(e) => setTagFilterRaw(e.target.value)}
              />
            </div>
            <Button type="submit" variant="outline" size="sm" className="h-8">Filtrar</Button>
            {tagFilter && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => { setTagFilter(undefined); setTagFilterRaw(''); setPage(1) }}
              >
                <X className="size-3.5" />
              </Button>
            )}
          </form>

          {/* Chip de etiqueta activa */}
          {tagFilter && (
            <Badge variant="secondary" className="gap-1 text-xs font-normal">
              <Tag className="size-3" /> {tagFilter}
            </Badge>
          )}
        </div>

        {/* ── Tabla ── */}
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="text-xs w-10">#</TableHead>
                <TableHead className="text-xs">Colaborador</TableHead>
                <TableHead className="text-xs">Horario</TableHead>
                <TableHead className="text-xs">Etiquetas</TableHead>
                <TableHead className="text-xs text-center">Seguridad</TableHead>
                <TableHead className="text-xs text-center w-20">Estado</TableHead>
                <TableHead className="text-xs text-right w-28">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isFetching ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-6" /></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Skeleton className="size-8 rounded-full" />
                        <div className="space-y-1.5">
                          <Skeleton className="h-3.5 w-32" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Users className="size-8 text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground">Sin colaboradores encontrados</p>
                      {(search || tagFilter) && (
                        <p className="text-xs text-muted-foreground">Intenta con otros filtros</p>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                items.map((col) => (
                  <TableRow key={col.id} className={!col.active ? 'opacity-50' : undefined}>
                    {/* # */}
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {col.id}
                    </TableCell>

                    {/* Colaborador */}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8 text-xs">
                          <AvatarFallback className="bg-primary/10 text-primary font-medium">
                            {initials(col.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-medium leading-none truncate">{col.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {col.dni}{col.position ? ` · ${col.position}` : ''}
                          </p>
                        </div>
                      </div>
                    </TableCell>

                    {/* Horario */}
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {col.schedule.type === 'SPECIAL' ? (
                          <BadgeCheck className="size-3.5 text-primary shrink-0" />
                        ) : (
                          <Clock className="size-3.5 text-muted-foreground shrink-0" />
                        )}
                        <span className="text-sm">
                          {formatDays(col.schedule.days)}
                          <span className="ml-1.5 font-mono text-xs text-muted-foreground">
                            {col.schedule.startTime}
                          </span>
                        </span>
                      </div>
                    </TableCell>

                    {/* Etiquetas */}
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(col.tags ?? []).length === 0 ? (
                          <span className="text-xs text-muted-foreground/50">—</span>
                        ) : (
                          (col.tags ?? []).map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => { setTagFilter(t); setTagFilterRaw(t); setPage(1) }}
                            >
                              <Badge
                                variant="outline"
                                className="text-xs font-normal cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                              >
                                {t}
                              </Badge>
                            </button>
                          ))
                        )}
                      </div>
                    </TableCell>

                    {/* Seguridad */}
                    <TableCell>
                      <div className="flex items-center justify-center gap-1.5">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs ${
                              col.hasPin
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                                : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                            }`}>
                              <KeyRound className="size-3" />
                              {col.hasPin ? 'PIN' : '—'}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            {col.hasPin ? 'PIN configurado' : 'Sin PIN'}
                          </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs ${
                              col.hasQr
                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
                                : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                            }`}>
                              <QrCode className="size-3" />
                              {col.hasQr ? 'QR' : '—'}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            {col.hasQr ? 'QR generado' : 'Sin QR'}
                          </TooltipContent>
                        </Tooltip>

                      </div>
                    </TableCell>

                    {/* Estado */}
                    <TableCell className="text-center">
                      <Badge
                        variant={col.active ? 'secondary' : 'outline'}
                        className={`text-xs font-normal ${col.active ? 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-400' : 'text-muted-foreground'}`}
                      >
                        {col.active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>

                    {/* Acciones */}
                    <TableCell className="text-right space-x-0.5">
                      <CollaboratorForm
                        initialData={col}
                        page={page}
                        pageSize={PAGE_SIZE}
                        search={search}
                        onClose={() => {}}
                      />
                      <ConfirmDeleteButton
                        itemName={`al colaborador ${col.name}`}
                        disabled={deleteMutation.isPending}
                        onConfirm={() =>
                          deleteMutation.mutate(col.id, {
                            onError: (e) => {
                              const errorMsg =
                                typeof e === 'object' && e !== null && 'error' in e
                                  ? (e as { error?: string }).error
                                  : undefined
                              alert(errorMsg ?? 'No se pudo eliminar')
                            },
                          })
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* ── Paginación ── */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-xs text-muted-foreground">
            {total > 0
              ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} de ${total}`
              : '0 registros'}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={page === 1}
              onClick={() => setPage(1)}
            >
              «
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-3 text-xs"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </Button>
            <span className="px-3 py-1 text-xs text-muted-foreground border rounded-md bg-muted/30">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-3 text-xs"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={page >= totalPages}
              onClick={() => setPage(totalPages)}
            >
              »
            </Button>
          </div>
        </div>

      </section>
    </TooltipProvider>
  )
}
