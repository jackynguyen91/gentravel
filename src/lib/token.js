// Token đăng nhập lưu ở trình duyệt (localStorage); máy chủ không giữ phiên.
const KEY = "gentravel_token";

export const getToken = () => {
  try {
    return typeof window === "undefined" ? null : window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
};
export const setToken = (token) => {
  try {
    if (token) window.localStorage.setItem(KEY, token);
    else window.localStorage.removeItem(KEY);
  } catch {
    /* trình duyệt chặn localStorage: phiên chỉ tồn tại trong tab hiện tại */
  }
};
