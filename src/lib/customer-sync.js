export const normalizePhone = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("84") && digits.length >= 11) return `0${digits.slice(2)}`;
  if (digits.startsWith("0")) return digits;
  if (digits.length === 9) return `0${digits}`;
  return digits;
};

const asArray = (result) => (Array.isArray(result) ? result : (result?.items ?? []));

// Khớp khách theo SĐT chuẩn hoá; chưa có thì tạo mới. Không đổi tên/SĐT đã nhập trên đơn cũ.
export async function syncCustomer(service, { name, phone, email, channel, owner }) {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;

  const existing = asArray(
    await service.entities.Customer.filter({ phone_normalized: normalized }, { limit: 1 }),
  )[0];

  if (existing) {
    const patch = {};
    if (normalized !== existing.phone_normalized) patch.phone_normalized = normalized;
    if (!existing.email && email) patch.email = email;
    if (Object.keys(patch).length) await service.entities.Customer.update(existing.id, patch);
    return existing.id;
  }

  const created = await service.entities.Customer.create({
    full_name: String(name || "").trim(),
    phone: String(phone || "").trim(),
    phone_normalized: normalized,
    email: email || "",
    source_channel: channel || "Website",
    owner: owner || "",
    tier: "Mới",
    segment: "Mới",
    tags: [],
  });
  return created.id;
}