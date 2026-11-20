/** Bản ghi tạo trước ngày mốc được coi là dữ liệu mẫu khi bật "Chỉ dùng dữ liệu thật". */
export function isSample(record, settings) {
  if (!settings?.hide_sample_data) return false;
  const cutoff = String(settings.demo_cutoff || "").slice(0, 10);
  if (!cutoff) return false;
  const created = String(record?.created_date || "").slice(0, 10);
  return Boolean(created) && created < cutoff;
}

export function stripSample(rows, settings) {
  return rows.filter((row) => !isSample(row, settings));
}