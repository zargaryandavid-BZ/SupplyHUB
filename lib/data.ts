import { supabaseAdmin } from "./supabaseServer";
import type { Partner, Client, ProductRequest, Quote, Message, Dispatch, PartnerFeedback } from "./types";

// ---------- Partners ----------

export async function allPartners(): Promise<Partner[]> {
  const { data } = await supabaseAdmin()
    .from("partners")
    .select("*")
    .order("company");
  return (data ?? []) as Partner[];
}

export async function activePartners(): Promise<Partner[]> {
  const { data } = await supabaseAdmin()
    .from("partners")
    .select("*")
    .eq("active", 1)
    .order("company");
  return (data ?? []) as Partner[];
}

export async function partnerById(id: number): Promise<Partner | undefined> {
  const { data } = await supabaseAdmin()
    .from("partners")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data ?? undefined) as Partner | undefined;
}

export async function partnerStats(partnerId: number) {
  const sb = supabaseAdmin();
  const { data: dispatches } = await sb
    .from("dispatches")
    .select("id")
    .eq("partner_id", partnerId);
  const sent = dispatches?.length ?? 0;
  if (!sent) return { sent: 0, won: 0, winRate: 0 };
  const dispatchIds = dispatches!.map((d) => d.id);
  const { data: wonQuotes } = await sb
    .from("quotes")
    .select("id")
    .in("dispatch_id", dispatchIds)
    .eq("status", "won");
  const won = wonQuotes?.length ?? 0;
  return { sent, won, winRate: Math.round((won / sent) * 100) };
}

export type PartnerActivityRow = {
  dispatch_id: number;
  request_id: number;
  request_title: string;
  request_status: string;
  client_name: string;
  order_number: string;
  quantity: number | null;
  sent_at: string | null;
  quote_id: number | null;
  quote_status: string | null;
  price: number | null;
  currency: string | null;
  lead_time_days: number | null;
  valid_until: string | null;
  revision: number | null;
  // feedback
  feedback_id: number | null;
  quality_rating: number | null;
  quantity_rating: number | null;
  satisfaction_rating: number | null;
  timing_rating: number | null;
  feedback_notes: string | null;
};

/** Full quote/response history for a single partner, for the manager's partner detail view. */
export async function partnerActivity(partnerId: number): Promise<{
  rows: PartnerActivityRow[];
  summary: {
    sent: number;
    responded: number;
    won: number;
    lost: number;
    awaiting: number;
    winRate: number;
    committed: Array<{ currency: string; total: number }>;
    avgRating: number | null;
    feedbackCount: number;
  };
}> {
  const sb = supabaseAdmin();

  const empty = {
    rows: [] as PartnerActivityRow[],
    summary: {
      sent: 0, responded: 0, won: 0, lost: 0, awaiting: 0,
      winRate: 0, committed: [] as Array<{ currency: string; total: number }>,
      avgRating: null as number | null, feedbackCount: 0,
    },
  };

  const { data: dispatchRows } = await sb
    .from("dispatches")
    .select("*")
    .eq("partner_id", partnerId)
    .order("sent_at", { ascending: false });
  const dispatches = (dispatchRows ?? []) as Dispatch[];
  if (!dispatches.length) return empty;

  const requestIds = [...new Set(dispatches.map((d) => d.request_id))];
  const { data: requestRows } = await sb
    .from("product_requests")
    .select("id, title, status, order_id, quantity")
    .in("id", requestIds);
  const requestsMap = Object.fromEntries((requestRows ?? []).map((r) => [r.id, r]));

  const orderIds = [...new Set((requestRows ?? []).map((r) => r.order_id as number))];
  const { data: orderRows } = orderIds.length
    ? await sb.from("orders").select("id, client_id, order_number").in("id", orderIds)
    : { data: [] };
  const ordersMap = Object.fromEntries((orderRows ?? []).map((o) => [o.id, o]));

  const clientIds = [...new Set((orderRows ?? []).map((o) => o.client_id as number))];
  const { data: clientRows } = clientIds.length
    ? await sb.from("clients").select("id, name").in("id", clientIds)
    : { data: [] };
  const clientsMap = Object.fromEntries((clientRows ?? []).map((c) => [c.id, c]));

  const dispatchIds = dispatches.map((d) => d.id);
  const { data: quoteRows } = await sb.from("quotes").select("*").in("dispatch_id", dispatchIds);
  const quotesByDispatch = Object.fromEntries(
    ((quoteRows ?? []) as Quote[]).map((q) => [q.dispatch_id, q])
  );

  // Fetch feedback for all dispatches of this partner
  const { data: feedbackRows } = await sb
    .from("partner_feedback")
    .select("*")
    .eq("partner_id", partnerId);
  const feedbackByDispatch = Object.fromEntries(
    ((feedbackRows ?? []) as PartnerFeedback[]).map((f) => [f.dispatch_id, f])
  );

  const rows: PartnerActivityRow[] = dispatches.map((d) => {
    const req = requestsMap[d.request_id] as
      | { id: number; title: string; status: string; order_id: number; quantity: number | null }
      | undefined;
    const order = req ? (ordersMap[req.order_id] as { id: number; client_id: number; order_number: string } | undefined) : undefined;
    const client = order ? (clientsMap[order.client_id] as { id: number; name: string } | undefined) : undefined;
    const q = quotesByDispatch[d.id];
    const fb = feedbackByDispatch[d.id] as PartnerFeedback | undefined;
    return {
      dispatch_id: d.id,
      request_id: d.request_id,
      request_title: req?.title ?? "—",
      request_status: req?.status ?? "—",
      client_name: client?.name ?? "—",
      order_number: order?.order_number ?? "—",
      quantity: req?.quantity ?? null,
      sent_at: d.sent_at,
      quote_id: q?.id ?? null,
      quote_status: q?.status ?? null,
      price: q?.price ?? null,
      currency: q?.currency ?? null,
      lead_time_days: q?.lead_time_days ?? null,
      valid_until: q?.valid_until ?? null,
      revision: q?.revision ?? null,
      feedback_id: fb?.id ?? null,
      quality_rating: fb?.quality_rating ?? null,
      quantity_rating: fb?.quantity_rating ?? null,
      satisfaction_rating: fb?.satisfaction_rating ?? null,
      timing_rating: fb?.timing_rating ?? null,
      feedback_notes: fb?.notes ?? null,
    };
  });

  const sent = rows.length;
  const responded = rows.filter((r) => r.quote_id != null).length;
  const won = rows.filter((r) => r.quote_status === "won").length;
  const lost = rows.filter((r) => r.quote_status === "lost").length;
  const awaiting = sent - responded;

  const committedMap = new Map<string, number>();
  for (const r of rows) {
    if (r.quote_status === "won" && r.price != null) {
      const cur = r.currency ?? "USD";
      committedMap.set(cur, (committedMap.get(cur) ?? 0) + r.price);
    }
  }

  // Compute partner average rating across all 4 dimensions of all feedback
  const feedbackRows2 = rows.filter((r) => r.feedback_id != null);
  const feedbackCount = feedbackRows2.length;
  let avgRating: number | null = null;
  if (feedbackCount > 0) {
    const total = feedbackRows2.reduce((sum, r) => {
      const dims = [r.quality_rating, r.quantity_rating, r.satisfaction_rating, r.timing_rating]
        .filter((v): v is number => v != null);
      return sum + (dims.length > 0 ? dims.reduce((a, b) => a + b, 0) / dims.length : 0);
    }, 0);
    avgRating = Math.round((total / feedbackCount) * 10) / 10;
  }

  return {
    rows,
    summary: {
      sent, responded, won, lost, awaiting,
      winRate: sent ? Math.round((won / sent) * 100) : 0,
      committed: [...committedMap.entries()].map(([currency, total]) => ({ currency, total })),
      avgRating,
      feedbackCount,
    },
  };
}

// ---------- Clients ----------

export async function allClients(): Promise<Client[]> {
  const { data } = await supabaseAdmin()
    .from("clients")
    .select("*")
    .order("name");
  return (data ?? []) as Client[];
}

// ---------- Requests (manager view) ----------

export type RequestRow = ProductRequest & {
  client_name: string;
  order_number: string;
  partner_count: number;
  partner_names: string[];
  quote_count: number;
  best_price: number | null;
  open_questions: number;
};

export async function managerRequests(): Promise<RequestRow[]> {
  const sb = supabaseAdmin();

  const { data: requests } = await sb
    .from("product_requests")
    .select("*")
    .order("id", { ascending: false });
  if (!requests?.length) return [];

  const orderIds = [...new Set(requests.map((r) => r.order_id as number))];
  const { data: orders } = await sb
    .from("orders")
    .select("id, client_id, order_number")
    .in("id", orderIds);
  const ordersMap = Object.fromEntries((orders ?? []).map((o) => [o.id, o]));

  const clientIds = [...new Set((orders ?? []).map((o) => o.client_id as number))];
  const { data: clients } = clientIds.length
    ? await sb.from("clients").select("id, name").in("id", clientIds)
    : { data: [] };
  const clientsMap = Object.fromEntries((clients ?? []).map((c) => [c.id, c]));

  const requestIds = requests.map((r) => r.id as number);
  const { data: dispatches } = await sb
    .from("dispatches")
    .select("id, request_id, partner_id")
    .in("request_id", requestIds);

  const dispatchesByRequest = new Map<number, Array<{ id: number; partner_id: number }>>();
  for (const d of dispatches ?? []) {
    const arr = dispatchesByRequest.get(d.request_id) ?? [];
    arr.push({ id: d.id, partner_id: d.partner_id });
    dispatchesByRequest.set(d.request_id, arr);
  }

  const partnerIds = [...new Set((dispatches ?? []).map((d) => d.partner_id as number))];
  const { data: partners } = partnerIds.length
    ? await sb.from("partners").select("id, company").in("id", partnerIds)
    : { data: [] };
  const partnersMap = Object.fromEntries(
    (partners ?? []).map((p) => [p.id as number, p.company as string])
  );

  const dispatchIds = (dispatches ?? []).map((d) => d.id as number);
  const { data: quotes } = dispatchIds.length
    ? await sb
        .from("quotes")
        .select("dispatch_id, price")
        .in("dispatch_id", dispatchIds)
    : { data: [] };
  const quotesByDispatch = new Map<number, { price: number | null }>();
  for (const q of quotes ?? []) quotesByDispatch.set(q.dispatch_id, q);

  const { data: msgs } = await sb
    .from("messages")
    .select("request_id, author_role")
    .in("request_id", requestIds)
    .eq("author_role", "partner");
  const questionsByRequest = new Map<number, number>();
  for (const m of msgs ?? []) {
    questionsByRequest.set(m.request_id, (questionsByRequest.get(m.request_id) ?? 0) + 1);
  }

  return requests.map((pr) => {
    const order = ordersMap[pr.order_id];
    const client = order ? clientsMap[order.client_id] : undefined;
    const disps = dispatchesByRequest.get(pr.id) ?? [];
    const dispIds = disps.map((d) => d.id);
    const partner_names = disps
      .map((d) => partnersMap[d.partner_id])
      .filter((name): name is string => Boolean(name));
    const prQuotes = dispIds.map((did) => quotesByDispatch.get(did)).filter(Boolean) as Array<{
      price: number | null;
    }>;
    const prices = prQuotes.map((q) => q.price).filter((p): p is number => p != null);
    return {
      ...(pr as ProductRequest),
      client_name: client?.name ?? "—",
      order_number: order?.order_number ?? "",
      partner_count: disps.length,
      partner_names,
      quote_count: prQuotes.length,
      best_price: prices.length ? Math.min(...prices) : null,
      open_questions: questionsByRequest.get(pr.id) ?? 0,
    };
  });
}

export async function requestDetail(id: number) {
  const sb = supabaseAdmin();

  const { data: pr } = await sb
    .from("product_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!pr) return undefined;

  const { data: order } = await sb
    .from("orders")
    .select("*")
    .eq("id", pr.order_id)
    .maybeSingle();
  const { data: client } = order
    ? await sb.from("clients").select("*").eq("id", order.client_id).maybeSingle()
    : { data: null };

  const request = {
    ...(pr as ProductRequest),
    client_name: (client as Client | null)?.name ?? "—",
    client_contact: (client as Client | null)?.contact ?? "",
    order_number: (order as { order_number: string } | null)?.order_number ?? "",
  };

  const { data: dispatchRows } = await sb
    .from("dispatches")
    .select("*")
    .eq("request_id", id);
  const dispatchList = (dispatchRows ?? []) as Array<{
    id: number;
    request_id: number;
    partner_id: number;
    sent_at: string;
  }>;

  const partnerIds = [...new Set(dispatchList.map((d) => d.partner_id))];
  const { data: partnerRows } = partnerIds.length
    ? await sb.from("partners").select("id, company, rating").in("id", partnerIds)
    : { data: [] };
  const partnersMap = Object.fromEntries(
    (partnerRows ?? []).map((p) => [p.id, p])
  );

  const dispatchIds = dispatchList.map((d) => d.id);
  const { data: quoteRows } = dispatchIds.length
    ? await sb.from("quotes").select("*").in("dispatch_id", dispatchIds)
    : { data: [] };
  const quotesMap = Object.fromEntries(
    (quoteRows ?? []).map((q) => [q.dispatch_id, q as Quote])
  );

  const offers = dispatchList
    .map((disp) => {
      const p = partnersMap[disp.partner_id] as { company: string; rating: number } | undefined;
      const q = quotesMap[disp.id];
      return {
        dispatch_id: disp.id,
        partner_id: disp.partner_id,
        company: p?.company ?? "—",
        rating: p?.rating ?? 0,
        quote_id: q?.id ?? null,
        price: q?.price ?? null,
        currency: q?.currency ?? null,
        lead_time_days: q?.lead_time_days ?? null,
        valid_until: q?.valid_until ?? null,
        conditions: q?.conditions ?? null,
        quote_status: q?.status ?? null,
        revision: q?.revision ?? null,
      };
    })
    .sort((a, b) => {
      if (a.price == null) return 1;
      if (b.price == null) return -1;
      return a.price - b.price;
    });

  const { data: msgRows } = await sb
    .from("messages")
    .select("*")
    .eq("request_id", id)
    .order("id");
  const msgPartnerIds = [
    ...new Set(
      (msgRows ?? []).filter((m) => m.partner_id != null).map((m) => m.partner_id as number)
    ),
  ];
  const { data: msgPartnerRows } = msgPartnerIds.length
    ? await sb.from("partners").select("id, company").in("id", msgPartnerIds)
    : { data: [] };
  const msgPartnersMap = Object.fromEntries(
    (msgPartnerRows ?? []).map((p) => [p.id, p])
  );
  const messages = (msgRows ?? []).map((m) => ({
    ...(m as Message),
    company:
      m.partner_id != null
        ? ((msgPartnersMap[m.partner_id] as { company: string } | undefined)?.company ?? null)
        : null,
  }));

  return { request, offers, messages };
}

// ---------- Partner portal view ----------

export type PartnerRequestRow = ProductRequest & {
  dispatch_id: number;
  quote_id: number | null;
  price: number | null;
  currency: string | null;
  quote_status: string | null;
  lead_time_days: number | null;
  valid_until: string | null;
  conditions: string | null;
};

export async function partnerRequests(partnerId: number): Promise<PartnerRequestRow[]> {
  const sb = supabaseAdmin();

  const { data: dispatches } = await sb
    .from("dispatches")
    .select("id, request_id")
    .eq("partner_id", partnerId);
  if (!dispatches?.length) return [];

  const requestIds = dispatches.map((d) => d.request_id as number);
  const { data: requests } = await sb
    .from("product_requests")
    .select("*")
    .in("id", requestIds);

  const dispatchIds = dispatches.map((d) => d.id as number);
  const { data: quotes } = await sb
    .from("quotes")
    .select("id, dispatch_id, price, currency, status, lead_time_days, valid_until, conditions")
    .in("dispatch_id", dispatchIds);

  const quoteByDispatch = Object.fromEntries(
    (quotes ?? []).map((q) => [q.dispatch_id, q])
  );
  const dispatchByRequest = Object.fromEntries(
    dispatches.map((d) => [d.request_id, d])
  );

  return (requests ?? [])
    .map((pr) => {
      const disp = dispatchByRequest[pr.id];
      const q = disp ? quoteByDispatch[disp.id] : undefined;
      return {
        ...(pr as ProductRequest),
        dispatch_id: disp?.id ?? 0,
        quote_id: q?.id ?? null,
        price: q?.price ?? null,
        currency: q?.currency ?? null,
        quote_status: q?.status ?? null,
        lead_time_days: q?.lead_time_days ?? null,
        valid_until: q?.valid_until ?? null,
        conditions: q?.conditions ?? null,
      };
    })
    .filter((r) => r.dispatch_id !== 0)
    .sort((a, b) => b.id - a.id);
}

export async function partnerRequestDetail(partnerId: number, requestId: number) {
  const sb = supabaseAdmin();

  const { data: disp } = await sb
    .from("dispatches")
    .select("*")
    .eq("partner_id", partnerId)
    .eq("request_id", requestId)
    .maybeSingle();
  if (!disp) return undefined;

  const { data: pr } = await sb
    .from("product_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();
  if (!pr) return undefined;

  const row = { ...(pr as ProductRequest), dispatch_id: disp.id as number };

  const { data: quoteRow } = await sb
    .from("quotes")
    .select("*")
    .eq("dispatch_id", disp.id)
    .maybeSingle();
  const quote = (quoteRow ?? undefined) as Quote | undefined;

  const { data: msgRows } = await sb
    .from("messages")
    .select("*")
    .eq("request_id", requestId)
    .or(`partner_id.eq.${partnerId},partner_id.is.null`)
    .order("id");
  const messages = (msgRows ?? []) as Message[];

  return { row, quote, messages };
}

// ---------- Previous quotes by product (manager new-request) ----------

export type PreviousProductQuote = {
  partner_id: number;
  request_id: number;
  request_title: string;
  quantity: number | null;
  price: number;
  currency: string;
  lead_time_days: number | null;
  status: string;
  created_at: string;
  revision: number;
};

/** Last N submitted quotes per partner for a product name (matched via request category). */
export async function recentQuotesForProduct(
  productName: string,
  perPartner = 5
): Promise<PreviousProductQuote[]> {
  const name = productName.trim();
  if (!name) return [];

  const sb = supabaseAdmin();
  const { data: requestRows } = await sb
    .from("product_requests")
    .select("id, title, category, quantity")
    .ilike("category", name);

  const requests = (requestRows ?? []).filter(
    (r) => String(r.category ?? "").trim().toLowerCase() === name.toLowerCase()
  ) as Array<{
    id: number;
    title: string;
    category: string | null;
    quantity: number | null;
  }>;
  if (!requests.length) return [];

  const requestsMap = Object.fromEntries(requests.map((r) => [r.id, r]));
  const requestIds = requests.map((r) => r.id);

  const { data: dispatchRows } = await sb
    .from("dispatches")
    .select("id, request_id, partner_id")
    .in("request_id", requestIds);
  const dispatches = (dispatchRows ?? []) as Array<{
    id: number;
    request_id: number;
    partner_id: number;
  }>;
  if (!dispatches.length) return [];

  const dispatchMap = Object.fromEntries(dispatches.map((d) => [d.id, d]));
  const dispatchIds = dispatches.map((d) => d.id);

  const { data: quoteRows } = await sb
    .from("quotes")
    .select("id, dispatch_id, price, currency, lead_time_days, status, revision, created_at")
    .in("dispatch_id", dispatchIds)
    .not("price", "is", null);

  const quotes = ((quoteRows ?? []) as Array<{
    id: number;
    dispatch_id: number;
    price: number | null;
    currency: string;
    lead_time_days: number | null;
    status: string;
    revision: number;
    created_at: string;
  }>)
    .filter((q) => q.price != null)
    .map((q) => {
      const d = dispatchMap[q.dispatch_id];
      const req = d ? requestsMap[d.request_id] : undefined;
      return {
        partner_id: d?.partner_id ?? 0,
        request_id: d?.request_id ?? 0,
        request_title: req?.title ?? "—",
        quantity: req?.quantity ?? null,
        price: q.price as number,
        currency: q.currency || "USD",
        lead_time_days: q.lead_time_days,
        status: q.status,
        created_at: q.created_at,
        revision: q.revision,
      } satisfies PreviousProductQuote;
    })
    .filter((q) => q.partner_id > 0)
    .sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    });

  const counts = new Map<number, number>();
  const limited: PreviousProductQuote[] = [];
  for (const q of quotes) {
    const n = counts.get(q.partner_id) ?? 0;
    if (n >= perPartner) continue;
    counts.set(q.partner_id, n + 1);
    limited.push(q);
  }
  return limited;
}
