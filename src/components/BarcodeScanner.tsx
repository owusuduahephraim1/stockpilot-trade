import { useEffect, useRef, useState } from 'react'
import { Camera, X } from 'lucide-react'
import { Button } from './ui/Button'

type Props = {
  onScan: (value: string) => void
  label?: string
}

export function CameraBarcodeButton({ onScan, label = 'Scan camera' }: Props) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('Point the camera at a barcode.')
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    if (!open) return
    let stream: MediaStream | null = null
    let frame = 0
    let stopped = false
    let busy = false

    const start = async () => {
      try {
        const Detector = (window as any).BarcodeDetector
        if (!Detector) {
          setMessage('Camera barcode scanning is not supported by this browser. Use the USB scanner or manual entry field instead.')
          return
        }
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
        if (!videoRef.current || stopped) return
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        const formats = typeof Detector.getSupportedFormats === 'function' ? await Detector.getSupportedFormats() : undefined
        const preferred = ['ean_13','ean_8','upc_a','upc_e','code_128','code_39','qr_code']
        const detector = new Detector(formats ? { formats: preferred.filter(x => formats.includes(x)) } : undefined)

        const detect = async () => {
          if (stopped) return
          if (!busy && videoRef.current && videoRef.current.readyState >= 2) {
            busy = true
            try {
              const found = await detector.detect(videoRef.current)
              const value = found?.[0]?.rawValue?.trim()
              if (value) {
                onScan(value)
                setOpen(false)
                return
              }
            } catch {
              setMessage('Scanning… hold the barcode steady and keep it well lit.')
            } finally {
              busy = false
            }
          }
          frame = requestAnimationFrame(detect)
        }
        frame = requestAnimationFrame(detect)
      } catch (e: any) {
        setMessage(e?.message || 'Camera permission was not granted. Use manual or USB barcode entry instead.')
      }
    }

    start()
    return () => {
      stopped = true
      cancelAnimationFrame(frame)
      stream?.getTracks().forEach(t => t.stop())
    }
  }, [open, onScan])

  return <>
    <Button type="button" variant="secondary" onClick={() => { setMessage('Point the camera at a barcode.'); setOpen(true) }}><Camera className="h-4 w-4"/>{label}</Button>
    {open && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between"><div><h3 className="font-bold">Scan barcode</h3><p className="text-xs text-slate-500">Mobile/tablet camera scanning. USB scanners continue to work in the normal input field.</p></div><button className="rounded-lg p-2 hover:bg-slate-100" onClick={() => setOpen(false)}><X className="h-5 w-5"/></button></div>
        <video ref={videoRef} playsInline muted className="aspect-video w-full rounded-xl bg-slate-950 object-cover" />
        <p className="mt-3 text-sm text-slate-600">{message}</p>
      </div>
    </div>}
  </>
}
