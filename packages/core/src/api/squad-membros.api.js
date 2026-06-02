import { supabase } from '../supabase/client.js';

const TABLE = 'squad_membros';

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

export const squadMembrosApi = {
  addMembro: (squadId, profileId) =>
    supabase
      .from(TABLE)
      .insert({ squad_id: squadId, profile_id: profileId })
      .then(unwrap),

  removeMembro: (squadId, profileId) =>
    supabase
      .from(TABLE)
      .delete()
      .eq('squad_id', squadId)
      .eq('profile_id', profileId)
      .then(unwrap),

  /**
   * Replaces the full member list of a squad in one operation.
   * Deletes all existing memberships for the squad, then inserts the new ones.
   */
  setMembros: async (squadId, profileIds = []) => {
    const { error: deleteError } = await supabase
      .from(TABLE)
      .delete()
      .eq('squad_id', squadId);
    if (deleteError) throw deleteError;

    if (profileIds.length === 0) return [];

    const { data, error: insertError } = await supabase
      .from(TABLE)
      .insert(profileIds.map((profile_id) => ({ squad_id: squadId, profile_id })))
      .select();
    if (insertError) throw insertError;
    return data;
  },
};
