import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Download, ExternalLink, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/infrastructure/supabase/client';

const isImage = (m) => (m || '').startsWith('image/');
const isVideo = (m) => (m || '').startsWith('video/');
const isPdf = (m) => (m || '') === 'application/pdf';

// Visualizador genérico de arquivo do Supabase Storage.
// Abre imagem/vídeo/PDF INLINE (sem baixar) e oferece o botão de baixar.
export default function FileViewerModal({ file, bucket, onClose }) {
  const [url, setUrl] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let active = true;
    supabase.storage
      .from(bucket)
      .createSignedUrl(file.storage_path, 3600)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setErro(error.message);
        else setUrl(data?.signedUrl ?? null);
      });
    return () => { active = false; };
  }, [file, bucket]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const baixar = async () => {
    const { data } = await supabase.storage
      .from(bucket)
      .createSignedUrl(file.storage_path, 3600, { download: file.name });
    if (data?.signedUrl) {
      const a = document.createElement('a');
      a.href = data.signedUrl;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="relative glass-card border border-white/10 rounded-2xl w-full max-w-3xl z-10 shadow-2xl shadow-black/50 flex flex-col max-h-[88vh]"
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5">
          <div className="flex items-center gap-2.5 min-w-0">
            <FileText className="w-4 h-4 text-[#EA3935] shrink-0" />
            <p className="text-sm font-semibold text-white truncate" title={file.name}>{file.name}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition-colors"
                title="Abrir em nova aba"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            <Button onClick={baixar} className="bg-[#EA3935] hover:bg-[#C12D29] border-0 text-white h-8 text-xs">
              <Download className="w-3.5 h-3.5 mr-1.5" /> Baixar
            </Button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-black/40 flex items-center justify-center min-h-[300px]">
          {erro ? (
            <p className="text-sm text-red-300 p-8">{erro}</p>
          ) : !url ? (
            <Loader2 className="w-6 h-6 text-[#EA3935] animate-spin" />
          ) : isImage(file.mime_type) ? (
            <img src={url} alt={file.name} className="max-w-full max-h-[78vh] object-contain" />
          ) : isVideo(file.mime_type) ? (
            <video src={url} controls autoPlay className="max-w-full max-h-[78vh]" />
          ) : isPdf(file.mime_type) ? (
            <iframe src={url} title={file.name} className="w-full h-[78vh] bg-white" />
          ) : (
            <div className="text-center p-10">
              <FileText className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-4">Pré-visualização não disponível para este tipo de arquivo.</p>
              <Button onClick={baixar} variant="outline" className="border-white/10 bg-transparent text-white hover:bg-white/5">
                <Download className="w-4 h-4 mr-1.5" /> Baixar arquivo
              </Button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
