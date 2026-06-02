import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  X, Upload, Trash2, FileText, FileImage, FileVideo, File as FileIcon, Loader2, ScrollText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/features/auth/context/AuthContext';
import ConfirmArchiveDialog from '@/shared/ui/ConfirmArchiveDialog';
import FileViewerModal from '@/shared/ui/FileViewerModal';
import { memberDocsApi, MEMBER_BUCKET } from '@/features/administrativo/api/memberDocs.api';
import { queryKeys } from '@/entities/query-keys';

const isImage = (m) => (m || '').startsWith('image/');
const isVideo = (m) => (m || '').startsWith('video/');

function formatSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  const u = ['B', 'KB', 'MB', 'GB'];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i += 1; }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${u[i]}`;
}

export default function UserDocumentsDialog({ user, onClose }) {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef(null);
  const [docType, setDocType] = useState('contrato');
  const [enviando, setEnviando] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [excluindo, setExcluindo] = useState(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !viewing) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, viewing]);

  const { data: docs = [] } = useQuery({
    queryKey: queryKeys.usuarios.documentos(user.id),
    queryFn: () => memberDocsApi.listByProfile(user.id),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: queryKeys.usuarios.documentos(user.id) });

  const handleFiles = async (fileList) => {
    const arr = Array.from(fileList || []);
    if (!arr.length) return;
    setEnviando(true);
    try {
      for (const file of arr) {
        await memberDocsApi.upload({ file, profileId: user.id, docType, createdBy: currentUser?.id ?? null });
      }
      invalidate();
      toast({ title: 'Documento(s) adicionado(s)!' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Falha ao enviar', description: err?.message });
    } finally {
      setEnviando(false);
    }
  };

  const excluir = useMutation({
    mutationFn: (doc) => memberDocsApi.remove(doc),
    onSuccess: () => {
      invalidate();
      setExcluindo(null);
      toast({ title: 'Documento removido.' });
    },
    onError: (err) => toast({ variant: 'destructive', title: 'Não foi possível remover', description: err?.message }),
  });

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="relative glass-card border border-white/10 rounded-2xl w-full max-w-lg z-10 shadow-2xl shadow-black/40 flex flex-col max-h-[85vh]"
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#EA3935]/15 border border-[#EA3935]/40 flex items-center justify-center text-white font-semibold shrink-0">
              {user.full_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-white truncate">{user.full_name || user.email}</h3>
              <p className="text-[11px] text-muted-foreground truncate">Documentos & contratos</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition-colors shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Upload */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center gap-2">
          <Select value={docType} onValueChange={setDocType}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white h-9 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a2e] border-white/10">
              <SelectItem value="contrato">Contrato</SelectItem>
              <SelectItem value="documento">Documento</SelectItem>
            </SelectContent>
          </Select>
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
          />
          <Button
            onClick={() => fileRef.current?.click()}
            disabled={enviando}
            className="bg-[#EA3935] hover:bg-[#C12D29] border-0 text-white h-9 flex-1"
          >
            {enviando ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Upload className="w-4 h-4 mr-1.5" />}
            {enviando ? 'Enviando...' : 'Adicionar documento'}
          </Button>
        </div>

        {/* Lista */}
        <div className="px-3 py-3 overflow-y-auto">
          {docs.length === 0 ? (
            <div className="p-8 text-center">
              <ScrollText className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum documento. Adicione o contrato deste colaborador.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {docs.map((doc) => {
                const Icon = isImage(doc.mime_type) ? FileImage : isVideo(doc.mime_type) ? FileVideo : FileText;
                return (
                  <div
                    key={doc.id}
                    onClick={() => setViewing(doc)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter') setViewing(doc); }}
                    className="group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-white/[0.04] transition-colors"
                  >
                    <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate">{doc.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        <span className={`uppercase ${doc.doc_type === 'contrato' ? 'text-[#EA3935]' : ''}`}>{doc.doc_type}</span>
                        {doc.size_bytes ? ` · ${formatSize(doc.size_bytes)}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setExcluindo(doc); }}
                      title="Remover"
                      className="p-1.5 rounded-lg text-muted-foreground/0 group-hover:text-muted-foreground hover:!text-red-300 hover:bg-red-500/10 transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>

      {viewing && (
        <FileViewerModal file={viewing} bucket={MEMBER_BUCKET} onClose={() => setViewing(null)} />
      )}

      {excluindo && (
        <ConfirmArchiveDialog
          title={`Remover "${excluindo.name}"?`}
          description="O documento será removido permanentemente."
          confirmLabel="Remover"
          loadingLabel="Removendo..."
          tone="danger"
          onConfirm={() => excluir.mutate(excluindo)}
          onCancel={() => setExcluindo(null)}
          isLoading={excluir.isPending}
        />
      )}
    </div>
  );
}
