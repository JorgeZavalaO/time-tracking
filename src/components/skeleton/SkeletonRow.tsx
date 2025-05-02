"use client"
import clsx from "clsx"

export default function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr aria-hidden="true" role="presentation" className="animate-pulse border-b border-muted">
      {Array.from({ length: cols }).map((_, i) => (
        <td
          key={i}
          className={clsx(
            "p-2",
            i === 0 ? "w-[120px]" : "w-full"
          )}
        >
          <div
            className={clsx(
              "h-4 w-full rounded-md bg-muted/40",
              "relative overflow-hidden",
              "before:absolute before:inset-0 before:-translate-x-full",
              "before:animate-[shimmer_1.6s_infinite]",
              "before:bg-gradient-to-r before:from-transparent before:via-muted/30 before:to-transparent"
            )}
          />
        </td>
      ))}

      <style jsx>{`
        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </tr>
  )
}
