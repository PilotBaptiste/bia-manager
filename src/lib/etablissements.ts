// A slot or flight belongs to an active établissement when one of its établissements is active.
// Slots open to every school (no établissement) always count.
export function inActiveEtab(
  slot: { etablissement_id?: string | null; etablissement_ids?: string[] | null } | null | undefined,
  activeIds: Set<string>,
) {
  if (!slot) return false;
  const ids = slot.etablissement_ids || [];
  if (ids.length > 0) return ids.some((id) => activeIds.has(id));
  if (slot.etablissement_id) return activeIds.has(slot.etablissement_id);
  return true;
}
