import { supabase } from '@/infrastructure/supabase/client';

const BUCKET = 'member-files';
const TABLE = 'member_documents';

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

export const MEMBER_BUCKET = BUCKET;

export const memberDocsApi = {
  listByProfile: (profileId) =>
    supabase
      .from(TABLE)
      .select('*')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
      .then(unwrap),

  upload: async ({ file, profileId, docType = 'documento', createdBy = null }) => {
    const storagePath = `${profileId}/${crypto.randomUUID()}`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, file, { contentType: file.type || undefined, upsert: false });
    if (upErr) throw upErr;
    return supabase
      .from(TABLE)
      .insert({
        profile_id: profileId,
        name: file.name,
        storage_path: storagePath,
        mime_type: file.type || null,
        size_bytes: file.size ?? null,
        doc_type: docType,
        created_by: createdBy,
      })
      .select('*')
      .single()
      .then(unwrap);
  },

  remove: async (doc) => {
    const { error: rmErr } = await supabase.storage.from(BUCKET).remove([doc.storage_path]);
    if (rmErr) throw rmErr;
    const { error } = await supabase.from(TABLE).delete().eq('id', doc.id);
    if (error) throw error;
  },
};
