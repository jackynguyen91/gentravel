export const PASSENGER_TYPES = ["Người lớn", "Trẻ em", "Em bé"];
export const GENDERS = ["Nam", "Nữ", "Khác"];
export const ID_TYPES = ["CCCD", "Hộ chiếu", "Giấy khai sinh", "Khác"];

const EDGE = {
  "CCCD": [3, 3],
  "Hộ chiếu": [1, 2],
  "Giấy khai sinh": [2, 3],
  "Khác": [2, 2],
};

/** Che số giấy tờ: chỉ giữ vài ký tự đầu/cuối, phần giữa thay bằng dấu chấm. */
export function maskIdNumber(value, idType) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const [keepStart, keepEnd] = EDGE[idType] || EDGE.Khác;
  if (raw.length <= keepStart + keepEnd) return "•".repeat(Math.max(raw.length, 3));
  return `${raw.slice(0, keepStart)}${"•".repeat(raw.length - keepStart - keepEnd)}${raw.slice(-keepEnd)}`;
}

/** Giấy tờ hết hạn trước ngày khởi hành → cảnh báo cho tour quốc tế. */
export function isExpiredBefore(expiry, departureDate) {
  if (!expiry || !departureDate) return false;
  const expiryTime = new Date(expiry).getTime();
  const departureTime = new Date(departureDate).getTime();
  if (Number.isNaN(expiryTime) || Number.isNaN(departureTime)) return false;
  return expiryTime < departureTime;
}