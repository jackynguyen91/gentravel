import { base44 } from "@/api/base44Client";
import { DEFAULT_SETTINGS, mergeSettings } from "@/lib/setting-defaults";

const asArray = (result) => (Array.isArray(result) ? result : (result?.items ?? []));

export { DEFAULT_SETTINGS, mergeSettings };
export { dueDateOf } from "@/lib/setting-defaults";

export async function loadSettings() {
  const rows = asArray(await base44.entities.Setting.list({ limit: 1 }));
  return { record: rows[0] || null, settings: mergeSettings(rows[0]) };
}

export async function saveSettings(record, patch) {
  if (record?.id) {
    await base44.entities.Setting.update(record.id, patch);
    return record.id;
  }
  const created = await base44.entities.Setting.create(patch);
  return created.id;
}