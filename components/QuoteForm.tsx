"use client";

import { useState } from "react";
import { Badge } from "@/components/Badge";
import type { Quote } from "@/lib/types";

type Props = {
  dispatchId: number;
  requestId: number;
  quote: Quote | null;
  isAwarded: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  submitQuote: (formData: FormData) => Promise<any>;
};

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

const today = new Date().toISOString().split("T")[0];

export function QuoteForm({ dispatchId, requestId, quote, isAwarded, submitQuote }: Props) {
  const [leadTime, setLeadTime] = useState<string>(
    quote?.lead_time_days != null ? String(quote.lead_time_days) : ""
  );
  const [deliveryDate, setDeliveryDate] = useState<string>(() => {
    if (quote?.lead_time_days != null) return addDays(quote.lead_time_days);
    return "";
  });

  function handleLeadTimeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setLeadTime(val);
    const days = parseInt(val, 10);
    if (!isNaN(days) && days >= 0) {
      setDeliveryDate(addDays(days));
    } else {
      setDeliveryDate("");
    }
  }

  return (
    <div className="card">
      <h3>
        {quote ? "Your quote" : "Submit your quote"}{" "}
        {quote && <Badge status={quote.status} />}
      </h3>

      {isAwarded ? (
        quote ? (
          <p className="small muted">
            This request has been decided. Your quote: {quote.currency}{" "}
            {quote.price?.toLocaleString()} · {quote.lead_time_days} days.
          </p>
        ) : (
          <p className="small muted">This request has already been awarded.</p>
        )
      ) : (
        <form action={submitQuote}>
          <input type="hidden" name="dispatch_id" value={dispatchId} />
          <input type="hidden" name="request_id" value={requestId} />
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div className="field" style={{ marginBottom: 0, flex: "1 1 80px" }}>
              <label>Price *</label>
              <input name="price" type="number" step="0.01" min="0" required
                defaultValue={quote?.price ?? ""} placeholder="12000" />
            </div>
            <div className="field" style={{ marginBottom: 0, flex: "1 1 70px" }}>
              <label>Currency</label>
              <select name="currency" defaultValue={quote?.currency ?? "USD"}>
                <option>USD</option>
                <option>EUR</option>
                <option>GBP</option>
                <option>AMD</option>
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0, flex: "1 1 80px" }}>
              <label>Lead time (days)</label>
              <input
                name="lead_time_days"
                type="number"
                min="0"
                value={leadTime}
                onChange={handleLeadTimeChange}
                placeholder="14"
              />
            </div>
            <div className="field" style={{ marginBottom: 0, flex: "1 1 120px" }}>
              <label>Estimated delivery</label>
              <input
                name="delivery_date"
                type="date"
                value={deliveryDate}
                min={today}
                onChange={(e) => setDeliveryDate(e.target.value)}
                placeholder="Auto-filled from lead time"
              />
            </div>
            <div className="field" style={{ marginBottom: 0, flex: "1 1 110px" }}>
              <label>Valid until</label>
              <input
                name="valid_until"
                type="date"
                min={today}
                defaultValue={quote?.valid_until ?? ""}
              />
            </div>
            <div className="field" style={{ marginBottom: 0, flex: "2 1 120px" }}>
              <label>Conditions</label>
              <input name="conditions"
                defaultValue={quote?.conditions ?? ""} placeholder="Notes…" />
            </div>
            <button className="btn" type="submit" style={{ flex: "none", marginBottom: 0 }}>
              {quote ? "Update" : "Submit"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
