'use client'

import {
  type ButtonHTMLAttributes,
  type MouseEvent,
  useEffect,
  useRef,
  useState,
} from 'react'

type ConfirmSubmitButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  confirmMessage: string
}

export default function ConfirmSubmitButton({
  confirmMessage,
  children,
  className,
  disabled,
  form,
  formAction,
  formEncType,
  formMethod,
  formNoValidate,
  formTarget,
  name,
  onClick,
  value,
}: ConfirmSubmitButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const submitButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  const handleOpen = (event: MouseEvent<HTMLButtonElement>) => {
    onClick?.(event)

    if (event.defaultPrevented) {
      return
    }

    event.preventDefault()
    setIsOpen(true)
  }

  const handleConfirm = () => {
    setIsOpen(false)
    submitButtonRef.current?.click()
  }

  return (
    <>
      <button
        type="button"
        className={className}
        disabled={disabled}
        onClick={handleOpen}
      >
        {children}
      </button>

      <button
        ref={submitButtonRef}
        type="submit"
        form={form}
        formAction={formAction}
        formEncType={formEncType}
        formMethod={formMethod}
        formNoValidate={formNoValidate}
        formTarget={formTarget}
        name={name}
        value={value}
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
      />

      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4 py-6">
          <div className="w-full max-w-md rounded-xl border border-neutral-700 bg-neutral-950 p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-neutral-100">Potwierdź usunięcie</h2>
            <p className="mt-3 text-sm leading-6 text-neutral-300">{confirmMessage}</p>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="rounded-md bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-white"
              >
                Potwierdź usunięcie
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}