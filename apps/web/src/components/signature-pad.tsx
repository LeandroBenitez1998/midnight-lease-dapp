import { useEffect, useId, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

type SignaturePadProps = {
  value: string | null
  onChange: (value: string | null) => void
  disabled?: boolean
}

const SIGNATURE_HEIGHT = 180

export function SignaturePad({ value, onChange, disabled = false }: SignaturePadProps) {
  const inputId = useId()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const isDrawing = useRef(false)
  const [canvasWidth, setCanvasWidth] = useState(0)

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const updateWidth = () => {
      setCanvasWidth(Math.max(280, Math.floor(element.clientWidth)))
    }

    updateWidth()

    const observer = new ResizeObserver(updateWidth)
    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  // Clear canvas when value resets externally
  useEffect(() => {
    if (value !== null) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }, [value])

  function getPointerEvent(e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }

  function startDrawing(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return
    isDrawing.current = true
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const pos = getPointerEvent(e)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
    canvas.setPointerCapture(e.pointerId)
  }

  function draw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing.current || disabled) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const pos = getPointerEvent(e)
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#111111'
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
  }

  function stopDrawing() {
    if (!isDrawing.current) return
    isDrawing.current = false
    publishSignature()
  }

  function publishSignature() {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return

    // Check if canvas has any non-white pixels
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const hasDrawing = imageData.data.some((channel, index) => index % 4 === 3 && channel > 0)

    if (!hasDrawing) {
      onChange(null)
      return
    }

    onChange(canvas.toDataURL('image/png'))
  }

  function clearCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    onChange(null)
  }

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        className="overflow-hidden rounded-[24px] border border-neutral-200 bg-white"
      >
        {canvasWidth > 0 ? (
          <canvas
            ref={canvasRef}
            id={inputId}
            width={canvasWidth}
            height={SIGNATURE_HEIGHT}
            className={disabled ? 'touch-none block w-full bg-neutral-50' : 'touch-none block w-full bg-white'}
            style={{ cursor: disabled ? 'default' : 'crosshair' }}
            onPointerDown={startDrawing}
            onPointerMove={draw}
            onPointerUp={stopDrawing}
            onPointerLeave={stopDrawing}
          />
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-black/55">
          Dibujá tu firma con mouse o touch. La imagen queda local y sólo se hashea antes del claim.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={clearCanvas}
          disabled={disabled}
          className="border-neutral-300 bg-white text-black shadow-none hover:bg-neutral-100"
        >
          <RotateCcw className="h-4 w-4" />
          Limpiar
        </Button>
      </div>
    </div>
  )
}
