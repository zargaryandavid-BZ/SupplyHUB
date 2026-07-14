"use client";

import { useState } from "react";
import { ImageUpload } from "@/components/ImageUpload";

const FINISHING = [
  "Gloss Lamination",
  "Matte Lamination",
  "Soft-Touch Lamination",
  "UV Coating",
  "Spot UV",
  "Die Cutting",
  "Foil Stamping",
  "Embossing",
  "Saddle Stitching",
  "Perfect Binding",
  "Spiral / Coil Binding",
  "Folding",
  "Perforation",
  "Rounded Corners",
];

export type RequestDetailFields = {
  id: number;
  title: string;
  category: string | null;
  specs: string | null;
  quantity: number | null;
  needed_by: string | null;
  client_name: string;
  client_contact: string;
  order_number: string;
  standard_size: string | null;
  width: number | null;
  height: number | null;
  depth: number | null;
  size_unit: string | null;
  material: string | null;
  finishing: string | null;
};

export type RequestAttachment = {
  key: string;
  url: string;
  name: string;
};

function isImageName(name: string): boolean {
  return /\.(png|jpe?g|webp|gif|svg)$/i.test(name);
}

function formatDimensions(r: RequestDetailFields): string {
  const unit = r.size_unit || "mm";
  const parts = [r.width, r.height, r.depth].filter((v) => v != null);
  if (parts.length) return `${parts.join(" × ")} ${unit}`;
  if (r.standard_size) return r.standard_size;
  return "—";
}

function fmt(v: string | number | null | undefined): string {
  if (v == null || v === "") return "—";
  if (typeof v === "number") return v.toLocaleString();
  return v;
}

export function RequestDetailsPanel({
  request,
  attachments,
  updateAction,
}: {
  request: RequestDetailFields;
  attachments: RequestAttachment[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateAction: (formData: FormData) => Promise<any>;
}) {
  const [editing, setEditing] = useState(false);
  const [kept, setKept] = useState<string[]>(attachments.map((a) => a.key));

  const selectedFinishing = (request.finishing || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!editing) {
    return (
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 4 }}>
          <h3 style={{ margin: 0 }}>Details</h3>
          <button
            type="button"
            className="btn sm ghost"
            onClick={() => {
              setKept(attachments.map((a) => a.key));
              setEditing(true);
            }}
          >
            Edit request
          </button>
        </div>
        <p className="small muted" style={{ margin: "0 0 12px" }}>
          Quote requests can be updated anytime — partners will see the latest details.
        </p>

        <dl className="dl">
          <dt>Client</dt>
          <dd>
            {request.client_name}
            {request.client_contact ? ` (${request.client_contact})` : ""}
          </dd>
          <dt>Order / request no.</dt>
          <dd>{fmt(request.order_number)}</dd>
          <dt>Product</dt>
          <dd>{fmt(request.category)}</dd>
          <dt>Title</dt>
          <dd>{fmt(request.title)}</dd>
          <dt>Quantity</dt>
          <dd>{request.quantity != null ? request.quantity.toLocaleString() : "—"}</dd>
          <dt>Needed by</dt>
          <dd>{fmt(request.needed_by)}</dd>
          <dt>Dimensions</dt>
          <dd>{formatDimensions(request)}</dd>
          {request.standard_size ? (
            <>
              <dt>Standard size</dt>
              <dd>{request.standard_size}</dd>
            </>
          ) : null}
          <dt>Material</dt>
          <dd>{fmt(request.material)}</dd>
          <dt>Finishing</dt>
          <dd>{fmt(request.finishing)}</dd>
          <dt>Specifications</dt>
          <dd style={{ whiteSpace: "pre-wrap" }}>{fmt(request.specs)}</dd>
        </dl>

        <hr className="sep" />
        <p className="small" style={{ fontWeight: 600, marginBottom: 8 }}>
          Attachments {attachments.length ? `(${attachments.length})` : ""}
        </p>
        {attachments.length === 0 ? (
          <p className="small muted" style={{ margin: 0 }}>No files attached.</p>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {attachments.map((a) => {
              const image = isImageName(a.name);
              return (
                <a
                  key={a.key}
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={a.name}
                  style={{
                    display: "block",
                    width: image ? 120 : "auto",
                    textDecoration: "none",
                  }}
                >
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.url}
                      alt={a.name}
                      style={{
                        width: 120,
                        height: 120,
                        objectFit: "cover",
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                        background: "#f8fafc",
                        display: "block",
                      }}
                    />
                  ) : (
                    <span className="btn ghost sm">↓ {a.name}</span>
                  )}
                  {image && (
                    <span className="small muted" style={{ display: "block", marginTop: 4, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {a.name}
                    </span>
                  )}
                </a>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 4 }}>
        <h3 style={{ margin: 0 }}>Edit request</h3>
        <button
          type="button"
          className="btn sm ghost"
          onClick={() => {
            setKept(attachments.map((a) => a.key));
            setEditing(false);
          }}
        >
          Cancel
        </button>
      </div>
      <p className="small muted" style={{ margin: "0 0 12px" }}>
        Changes save immediately for partners reviewing this quote request.
      </p>

      <form action={updateAction}>
        <input type="hidden" name="id" value={request.id} />

        <div className="grid cols-2" style={{ gap: 10 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Product *</label>
            <input name="category" required defaultValue={request.category ?? ""} placeholder="Business Cards" />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Quantity *</label>
            <input name="quantity" type="number" min="1" required defaultValue={request.quantity ?? ""} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Request title</label>
            <input name="title" defaultValue={request.title} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Needed by</label>
            <input name="needed_by" type="date" defaultValue={request.needed_by ?? ""} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Order / request no.</label>
            <input name="order_number" defaultValue={request.order_number ?? ""} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Material</label>
            <input name="material" defaultValue={request.material ?? ""} placeholder="350 gsm silk" />
          </div>
        </div>

        <div className="grid" style={{ gap: 10, gridTemplateColumns: "1fr 1fr 1fr 0.9fr", marginTop: 10 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Width (X)</label>
            <input name="width" type="number" min="0" step="0.1" defaultValue={request.width ?? ""} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Height (Y)</label>
            <input name="height" type="number" min="0" step="0.1" defaultValue={request.height ?? ""} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Depth (Z)</label>
            <input name="depth" type="number" min="0" step="0.1" defaultValue={request.depth ?? ""} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Unit</label>
            <select name="size_unit" defaultValue={request.size_unit || "mm"}>
              <option value="mm">mm</option>
              <option value="cm">cm</option>
              <option value="in">in</option>
            </select>
          </div>
        </div>

        <div className="field" style={{ marginTop: 10, marginBottom: 0 }}>
          <label>Standard size</label>
          <input name="standard_size" defaultValue={request.standard_size ?? ""} placeholder="A4, 3.5×2 in…" />
        </div>

        <div className="field" style={{ marginTop: 10, marginBottom: 0 }}>
          <label>Specifications</label>
          <textarea
            name="specs"
            defaultValue={request.specs ?? ""}
            placeholder="Colors, paper weight, binding, special instructions…"
            style={{ minHeight: 72 }}
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <div className="field-section-title" style={{ marginBottom: 6 }}>Finishing</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {FINISHING.map((f) => (
              <label className="check" key={f} style={{ padding: "6px 10px", gap: 6 }}>
                <input
                  type="checkbox"
                  name="finishing"
                  value={f}
                  defaultChecked={selectedFinishing.includes(f)}
                />
                <span>{f}</span>
              </label>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <div className="field-section-title" style={{ marginBottom: 6 }}>
            Attachments &amp; pictures
          </div>
          {attachments.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
              {attachments.map((a) => {
                const on = kept.includes(a.key);
                const image = isImageName(a.name);
                return (
                  <div key={a.key} style={{ position: "relative", opacity: on ? 1 : 0.4 }}>
                    {on && <input type="hidden" name="keep_attachments" value={a.key} />}
                    {image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={a.url}
                        alt={a.name}
                        style={{
                          width: 96,
                          height: 96,
                          objectFit: "cover",
                          borderRadius: 8,
                          border: "1px solid var(--border)",
                          display: "block",
                        }}
                      />
                    ) : (
                      <div
                        className="small"
                        style={{
                          width: 96,
                          height: 96,
                          borderRadius: 8,
                          border: "1px solid var(--border)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: 6,
                          textAlign: "center",
                          background: "#f8fafc",
                        }}
                      >
                        {a.name}
                      </div>
                    )}
                    <button
                      type="button"
                      className="btn sm ghost"
                      style={{ marginTop: 4, width: "100%", padding: "2px 6px", fontSize: 11 }}
                      onClick={() =>
                        setKept((prev) =>
                          on ? prev.filter((k) => k !== a.key) : [...prev, a.key]
                        )
                      }
                    >
                      {on ? "Remove" : "Keep"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <ImageUpload />
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button className="btn" type="submit">
            Save changes
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              setKept(attachments.map((a) => a.key));
              setEditing(false);
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
