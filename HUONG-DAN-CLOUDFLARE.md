# Hướng dẫn cài GenTravel chạy 100% trên Cloudflare Workers (không cần Base44)

Bản này **không còn gọi Base44**. Giao diện (frontend) và phần xử lý/dữ liệu (backend) đều chạy trong một Cloudflare Worker:

| Việc | Trước (Base44) | Bây giờ (Cloudflare) |
|---|---|---|
| Trang web + giao diện | Worker | Worker (giữ nguyên) |
| Dữ liệu tour, đơn, khách… | Base44 entities | **D1** (cơ sở dữ liệu SQL của Cloudflare) |
| Đăng nhập / phân quyền | Base44 auth | **Tự quản trong Worker** (email + mật khẩu, token JWT) |
| Ảnh, chứng từ | Base44 storage | **R2** (kho file của Cloudflare) |
| Gửi email | Base44 | **Resend** (tuỳ chọn) |
| Gợi ý SEO bằng AI | Base44 InvokeLLM | **Workers AI** (tuỳ chọn) |
| Quyền truy cập dữ liệu | Quy tắc `rls` của Base44 | Vẫn dùng đúng các quy tắc `rls` trong `schema/entities/*.jsonc` |

---

## 1. Chuẩn bị (làm một lần)

1. **Node.js 20 trở lên** (khuyên dùng bản LTS): https://nodejs.org → kiểm tra bằng `node -v`.
2. **Tài khoản Cloudflare** (miễn phí): https://dash.cloudflare.com
3. **Tài khoản GitHub** nếu muốn tự động deploy mỗi lần đẩy code.
4. **Nên dùng gói Workers Paid (5 USD/tháng)**. Lý do: việc băm mật khẩu khi đăng nhập tốn CPU, gói Free chỉ cho 10 ms CPU mỗi lần gọi nên có thể báo lỗi khi đăng nhập (xem mục 11). Gói Free vẫn chạy được nếu làm theo mục 11.
5. **Bật R2** trong Cloudflare: Dashboard → **R2 Object Storage** → làm theo hướng dẫn kích hoạt (Cloudflare có thể yêu cầu thêm thẻ thanh toán; dung lượng miễn phí 10 GB, bạn không bị tính phí nếu dùng ít).

Mở **PowerShell** (Windows) hoặc Terminal (Mac/Linux). Các lệnh dưới đây chạy trong thư mục dự án (ví dụ `D:\WEB3\gentravel`).

---

## 2. Cài thư viện và đăng nhập Cloudflare

```powershell
cd D:\WEB3\gentravel
npm install
npx wrangler login
```

`wrangler login` mở trình duyệt, bấm **Allow** để cấp quyền.

> Nếu gặp lỗi `vite is not recognized`: bạn chưa chạy `npm install` hoặc đang đứng sai thư mục (phải là thư mục có file `package.json`).

---

## 3. Tạo cơ sở dữ liệu D1

```powershell
npx wrangler d1 create gentravel-db
```

Lệnh in ra một đoạn có dòng `"database_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"`. **Sao chép chuỗi đó**, mở `wrangler.jsonc` và thay `DAN-DATABASE-ID-VAO-DAY`:

```jsonc
"d1_databases": [{ "binding": "DB", "database_name": "gentravel-db", "database_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" }],
```

Không cần tạo bảng thủ công: Worker tự tạo các bảng ở lần chạy đầu tiên.

## 4. Tạo kho file R2

```powershell
npx wrangler r2 bucket create gentravel-files
```

Tên `gentravel-files` đã có sẵn trong `wrangler.jsonc` (mục `r2_buckets`). Nếu bạn đặt tên khác thì sửa `bucket_name` cho khớp.

## 5. Điền cấu hình trong `wrangler.jsonc`

Mở `wrangler.jsonc` và sửa:

```jsonc
"name": "gentravel",            // PHẢI trùng tên Worker (xem ghi chú bên dưới)
...
"vars": {
  "ADMIN_EMAILS": "email-cua-ban@gmail.com",   // email sẽ tự thành quản trị viên khi đăng ký
  "MAIL_FROM": "",                               // để trống nếu chưa dùng email (mục 9)
  "SITE_NAME": "GenTravel"
}
```

- **Tên Worker**: nếu bạn đã có Worker chạy rồi (ví dụ `web3` ở địa chỉ `web3.nguyenduc201191.workers.dev`) và muốn tiếp tục dùng, đặt `"name": "web3"`. Tên phải **giống hệt** tên Worker trên Cloudflare, nếu không Cloudflare sẽ tạo Worker mới hoặc build báo lỗi lệch tên.
- **ADMIN_EMAILS**: có thể nhiều email, cách nhau dấu phẩy. Nếu để trống, *tài khoản đăng ký đầu tiên* sẽ là quản trị viên. Nên điền để tránh người lạ đăng ký trước bạn.

## 6. Tạo bí mật JWT_SECRET (bắt buộc)

`JWT_SECRET` là chuỗi bí mật dùng để ký phiên đăng nhập. Tạo chuỗi ngẫu nhiên (PowerShell):

```powershell
-join ((48..57)+(65..90)+(97..122) | Get-Random -Count 48 | ForEach-Object {[char]$_})
```

Sao chép chuỗi in ra (48 ký tự). Bí mật được đặt **sau khi Worker đã tồn tại**, nên làm ở bước 7 xong rồi quay lại đây, hoặc đặt trực tiếp trên web:

**Cách A – bằng lệnh** (sau khi đã deploy lần đầu):
```powershell
npx wrangler secret put JWT_SECRET
```
Dán chuỗi vừa tạo khi được hỏi rồi nhấn Enter.

**Cách B – trên web**: Cloudflare → **Workers & Pages** → chọn Worker → **Settings** → **Variables and Secrets** → **Add** → Type **Secret**, Name `JWT_SECRET`, Value là chuỗi trên → **Deploy**.

> Đổi `JWT_SECRET` về sau sẽ làm mọi người phải đăng nhập lại (không mất dữ liệu).

---

## 7. Deploy (chọn một trong hai cách)

### Cách 1 – Deploy thẳng từ máy (đơn giản nhất)

```powershell
npm run deploy
```

Lệnh build rồi đẩy lên Cloudflare, cuối cùng in địa chỉ dạng `https://gentravel.<tài-khoản>.workers.dev`. Sau lần deploy đầu tiên, đặt `JWT_SECRET` (mục 6), rồi **deploy lại một lần** (`npm run deploy`) nếu trang báo thiếu JWT_SECRET.

### Cách 2 – Tự động deploy từ GitHub (Workers Builds)

1. Đưa mã nguồn lên GitHub (thư mục `import-data/`, `.dev.vars`, `node_modules` đã nằm trong `.gitignore`, sẽ không bị đưa lên).
2. Cloudflare → **Workers & Pages** → **Create** → **Import a repository** (hoặc vào Worker hiện có → **Settings → Builds → Connect**).
3. Chọn repo và nhánh `main`. Điền:
   - **Build command:** `npm run build`
   - **Deploy command:** `npx wrangler deploy`
   - **Root directory:** để trống (hoặc thư mục chứa `package.json`).
4. Lưu và chạy build. Từ giờ mỗi lần `git push` là tự deploy.
5. Đặt `JWT_SECRET` ở **Settings → Variables and Secrets** (cách B ở mục 6). Bí mật đặt trên Cloudflare được **giữ nguyên** qua các lần deploy.

> `database_id` trong `wrangler.jsonc` không phải bí mật, an toàn khi để trong GitHub.
> Không sửa biến thường (`ADMIN_EMAILS`, `MAIL_FROM`) trên web; hãy sửa trong `wrangler.jsonc` rồi push, vì mỗi lần deploy các biến thường được ghi đè theo file.

---

## 8. Kiểm tra và tạo tài khoản quản trị

1. Mở `https://<worker>.<tài-khoản>.workers.dev/api/diag`. Kết quả đúng:
   ```json
   { "jwtSecretOk": true, "d1Bound": true, "r2Bound": true, "aiBound": true, "d1": { "ok": true } }
   ```
   (`emailConfigured` là `false` nếu chưa làm mục 9, không sao.)
2. Mở `/register`, đăng ký bằng **đúng email trong `ADMIN_EMAILS`** → tự động là quản trị viên.
3. Vào `/quan-tri`, đăng nhập → vào khu quản trị `/admin`.
4. Trong quản trị: tạo **Tour** (bắt buộc có `Tiêu đề` và `slug`), thêm **Departure** (ngày khởi hành) rồi xem trang chủ và đặt thử một tour.
5. Mời nhân sự: **Quản trị → Nhân sự & phân quyền → Mời nhân sự**. Nếu chưa cấu hình email, hệ thống hiển thị **liên kết đặt mật khẩu** để bạn gửi cho nhân viên (hiệu lực 7 ngày).

---

## 9. Gửi email (tuỳ chọn, dùng cho: xác nhận đặt tour, báo cáo, mời nhân sự, quên mật khẩu)

Không có email thì website vẫn chạy: đặt tour vẫn lưu, chỉ không có email xác nhận; "Quên mật khẩu" sẽ không gửi được (admin dùng lệnh ở mục 10 để đặt lại mật khẩu).

1. Đăng ký https://resend.com (miễn phí), **Domains → Add Domain**, thêm các bản ghi DNS theo hướng dẫn cho tên miền của bạn rồi chờ **Verified**.
2. **API Keys → Create API Key** (quyền *Sending access*), sao chép khoá `re_...`.
3. Đặt bí mật: `npx wrangler secret put RESEND_API_KEY` (dán khoá).
4. Trong `wrangler.jsonc` đặt `"MAIL_FROM": "GenTravel <no-reply@tenmiencuaban.vn>"` (địa chỉ phải thuộc tên miền đã verify) rồi deploy lại.

---

## 10. Nhập dữ liệu cũ từ Base44 (tuỳ chọn)

Làm nếu bạn muốn đem tour, đơn, khách… từ Base44 sang.

1. Trong Base44: mở app → **Dashboard → Data** → chọn từng bảng → **Export** (JSON hoặc CSV).
2. Tạo thư mục `import-data` trong dự án và lưu **mỗi bảng một file đúng tên bảng**: `Tour.json` (hoặc `Tour.csv`), `Departure.json`, `Booking.json`, `Customer.json`, `Payment.json`, `User.json`… (tên bảng xem trong thư mục `schema/entities`).
3. *(Khuyến nghị)* chép ảnh sang R2 để không còn phụ thuộc Base44 (cần Internet, chạy trên máy bạn):
   ```powershell
   npm run images:migrate
   ```
   Lệnh tải mọi ảnh `media.base44.com` trong dữ liệu và ảnh giao diện (`src/lib/images.js`), đẩy lên R2, và ghi bản đồ đổi link. Nếu có ảnh lỗi, chạy lại lệnh (ảnh đã chép được bỏ qua).
4. Tạo file SQL rồi nạp vào D1 trên Cloudflare:
   ```powershell
   npm run db:import
   npx wrangler d1 execute gentravel-db --remote --file import.sql
   ```
   Giữ nguyên id, ngày tạo, người tạo. Chạy lại an toàn (ghi đè theo id).
5. **Tài khoản người dùng không mang được mật khẩu từ Base44.** Mỗi người bấm **Quên mật khẩu** ở trang đăng nhập (cần email, mục 9), hoặc bạn đặt cho họ:
   ```powershell
   npm run user:password -- ten@congty.vn MatKhauMoi123
   ```
   Lệnh tạo file `set-password.sql`, chạy tiếp:
   ```powershell
   npx wrangler d1 execute gentravel-db --remote --file set-password.sql
   del set-password.sql
   ```
   Cách này cũng dùng khi **quên mật khẩu admin**.
6. Nếu có dòng `CẢNH BÁO ... lớn hơn 100 KB`: bản ghi có ảnh nhúng dạng base64, không nạp được bằng `--file`; hãy xoá ảnh nhúng đó trong Base44 trước khi xuất, rồi nhập lại ảnh trong trang quản trị.
7. Sau `images:migrate`, **commit và push** thay đổi của `src/lib/images.js` để ảnh giao diện đổi sang R2.

---

## 11. Gói Free và lỗi quá thời gian CPU

Khi đăng nhập/đăng ký, hệ thống băm mật khẩu (PBKDF2, 100.000 vòng). Gói **Workers Free** chỉ cho khoảng 10 ms CPU mỗi lần gọi nên có thể gặp lỗi `Exceeded CPU limit` / 1102 ở thao tác này. Hai cách:

- **Nâng lên Workers Paid** (5 USD/tháng, khuyên dùng).
- Hoặc giữ gói Free và giảm số vòng băm (kém an toàn hơn): thêm vào `vars` trong `wrangler.jsonc`:
  ```jsonc
  "PBKDF2_ITERATIONS": "20000"
  ```
  rồi deploy lại. Mật khẩu **đã** lưu vẫn được kiểm tra bằng số vòng lúc tạo; mật khẩu tạo sau đó dùng số vòng mới.

D1 trên gói Free cũng giới hạn số truy vấn mỗi lần gọi (50). Trang quản trị gộp truy vấn nên thường đủ; nếu thấy báo lỗi ở báo cáo nặng, nâng lên Paid.

---

## 12. Chạy thử trên máy (không bắt buộc)

```powershell
copy .dev.vars.example .dev.vars    # rồi mở .dev.vars điền JWT_SECRET và ADMIN_EMAILS
npm run cf:dev                      # mở http://localhost:8787
```

Dữ liệu cục bộ nằm trong `.wrangler/state` (tách biệt với dữ liệu thật trên Cloudflare). Workers AI không chạy cục bộ nên bị tắt khi thử.

## 13. Tên miền riêng

Worker → **Settings → Domains & Routes → Add → Custom domain** → nhập tên miền (tên miền phải đang dùng DNS của Cloudflare). Ảnh dùng đường dẫn tương đối (`/files/...`) nên không hỏng khi đổi tên miền.

## 14. Webhook thanh toán VietQR (Casso / SePay / payOS)

Địa chỉ webhook: `https://<tên-miền-của-bạn>/api/vietqr-webhook`. Mã xác thực lấy ở **Quản trị → Thanh toán & công nợ → Nhận tiền VietQR tự động** (trường mã webhook); gửi kèm trong header `x-webhook-token` hoặc `?token=`. Nội dung chuyển khoản chứa mã đơn dạng `BK1234` sẽ tự khớp đơn và ghi nhận thanh toán.

---

## 15. Xử lý lỗi thường gặp

| Hiện tượng | Nguyên nhân / cách xử lý |
|---|---|
| `Chưa cấu hình JWT_SECRET` | Chưa đặt bí mật `JWT_SECRET` (≥ 32 ký tự). Làm mục 6 rồi deploy lại. |
| `Chưa gắn cơ sở dữ liệu D1 (binding DB)` | `database_id` trong `wrangler.jsonc` vẫn là `DAN-DATABASE-ID-VAO-DAY` hoặc sai. Làm mục 3. |
| Deploy báo lỗi D1/R2 `not found` | Chưa tạo D1/R2 (mục 3, 4) hoặc `database_name` / `bucket_name` khác tên đã tạo. |
| Build trên Cloudflare lỗi lệch tên Worker | `"name"` trong `wrangler.jsonc` khác tên Worker đang kết nối GitHub. |
| Đăng ký xong nhưng không vào được `/admin` | Tài khoản chưa có quyền admin (email không nằm trong `ADMIN_EMAILS` lúc đăng ký). Cấp quyền bằng lệnh ở mục 15.1 bên dưới. |
| `Đăng nhập sai quá nhiều lần` | Khoá tạm 15 phút sau 8 lần sai; chờ rồi thử lại. |
| Lỗi 1102 / `Exceeded CPU` khi đăng nhập | Mục 11. |
| Tải ảnh lên báo `Chỉ quản trị viên được tải file lên` | Phải đăng nhập bằng tài khoản có `role = admin`. |
| `Thiếu trường bắt buộc: ...` | Bản ghi thiếu trường `required` trong `schema/entities/*.jsonc` (ví dụ Tour cần `title`, `slug`). |
| Không nhận email | Chưa làm mục 9 hoặc `MAIL_FROM` không thuộc tên miền đã verify trong Resend. |
| Trang trắng / lỗi sau khi sửa code | Chạy `npm run build` trên máy để xem lỗi cụ thể. |

### 15.1 Cấp quyền admin cho một tài khoản đã có

```powershell
npx wrangler d1 execute gentravel-db --remote --command "UPDATE records SET data = json_set(data, '`$.role', 'admin') WHERE entity = 'User' AND json_extract(data, '`$.email') = 'email-cua-ban@gmail.com'"
```

(Lệnh dành cho PowerShell; dấu ` trước `$` là bắt buộc.) Sau đó đăng xuất rồi đăng nhập lại ở `/quan-tri`.

---

## 16. Khác biệt so với bản chạy trên Base44

- **Không còn**: đăng nhập bằng Google, xác thực hai lớp (MFA), mã OTP khi đăng ký. Đăng ký bằng email + mật khẩu (≥ 8 ký tự) và vào luôn.
- **Phiên đăng nhập** lưu ở trình duyệt, hiệu lực 30 ngày.
- Mật khẩu người dùng cũ ở Base44 **không chuyển được** (mục 10).
- Người dùng thường chỉ đọc được bản ghi của chính mình (bảng User) và các bảng theo quy tắc `rls`; quản trị viên (`role = admin`) có toàn quyền, đúng như bản Base44.
- Chỉ nhận ảnh JPG/PNG/WebP/GIF/AVIF, PDF, MP4, tối đa 12 MB mỗi file.

## 17. Đã kiểm thử và chưa kiểm thử

**Đã chạy thử** (trên Cloudflare local runtime, `wrangler dev`): build; đăng ký/đăng nhập/đăng nhập sai/khoá tạm; đặt lại mật khẩu qua liên kết (dùng một lần); quyền đọc/ghi từng vai (khách vãng lai, khách, admin); nhập dữ liệu JSON/CSV vào D1; chép ảnh sang R2; tải ảnh công khai và chứng từ riêng (liên kết ký có hạn); trang chủ, danh sách tour, chi tiết tour lấy dữ liệu từ D1; đặt tour công khai; 11 trang quản trị mở không lỗi; webhook VietQR ghi nhận thanh toán và chống trùng.

**Chưa chạy thử được** (cần tài khoản thật của bạn): gửi email qua Resend, gợi ý SEO bằng Workers AI, nhập dữ liệu thật từ Base44 của bạn, tải ảnh thật từ `media.base44.com`, và hiệu năng trên gói Free. Nếu một trong các phần này lỗi, mở `/api/diag` và gửi tôi kết quả cùng thông báo lỗi trong **Workers & Pages → Worker → Logs**.
