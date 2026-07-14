"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { PartnerRequestRow } from "@/lib/data";

type Props = {
  items: PartnerRequestRow[];
  companyName: string;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
};

function printRequestPDF(
  r: PartnerRequestRow,
  companyName: string,
  contactName?: string | null,
  contactPhone?: string | null,
  contactEmail?: string | null,
) {
  // #region agent log
  fetch('http://127.0.0.1:7414/ingest/69ad28d6-3417-4a08-9757-3f740b8c55d0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c88ff0'},body:JSON.stringify({sessionId:'c88ff0',location:'WonRequestsSection.tsx:printRequestPDF',message:'subtitle inputs',data:{category:r.category,order_id:r.order_id},hypothesisId:'A',timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  const subtitleParts = [r.category, r.order_id ? `Order #${r.order_id}` : null].filter(Boolean);
  const subtitle = subtitleParts.join(" · ");

  const dims = [r.width, r.height, r.depth].filter((v) => v != null);
  const dimensionsStr = dims.length
    ? `${dims.join(" × ")} ${r.size_unit || "mm"}`
    : r.standard_size || "—";

  const contactBlock = (contactName || contactPhone || contactEmail)
    ? `<div class="section">
    <div class="section-title">Contact</div>
    <div class="grid">
      ${contactName ? `<div class="field"><label>Contact</label><span>${contactName}</span></div>` : ""}
      ${contactPhone ? `<div class="field"><label>Phone</label><span>${contactPhone}</span></div>` : ""}
      ${contactEmail ? `<div class="field"><label>Email</label><span>${contactEmail}</span></div>` : ""}
    </div>
  </div>` : "";

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${r.title} — Won Order</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111; padding: 40px; font-size: 14px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #fbbf24; }
    .header-left h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
    .header-left p { color: #6b7280; font-size: 13px; }
    .won-badge { background: linear-gradient(135deg,#fbbf24,#f59e0b); color: #fff; font-weight: 700; font-size: 13px; padding: 6px 14px; border-radius: 20px; letter-spacing: 0.5px; }
    .company { font-size: 13px; color: #6b7280; margin-bottom: 24px; }
    .section { margin-bottom: 20px; }
    .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 10px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
    .field { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 14px; }
    .field label { font-size: 11px; color: #9ca3af; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 3px; }
    .field span { font-size: 14px; font-weight: 600; color: #111; }
    .field.full { grid-column: 1 / -1; }
    .price-field { background: #f0fdf4; border-color: #bbf7d0; }
    .price-field span { color: #15803d; font-size: 18px; }
    .specs-text { white-space: pre-wrap; font-weight: 400 !important; font-size: 13px !important; line-height: 1.5; }
    .footer { margin-top: 28px; padding-top: 14px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; display: flex; justify-content: space-between; }
    @media print {
      body { padding: 24px; }
      @page { margin: 16mm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>${r.title}</h1>
      <p>${subtitle}</p>
    </div>
    <span class="won-badge">🏆 WON</span>
  </div>
  <div class="company">Awarded by <strong>${companyName}</strong></div>

  <div class="section">
    <div class="section-title">Order details</div>
    <div class="grid">
      <div class="field price-field">
        <label>Agreed price</label>
        <span>${r.price != null ? `${r.currency || "$"}${r.price.toLocaleString()}` : "—"}</span>
      </div>
      <div class="field">
        <label>Lead time</label>
        <span>${r.lead_time_days != null ? `${r.lead_time_days} days` : "—"}</span>
      </div>
      <div class="field">
        <label>Quantity</label>
        <span>${r.quantity ? r.quantity.toLocaleString() : "—"}</span>
      </div>
      <div class="field">
        <label>Needed by</label>
        <span>${r.needed_by || "—"}</span>
      </div>
      ${r.valid_until ? `<div class="field"><label>Valid until</label><span>${r.valid_until}</span></div>` : ""}
      ${r.conditions ? `<div class="field full"><label>Conditions</label><span style="font-weight:400;font-size:13px">${r.conditions}</span></div>` : ""}
    </div>
  </div>

  <div class="section">
    <div class="section-title">Product specifications</div>
    <div class="grid">
      <div class="field">
        <label>Dimensions</label>
        <span>${dimensionsStr}</span>
      </div>
      <div class="field">
        <label>Material</label>
        <span>${r.material || "—"}</span>
      </div>
      <div class="field full">
        <label>Finishing</label>
        <span>${r.finishing || "—"}</span>
      </div>
      ${r.specs ? `<div class="field full">
        <label>Specifications</label>
        <span class="specs-text">${r.specs}</span>
      </div>` : ""}
    </div>
  </div>

  ${contactBlock}

  ${r.attachmentUrls?.length ? `
  <div class="section">
    <div class="section-title">Attachments</div>
    <div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:4px;">
      ${r.attachmentUrls.map((a) => {
        const isImage = /\.(png|jpe?g|webp|gif|svg)$/i.test(a.name);
        return isImage
          ? `<div style="text-align:center;">
               <img src="${a.url}" alt="${a.name}" style="width:160px;height:160px;object-fit:cover;border-radius:8px;border:1px solid #e5e7eb;display:block;" />
               <div style="font-size:11px;color:#6b7280;margin-top:4px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${a.name}</div>
             </div>`
          : `<div style="width:160px;height:160px;border-radius:8px;border:1px solid #e5e7eb;background:#f9fafb;display:flex;align-items:center;justify-content:center;padding:10px;text-align:center;font-size:12px;color:#374151;">
               📄 ${a.name}
             </div>`;
      }).join("")}
    </div>
  </div>` : ""}

  <div class="footer">
    <span>Generated ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</span>
    <span>SupplyerHUB</span>
  </div>
  <script>window.onload = function(){ window.print(); }<\/script>
</body>
</html>`;

  const w = window.open("", "_blank", "width=800,height=600");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

export function WonRequestsSection({ items, companyName, contactName, contactPhone, contactEmail }: Props) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  if (items.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        @keyframes wonFadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-gold {
          0%, 100% { box-shadow: 0 0 0 0 rgba(234,179,8,0.35); }
          50%       { box-shadow: 0 0 0 8px rgba(234,179,8,0); }
        }
        .won-section {
          opacity: 0; transform: translateY(14px);
          transition: opacity 0.5s ease, transform 0.5s ease;
          margin-bottom: 22px;
        }
        .won-section.visible { opacity: 1; transform: translateY(0); }
        .won-row {
          background: linear-gradient(90deg,#fefce8 0%,#fef9c3 40%,#fefce8 60%,#fef9c3 100%);
          background-size: 800px 100%;
          animation: shimmer 2.8s linear infinite, wonFadeUp 0.45s ease both;
        }
        .won-row td { border-bottom-color: #fde68a !important; }
        .won-header { display: flex; align-items: center; margin-bottom: 10px; }
        .won-title { display: flex; align-items: center; gap: 8px; font-size: 18px; font-weight: 700; color: #92400e; }
        .won-trophy {
          display: inline-flex; align-items: center; justify-content: center;
          width: 32px; height: 32px; border-radius: 8px;
          background: linear-gradient(135deg,#fbbf24,#f59e0b);
          box-shadow: 0 2px 8px rgba(251,191,36,0.45);
          animation: pulse-gold 2s ease infinite;
          font-size: 17px; line-height: 1;
        }
        .won-table { border-radius: 10px; overflow: hidden; border: 2px solid #fde68a; box-shadow: 0 2px 16px rgba(251,191,36,0.18); }
        .won-table thead tr { background: linear-gradient(90deg,#fef9c3,#fef3c7); }
        .won-table thead th { color: #92400e !important; border-bottom: 2px solid #fde68a !important; }
        .pdf-btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 5px;
          font-size: 13px; font-weight: 500; padding: 0 10px;
          border-radius: 6px; cursor: pointer; white-space: nowrap;
          font-family: inherit;
          color: #92400e;
          background: linear-gradient(135deg,#fef3c7,#fde68a);
          border: 1px solid #fcd34d;
          transition: all .15s;
          height: 30px;
        }
        .pdf-btn:hover { background: linear-gradient(135deg,#fde68a,#fbbf24); }
        .row-actions { display: flex; align-items: center; gap: 6px; }
        .row-actions .btn { height: 30px; font-size: 13px; display: inline-flex; align-items: center; justify-content: center; }
        .row-actions td { vertical-align: middle; }
      `}</style>

      <div ref={ref} className={`won-section${visible ? " visible" : ""}`}>
        <div className="won-header">
          <div className="won-title">
            <span className="won-trophy">🏆</span>
            Won
            <span style={{ fontSize: 13, fontWeight: 400, color: "#a16207", marginLeft: 4 }}>
              ({items.length} order{items.length !== 1 ? "s" : ""})
            </span>
          </div>
        </div>

        <table className="data won-table" style={{ tableLayout: "fixed", width: "100%" }}>
          <colgroup>
            <col style={{ width: "33%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "13%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "21%" }} />
          </colgroup>
          <thead>
            <tr>
              <th>Product</th>
              <th>Quantity</th>
              <th>Needed by</th>
              <th>Price</th>
              <th>Lead time</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((r, i) => (
              <tr key={r.id} className="won-row" style={{ animationDelay: `${i * 80}ms` }}>
                <td>
                  <strong>{r.title}</strong>
                  <br />
                  <span className="small muted">{r.category}</span>
                </td>
                <td>{r.quantity ? r.quantity.toLocaleString() : "—"}</td>
                <td>{r.needed_by || "—"}</td>
                <td style={{ fontWeight: 600, color: "#15803d" }}>
                  {r.price != null ? `$${r.price.toLocaleString()}` : "—"}
                </td>
                <td>{r.lead_time_days != null ? `${r.lead_time_days}d` : "—"}</td>
                <td>
                  <div className="row-actions">
                    <Link className="btn sm ghost" href={`/partner/requests/${r.id}`}>
                      View
                    </Link>
                    <button
                      type="button"
                      className="pdf-btn"
                      onClick={() => printRequestPDF(r, companyName, contactName, contactPhone, contactEmail)}
                      title="Download as PDF"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      PDF
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
