import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

const formatVND = (value) => `${Number(value || 0).toLocaleString("vi-VN")}₫`;

/** Tạo PDF báo giá (A4) từ dữ liệu yêu cầu dịch vụ + thông tin công ty. */
export async function buildQuotePdf(request, settings = {}) {
  const node = document.createElement("div");
  node.style.position = "fixed";
  node.style.left = "-9999px";
  node.style.top = "0";
  node.style.width = "794px";
  node.style.padding = "40px";
  node.style.background = "#ffffff";
  node.style.fontFamily = "Inter, Arial, sans-serif";
  node.style.color = "#0f172a";
  node.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0f766e;padding-bottom:16px">
      <div>
        <div style="font-size:20px;font-weight:800;color:#0f766e">${settings.company_name || "GenTravel"}</div>
        <div style="font-size:11px;color:#475569;margin-top:4px">${settings.address || ""}</div>
        <div style="font-size:11px;color:#475569">Hotline: ${settings.hotline || ""} · ${settings.email || ""}</div>
        ${settings.tax_code ? `<div style="font-size:11px;color:#475569">MST: ${settings.tax_code}</div>` : ""}
      </div>
      <div style="text-align:right">
        <div style="font-size:16px;font-weight:700">BÁO GIÁ DỊCH VỤ</div>
        <div style="font-size:11px;color:#475569;margin-top:4px">Số: ${request.request_code}</div>
        <div style="font-size:11px;color:#475569">Ngày: ${new Date().toLocaleDateString("vi-VN")}</div>
      </div>
    </div>
    <div style="margin-top:18px;font-size:12px;line-height:1.7">
      <div><strong>Kính gửi:</strong> ${request.customer_name}</div>
      <div><strong>Điện thoại:</strong> ${request.customer_phone}${request.customer_email ? ` · <strong>Email:</strong> ${request.customer_email}` : ""}</div>
    </div>
    <div style="margin-top:16px;font-size:12px;line-height:1.8">
      <div><strong>Dịch vụ:</strong> ${request.service_title}${request.service_type ? ` (${request.service_type})` : ""}</div>
      <div><strong>Ngày dùng:</strong> ${request.use_date || "Theo yêu cầu"}${request.end_date ? ` → ${request.end_date}` : ""}</div>
      <div><strong>Số khách:</strong> ${request.adults_count || 0} người lớn · ${request.children_count || 0} trẻ em</div>
      ${request.content ? `<div><strong>Nội dung yêu cầu:</strong> ${request.content}</div>` : ""}
    </div>
    <table style="width:100%;margin-top:18px;border-collapse:collapse;font-size:12px">
      <thead>
        <tr style="background:#f1f5f9">
          <th style="text-align:left;padding:8px;border:1px solid #e2e8f0">Nội dung</th>
          <th style="text-align:right;padding:8px;border:1px solid #e2e8f0;width:140px">Số tiền</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding:8px;border:1px solid #e2e8f0">${request.service_title}</td>
          <td style="padding:8px;border:1px solid #e2e8f0;text-align:right">${formatVND(request.quoted_price)}</td>
        </tr>
        <tr>
          <td style="padding:8px;border:1px solid #e2e8f0;text-align:right;font-weight:700">Tổng cộng</td>
          <td style="padding:8px;border:1px solid #e2e8f0;text-align:right;font-weight:700;color:#b45309">${formatVND(request.quoted_price)}</td>
        </tr>
      </tbody>
    </table>
    <div style="margin-top:18px;font-size:11px;color:#475569;line-height:1.7">
      <div><strong>Thông tin thanh toán:</strong> ${settings.bank_name || ""} ${settings.account_number ? `· STK ${settings.account_number}` : ""} ${settings.account_name ? `· ${settings.account_name}` : ""}</div>
      <div>Báo giá có hiệu lực trong 48 giờ. Giá có thể thay đổi theo tình trạng chỗ của nhà cung cấp.</div>
    </div>
    <div style="margin-top:32px;display:flex;justify-content:space-between;font-size:11px;color:#475569">
      <div>Khách hàng xác nhận</div>
      <div>${settings.company_name || "GenTravel"} – Bộ phận kinh doanh</div>
    </div>
  `;
  document.body.appendChild(node);
  try {
    const canvas = await html2canvas(node, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const width = pdf.internal.pageSize.getWidth();
    const height = (canvas.height * width) / canvas.width;
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, width, height);
    return pdf.output("datauristring").split(",")[1];
  } finally {
    node.remove();
  }
}