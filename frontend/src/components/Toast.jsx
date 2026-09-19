import { useUiStore } from '../store/uiStore'

const variantStyles = {
  success: 'bg-ink text-cream',
  error: 'bg-danger text-cream',
}

function Toast() {
  const toasts = useUiStore((s) => s.toasts)
  if (!toasts.length) return null

  return (
    <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center pointer-events-none px-4 w-full max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`animate-toast-in shadow-lg rounded-full px-5 py-3 text-[13.5px] font-semibold w-full text-center ${variantStyles[t.variant] || variantStyles.success}`}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}

export default Toast
