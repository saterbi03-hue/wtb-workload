import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Activity } from 'lucide-react'
import { uploadFile } from '@/lib/api'
import { useApp } from '@/lib/context'
import { cn } from '@/lib/utils'

export function UploadPage() {
  const navigate = useNavigate()
  const { setUploadData } = useApp()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const mutation = useMutation({
    mutationFn: (file: File) => uploadFile(file),
    onSuccess: (data) => {
      setUploadData(data)
      setTimeout(() => navigate('/overview'), 1000)
    },
  })

  function handleFile(file: File) {
    if (!file.name.endsWith('.xlsx')) return
    setSelectedFile(file)
    mutation.mutate(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const success = mutation.isSuccess
  const error = mutation.error

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-6">
      <div className="w-full max-w-md space-y-6">
        {/* Brand header */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Activity className="w-6 h-6 text-white" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">WTB Workload Engine</h1>
            <p className="text-sm text-slate-400 mt-1">
              Importez votre fichier de données pour commencer l'analyse
            </p>
          </div>
        </div>

        {/* Drop zone */}
        <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6">
          <div
            className={cn(
              'border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-4 cursor-pointer transition-all',
              dragging
                ? 'border-indigo-400 bg-indigo-500/10'
                : 'border-white/20 hover:border-white/40 hover:bg-white/5',
              success && 'border-emerald-400 bg-emerald-500/10'
            )}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />

            {success ? (
              <CheckCircle2 className="h-10 w-10 text-emerald-400" />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center">
                <FileSpreadsheet className="h-7 w-7 text-white/70" />
              </div>
            )}

            {selectedFile ? (
              <div className="text-center">
                <p className="text-sm font-medium text-white">{selectedFile.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">{(selectedFile.size / 1024).toFixed(0)} Ko</p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-sm font-semibold text-white">Glissez le fichier ici</p>
                <p className="text-xs text-slate-400 mt-0.5">ou cliquez pour parcourir · .xlsx uniquement</p>
              </div>
            )}

            {mutation.isPending && (
              <p className="text-xs text-indigo-300 animate-pulse">Analyse en cours...</p>
            )}
          </div>

          {!selectedFile && (
            <button
              onClick={() => inputRef.current?.click()}
              className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors shadow-lg shadow-indigo-600/20"
            >
              <Upload className="h-4 w-4" />
              Choisir un fichier
            </button>
          )}

          {error && (
            <div className="mt-4 flex items-start gap-2 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error.message}</span>
            </div>
          )}
        </div>

        {/* Success summary */}
        {success && mutation.data && (
          <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-5">
            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-3">
              Fichier chargé — redirection...
            </p>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {[
                ['Topics', mutation.data.n_topics],
                ['CAs actifs', mutation.data.n_active_cas],
                ['Ancre', mutation.data.config.today],
                ['Capacité', `${mutation.data.config.weekly_capacity_hrs} h/sem`],
              ].map(([label, val]) => (
                <>
                  <dt key={`dt-${label}`} className="text-slate-400">{label}</dt>
                  <dd key={`dd-${label}`} className="font-semibold text-white">{val}</dd>
                </>
              ))}
            </dl>
          </div>
        )}
      </div>
    </div>
  )
}
