import { useEffect, useMemo, useRef, useState } from 'react'
import { ImageIcon, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface FileInputProps {
  /** The file currently selected in this form session (not yet uploaded). */
  value: File | null
  onChange: (file: File | null) => void
  /** Absolute URL of the file already stored on the server, if any. */
  currentUrl?: string | null
  /** Called when the user clears the already-stored file. */
  onRemoveCurrent?: () => void
  /** MIME accept attribute (e.g. `image/png,image/jpeg,image/webp,image/svg+xml`). */
  accept: string
  /** Allowed extensions used for client-side validation. */
  acceptExtensions: readonly string[]
  /** Maximum size in bytes. */
  maxSize: number
  label?: string
  id?: string
  disabled?: boolean
}

/**
 * Image upload control with preview. Validates extension and size on the
 * client before accepting the file — the backend re-validates on submit.
 */
export function FileInput({
  value,
  onChange,
  currentUrl,
  onRemoveCurrent,
  accept,
  acceptExtensions,
  maxSize,
  id,
  disabled,
}: FileInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!value) {
      setPreviewObjectUrl(null)
      return
    }
    const url = URL.createObjectURL(value)
    setPreviewObjectUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [value])

  const previewSrc = previewObjectUrl ?? currentUrl ?? null

  const maxSizeLabel = useMemo(() => {
    const mb = maxSize / (1024 * 1024)
    return mb >= 1 ? `${mb} MB` : `${Math.round(maxSize / 1024)} KB`
  }, [maxSize])

  function handlePick() {
    inputRef.current?.click()
  }

  function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    event.target.value = '' // allow picking the same file again later
    if (!file) return

    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!acceptExtensions.includes(ext)) {
      toast.error(
        `Formato inválido. Aceitamos ${acceptExtensions.map((e) => e.toUpperCase()).join(', ')}.`
      )
      return
    }

    if (file.size > maxSize) {
      toast.error(`Arquivo muito grande. Tamanho máximo: ${maxSizeLabel}.`)
      return
    }

    onChange(file)
  }

  function handleClear() {
    if (value) {
      onChange(null)
      return
    }
    if (currentUrl && onRemoveCurrent) {
      onRemoveCurrent()
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-4">
        <div
          className={cn(
            'flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/30',
            !previewSrc && 'text-muted-foreground'
          )}
        >
          {previewSrc ? (
            <img
              src={previewSrc}
              alt="Pré-visualização da logomarca"
              className="size-full object-contain"
            />
          ) : (
            <ImageIcon className="size-8" />
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            id={id}
            accept={accept}
            disabled={disabled}
            className="hidden"
            onChange={handleFileSelected}
          />

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={handlePick} disabled={disabled}>
              <Upload className="size-4" />
              {previewSrc ? 'Trocar arquivo' : 'Selecionar arquivo'}
            </Button>

            {previewSrc && (
              <Button
                type="button"
                variant="ghost"
                onClick={handleClear}
                disabled={disabled}
                aria-label="Remover"
              >
                <Trash2 className="size-4 text-destructive" />
                Remover
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Formatos: {acceptExtensions.map((e) => e.toUpperCase()).join(', ')} · máximo{' '}
            {maxSizeLabel}.
          </p>
        </div>
      </div>
    </div>
  )
}
