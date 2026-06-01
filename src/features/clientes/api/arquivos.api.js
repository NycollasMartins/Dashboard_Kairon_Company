import * as tus from 'tus-js-client';
import { supabase } from '@/infrastructure/supabase/client';

const BUCKET = 'client-files';
const FOLDERS = 'client_folders';
const FILES = 'client_files';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

// Upload resumível (TUS) — robusto para arquivos grandes (vídeos 1GB+).
// Devolve o storage_path (objectName) gravado no bucket.
async function uploadResumable({ file, clientId, onProgress, signal }) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Sessão expirada. Faça login novamente.');

  const objectName = `${clientId}/${crypto.randomUUID()}`;

  await new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${token}`,
        apikey: ANON_KEY,
        'x-upsert': 'true',
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: 6 * 1024 * 1024, // Supabase exige chunks de 6MB
      metadata: {
        bucketName: BUCKET,
        objectName,
        contentType: file.type || 'application/octet-stream',
        cacheControl: '3600',
      },
      onError: reject,
      onProgress: (sent, total) => {
        if (onProgress && total) onProgress(Math.round((sent / total) * 100));
      },
      onSuccess: resolve,
    });

    if (signal) {
      signal.addEventListener('abort', () => {
        upload.abort();
        reject(new DOMException('Upload cancelado', 'AbortError'));
      });
    }

    upload.findPreviousUploads().then((prev) => {
      if (prev.length) upload.resumeFromPreviousUpload(prev[0]);
      upload.start();
    });
  });

  return objectName;
}

export const arquivosApi = {
  // ---- PASTAS -------------------------------------------------------
  listFolders: (clientId, parentId = null) => {
    let q = supabase.from(FOLDERS).select('*').eq('client_id', clientId).order('name', { ascending: true });
    q = parentId == null ? q.is('parent_id', null) : q.eq('parent_id', parentId);
    return q.then(unwrap);
  },

  createFolder: ({ clientId, parentId = null, name, createdBy = null }) =>
    supabase
      .from(FOLDERS)
      .insert({ client_id: clientId, parent_id: parentId, name: name.trim(), created_by: createdBy })
      .select('*')
      .single()
      .then(unwrap),

  renameFolder: (id, name) =>
    supabase.from(FOLDERS).update({ name: name.trim() }).eq('id', id).select('*').single().then(unwrap),

  // Apaga a pasta, todas as subpastas e todos os arquivos (Storage + linhas).
  deleteFolder: async (clientId, folderId) => {
    const [folders, files] = await Promise.all([
      supabase.from(FOLDERS).select('id, parent_id').eq('client_id', clientId).then(unwrap),
      supabase.from(FILES).select('folder_id, storage_path').eq('client_id', clientId).then(unwrap),
    ]);
    // Coleta a pasta + descendentes
    const descendants = new Set([folderId]);
    let added = true;
    while (added) {
      added = false;
      for (const f of folders) {
        if (f.parent_id && descendants.has(f.parent_id) && !descendants.has(f.id)) {
          descendants.add(f.id);
          added = true;
        }
      }
    }
    const paths = files.filter((f) => descendants.has(f.folder_id)).map((f) => f.storage_path);
    if (paths.length) {
      const { error } = await supabase.storage.from(BUCKET).remove(paths);
      if (error) throw error;
    }
    // ON DELETE CASCADE remove subpastas e linhas de arquivos
    const { error } = await supabase.from(FOLDERS).delete().eq('id', folderId);
    if (error) throw error;
  },

  // ---- ARQUIVOS -----------------------------------------------------
  listFiles: (clientId, folderId = null) => {
    let q = supabase.from(FILES).select('*').eq('client_id', clientId).order('created_at', { ascending: false });
    q = folderId == null ? q.is('folder_id', null) : q.eq('folder_id', folderId);
    return q.then(unwrap);
  },

  // Faz o upload resumível e registra os metadados.
  upload: async ({ file, clientId, folderId = null, createdBy = null, onProgress, signal }) => {
    const storagePath = await uploadResumable({ file, clientId, onProgress, signal });
    return supabase
      .from(FILES)
      .insert({
        client_id: clientId,
        folder_id: folderId,
        name: file.name,
        storage_path: storagePath,
        mime_type: file.type || null,
        size_bytes: file.size ?? null,
        created_by: createdBy,
      })
      .select('*')
      .single()
      .then(unwrap);
  },

  deleteFile: async (file) => {
    const { error: rmErr } = await supabase.storage.from(BUCKET).remove([file.storage_path]);
    if (rmErr) throw rmErr;
    const { error } = await supabase.from(FILES).delete().eq('id', file.id);
    if (error) throw error;
  },

  // Link assinado temporário para visualizar/baixar.
  signedUrl: async (storagePath, expiresIn = 3600) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, expiresIn);
    if (error) throw error;
    return data.signedUrl;
  },

  // Gera vários links assinados de uma vez (ex.: thumbnails de imagens).
  signedUrls: async (paths, expiresIn = 3600) => {
    if (!paths.length) return {};
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, expiresIn);
    if (error) throw error;
    const map = {};
    for (const item of data) {
      if (item.signedUrl && item.path) map[item.path] = item.signedUrl;
    }
    return map;
  },
};
