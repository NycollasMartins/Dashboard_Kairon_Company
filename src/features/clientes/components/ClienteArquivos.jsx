import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Folder, FolderPlus, Upload, Trash2, Download, ChevronRight,
  FileImage, FileVideo, File as FileIcon, Loader2, X, Check, HardDrive,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/features/auth/context/AuthContext';
import ConfirmArchiveDialog from '@/shared/ui/ConfirmArchiveDialog';
import { arquivosApi } from '@/features/clientes/api/arquivos.api';
import { queryKeys } from '@/entities/query-keys';

function formatSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i += 1; }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${u[i]}`;
}

const isImage = (m) => (m || '').startsWith('image/');
const isVideo = (m) => (m || '').startsWith('video/');

function NovaPastaDialog({ onClose, onCreate, isSaving }) {
  const [name, setName] = useState('');
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const submit = (e) => {
    e.preventDefault();
    if (name.trim()) onCreate(name.trim());
  };
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="relative glass-card border border-white/10 rounded-2xl w-full max-w-sm z-10 shadow-2xl shadow-black/40 p-6"
      >
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-9 h-9 rounded-xl bg-[#EA3935]/10 flex items-center justify-center">
            <FolderPlus className="w-4 h-4 text-[#EA3935]" />
          </div>
          <h3 className="text-sm font-semibold text-white">Nova pasta</h3>
        </div>
        <Input
          ref={ref}
          placeholder="Nome da pasta"
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/70 h-10"
        />
        <div className="flex items-center gap-3 mt-5">
          <Button type="button" onClick={onClose} variant="outline" className="flex-1 border-white/10 bg-transparent text-muted-foreground hover:bg-white/5 hover:text-white h-10">
            Cancelar
          </Button>
          <Button type="submit" disabled={!name.trim() || isSaving} className="flex-1 bg-[#EA3935] hover:bg-[#C12D29] border-0 text-white h-10 disabled:opacity-50">
            <Check className="w-4 h-4 mr-1.5" /> Criar
          </Button>
        </div>
      </motion.form>
    </div>
  );
}

export default function ClienteArquivos({ clienteId }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [path, setPath] = useState([{ id: null, name: 'Arquivos' }]);
  const currentFolderId = path[path.length - 1].id;
  const [showNovaPasta, setShowNovaPasta] = useState(false);
  const [excluindoPasta, setExcluindoPasta] = useState(null);
  const [excluindoArquivo, setExcluindoArquivo] = useState(null);
  const [uploads, setUploads] = useState([]); // { id, name, progress, error }
  const [thumbs, setThumbs] = useState({}); // storage_path -> signedUrl
  const fileInputRef = useRef(null);

  const folderKey = queryKeys.arquivos.folder(clienteId, currentFolderId);
  const { data: folders = [] } = useQuery({
    queryKey: [...folderKey, 'folders'],
    queryFn: () => arquivosApi.listFolders(clienteId, currentFolderId),
  });
  const { data: files = [] } = useQuery({
    queryKey: [...folderKey, 'files'],
    queryFn: () => arquivosApi.listFiles(clienteId, currentFolderId),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: queryKeys.arquivos.folder(clienteId, currentFolderId) });

  // Thumbnails (links assinados) para imagens da pasta atual.
  useEffect(() => {
    const imgs = files.filter((f) => isImage(f.mime_type)).map((f) => f.storage_path);
    const missing = imgs.filter((p) => !thumbs[p]);
    if (!missing.length) return;
    let active = true;
    arquivosApi.signedUrls(missing).then((map) => {
      if (active) setThumbs((prev) => ({ ...prev, ...map }));
    }).catch(() => {});
    return () => { active = false; };
  }, [files, thumbs]);

  const criarPasta = useMutation({
    mutationFn: (name) =>
      arquivosApi.createFolder({ clientId: clienteId, parentId: currentFolderId, name, createdBy: user?.id ?? null }),
    onSuccess: () => {
      invalidate();
      setShowNovaPasta(false);
      toast({ title: 'Pasta criada!' });
    },
    onError: (err) => toast({ variant: 'destructive', title: 'Não foi possível criar a pasta', description: err?.message }),
  });

  const excluirPasta = useMutation({
    mutationFn: (folder) => arquivosApi.deleteFolder(clienteId, folder.id),
    onSuccess: () => {
      invalidate();
      setExcluindoPasta(null);
      toast({ title: 'Pasta excluída.' });
    },
    onError: (err) => toast({ variant: 'destructive', title: 'Não foi possível excluir a pasta', description: err?.message }),
  });

  const excluirArquivo = useMutation({
    mutationFn: (file) => arquivosApi.deleteFile(file),
    onSuccess: () => {
      invalidate();
      setExcluindoArquivo(null);
      toast({ title: 'Arquivo excluído.' });
    },
    onError: (err) => toast({ variant: 'destructive', title: 'Não foi possível excluir o arquivo', description: err?.message }),
  });

  const handleFiles = async (fileList) => {
    const arr = Array.from(fileList || []);
    if (!arr.length) return;
    for (const file of arr) {
      const uid = `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`;
      setUploads((u) => [...u, { id: uid, name: file.name, progress: 0, error: null }]);
      try {
        await arquivosApi.upload({
          file,
          clientId: clienteId,
          folderId: currentFolderId,
          createdBy: user?.id ?? null,
          onProgress: (p) => setUploads((u) => u.map((x) => (x.id === uid ? { ...x, progress: p } : x))),
        });
        setUploads((u) => u.filter((x) => x.id !== uid));
        invalidate();
      } catch (err) {
        setUploads((u) => u.map((x) => (x.id === uid ? { ...x, error: err?.message ?? 'Falha no upload' } : x)));
        toast({ variant: 'destructive', title: `Falha ao enviar ${file.name}`, description: err?.message });
      }
    }
  };

  const openFile = async (file) => {
    try {
      const url = await arquivosApi.signedUrl(file.storage_path);
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      toast({ variant: 'destructive', title: 'Não foi possível abrir o arquivo', description: err?.message });
    }
  };

  const navigateInto = (folder) => setPath((p) => [...p, { id: folder.id, name: folder.name }]);
  const navigateTo = (index) => setPath((p) => p.slice(0, index + 1));

  const vazio = folders.length === 0 && files.length === 0 && uploads.length === 0;

  return (
    <div className="space-y-5">
      {/* Cabeçalho: breadcrumb + ações */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-sm flex-wrap min-w-0">
          {path.map((seg, i) => (
            <span key={`${seg.id ?? 'root'}-${i}`} className="flex items-center gap-1.5 min-w-0">
              {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />}
              <button
                type="button"
                onClick={() => navigateTo(i)}
                className={`truncate transition-colors ${
                  i === path.length - 1 ? 'text-white font-medium' : 'text-muted-foreground hover:text-white'
                }`}
              >
                {seg.name}
              </button>
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
          />
          <Button
            onClick={() => setShowNovaPasta(true)}
            variant="outline"
            className="border-white/10 bg-transparent text-white hover:bg-white/5 h-9"
          >
            <FolderPlus className="w-4 h-4 mr-1.5" /> Nova Pasta
          </Button>
          <Button
            onClick={() => fileInputRef.current?.click()}
            className="bg-[#EA3935] hover:bg-[#C12D29] border-0 text-white h-9"
          >
            <Upload className="w-4 h-4 mr-1.5" /> Enviar Arquivo
          </Button>
        </div>
      </div>

      {/* Uploads em andamento */}
      {uploads.length > 0 && (
        <div className="space-y-2">
          {uploads.map((u) => (
            <div key={u.id} className="glass-card rounded-xl border border-white/5 px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-white">
                {u.error ? <X className="w-4 h-4 text-red-400" /> : <Loader2 className="w-4 h-4 text-[#EA3935] animate-spin" />}
                <span className="truncate flex-1">{u.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{u.error ? 'erro' : `${u.progress}%`}</span>
              </div>
              {!u.error && (
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden mt-2">
                  <div className="h-full bg-[#EA3935] rounded-full transition-all" style={{ width: `${u.progress}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {vazio ? (
        <div className="glass-card rounded-2xl border border-white/5 p-12 text-center">
          <HardDrive className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Pasta vazia. Crie uma subpasta ou envie arquivos.</p>
        </div>
      ) : (
        <>
          {/* Pastas */}
          {folders.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {folders.map((f) => (
                <div
                  key={f.id}
                  onClick={() => navigateInto(f)}
                  className="group glass-card rounded-2xl border border-white/5 p-4 cursor-pointer hover:border-white/10 hover:bg-white/[0.03] transition-colors flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#EA3935]/10 flex items-center justify-center shrink-0">
                    <Folder className="w-5 h-5 text-[#EA3935]" />
                  </div>
                  <p className="text-sm font-medium text-white truncate flex-1">{f.name}</p>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setExcluindoPasta(f); }}
                    title="Excluir pasta"
                    className="p-1.5 rounded-lg text-muted-foreground/0 group-hover:text-muted-foreground hover:!text-red-300 hover:bg-red-500/10 transition-colors shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Arquivos */}
          {files.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {files.map((file) => {
                const Icon = isImage(file.mime_type) ? FileImage : isVideo(file.mime_type) ? FileVideo : FileIcon;
                const thumb = thumbs[file.storage_path];
                return (
                  <div
                    key={file.id}
                    className="group glass-card rounded-2xl border border-white/5 overflow-hidden hover:border-white/10 transition-colors"
                  >
                    <div
                      onClick={() => openFile(file)}
                      className="h-28 bg-black/30 flex items-center justify-center cursor-pointer relative overflow-hidden"
                    >
                      {thumb ? (
                        <img src={thumb} alt={file.name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <Icon className={`w-8 h-8 ${isImage(file.mime_type) ? 'text-blue-300' : isVideo(file.mime_type) ? 'text-purple-300' : 'text-muted-foreground'}`} />
                      )}
                    </div>
                    <div className="p-3">
                      <p className="text-xs font-medium text-white truncate" title={file.name}>{file.name}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[10px] text-muted-foreground tabular-nums">{formatSize(file.size_bytes)}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openFile(file)}
                            title="Abrir / baixar"
                            className="p-1 rounded-md text-muted-foreground hover:text-white hover:bg-white/10 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setExcluindoArquivo(file)}
                            title="Excluir"
                            className="p-1 rounded-md text-muted-foreground hover:text-red-300 hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {showNovaPasta && (
        <NovaPastaDialog
          onClose={() => setShowNovaPasta(false)}
          onCreate={(name) => criarPasta.mutate(name)}
          isSaving={criarPasta.isPending}
        />
      )}

      {excluindoPasta && (
        <ConfirmArchiveDialog
          title={`Excluir a pasta "${excluindoPasta.name}"?`}
          description="Todas as subpastas e arquivos dentro dela serão apagados permanentemente. Esta ação é irreversível."
          confirmLabel="Excluir pasta"
          loadingLabel="Excluindo..."
          tone="danger"
          onConfirm={() => excluirPasta.mutate(excluindoPasta)}
          onCancel={() => setExcluindoPasta(null)}
          isLoading={excluirPasta.isPending}
        />
      )}

      {excluindoArquivo && (
        <ConfirmArchiveDialog
          title={`Excluir "${excluindoArquivo.name}"?`}
          description="O arquivo será removido permanentemente."
          confirmLabel="Excluir arquivo"
          loadingLabel="Excluindo..."
          tone="danger"
          onConfirm={() => excluirArquivo.mutate(excluindoArquivo)}
          onCancel={() => setExcluindoArquivo(null)}
          isLoading={excluirArquivo.isPending}
        />
      )}
    </div>
  );
}
