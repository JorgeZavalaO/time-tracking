"use client"

import { Button } from "@/components/ui/button"

type Props = {
  onDigit: (digit: string) => void
  onBackspace: () => void
  onClear: () => void
  disabled?: boolean
}

export function NumericKeypad({ onDigit, onBackspace, onClear, disabled }: Props) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"]

  return (
    <div className="grid grid-cols-3 gap-2">
      {keys.map((k) => (
        <Button
          key={k}
          type="button"
          variant="outline"
          className="h-14 text-xl"
          onClick={() => onDigit(k)}
          disabled={disabled}
        >
          {k}
        </Button>
      ))}
      <Button type="button" variant="secondary" className="h-14" onClick={onClear} disabled={disabled}>
        Limpiar
      </Button>
      <Button
        type="button"
        variant="outline"
        className="h-14 text-xl"
        onClick={() => onDigit("0")}
        disabled={disabled}
      >
        0
      </Button>
      <Button type="button" variant="secondary" className="h-14" onClick={onBackspace} disabled={disabled}>
        ⌫
      </Button>
    </div>
  )
}
