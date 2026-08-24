export type PartnerProduct = {
  name: string;
  notes?: string;               // short info / spec note for this product
  moq: number | null;           // minimum order quantity
  delivery_days: number | null; // typical delivery time in days
  price: number | null;         // unit / base price
  currency: string;             // e.g. USD
  images?: string[];            // up to 3 image URLs for this product
};

export type Partner = {
  id: number;
  company: string;
  contact: string | null;
  email: string | null;
  phone: string | null;
  categories: string | null;
  rating: number;
  active: number;
  location: string | null;
  preferred_channels: string | null; // comma list: email,sms,whatsapp,phone
  avg_delivery_days: number | null;
  website: string | null;
  ein: string | null;            // Employer Identification Number
  logo_path: string | null;
  bank_name: string | null;
  // SENSITIVE — store as-is locally; encrypt before Supabase migration
  bank_account: string | null;
  swift: string | null;          // bank SWIFT / BIC code
  payment_terms: string | null;  // e.g. "Net 30", "Prepaid", "Due on receipt"
  portal_contact_name: string | null;
  portal_email: string | null;
  products?: PartnerProduct[];  // products this partner offers, with MOQ / delivery / price
  created_at: string | null;
  portal_token: string | null;
  internal_notes: string | null;  // manager-only notes, never shown to partners
};

export type PartnerContact = {
  id: number;
  partner_id: number;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  is_primary: boolean;
  created_at: string;
};

export type Employee = {
  id: string;           // uuid
  name: string;
  email: string;
  phone: string | null;
  position: string | null;
  is_active: boolean;
  created_at: string;
};

export type Client = {
  id: number;
  name: string;
  contact: string | null;
  email: string | null;
  phone: string | null;
};

export type ProductRequest = {
  id: number;
  order_id: number;
  title: string;
  category: string | null;
  specs: string | null;
  quantity: number | null;
  needed_by: string | null;
  hide_client: number;
  status: string;
  created_at: string;
  // Structured product details
  standard_size: string | null;
  width: number | null;
  height: number | null;
  depth: number | null;          // Z dimension (for boxes)
  size_unit: string | null;
  material: string | null;
  finishing: string | null;      // comma-separated list of finishing options
  attachments: string | null;    // JSON array of /uploads/... paths
  sku_count: number | null;      // number of SKUs / variants in this order
  sku_items: string | null;      // JSON array of {sku: string, qty: number}
};

export type Quote = {
  id: number;
  dispatch_id: number;
  price: number | null;
  currency: string;
  lead_time_days: number | null;
  valid_until: string | null;
  conditions: string | null;
  status: string;
  revision: number;
  created_at: string;
};

export type PartnerFeedback = {
  id: number;
  dispatch_id: number;
  partner_id: number;
  request_id: number;
  quality_rating: number | null;       // 1-5
  quantity_rating: number | null;      // 1-5
  satisfaction_rating: number | null;  // 1-5
  timing_rating: number | null;        // 1-5
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: number;
  request_id: number;
  partner_id: number | null;
  author_role: string;
  text: string;
  created_at: string;
};

export type Order = {
  id: number;
  client_id: number;
  order_number: string;
  notes: string | null;
  created_at: string;
};

export type Dispatch = {
  id: number;
  request_id: number;
  partner_id: number;
  sent_at: string;
  seen_at: string | null;
};

export type CompanySettings = {
  id: number;
  company_name: string | null;
  logo_path: string | null;
  hq_address: string | null;
  branches: string | null;       // newline-separated branch addresses
  ci_number: string | null;
  ein: string | null;
  bank_name: string | null;
  bank_account: string | null;
  swift: string | null;
  payment_terms: string | null;
  manager_name: string | null;
  manager_phone: string | null;
  manager_email: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  /** SMS when a new request is sent to partners. Placeholders: {{company_name}}, {{title}}, {{quantity}}, {{needed_by}}, {{link}}, {{partner_name}} */
  sms_new_request_template: string | null;
  /** SMS when a partner wins. Placeholders: {{company_name}}, {{partner_name}}, {{title}}, {{quantity}}, {{price}}, {{currency}}, {{lead_time_days}}, {{needed_by}}, {{link}} */
  sms_won_template: string | null;
  /** SMS when a request is updated. Placeholders: {{company_name}}, {{title}}, {{quantity}}, {{needed_by}}, {{link}}, {{partner_name}} */
  sms_update_template: string | null;
  /** SMS portal invite sent to partner. Placeholders: {{company_name}}, {{partner_name}}, {{link}} */
  sms_invite_template: string | null;
  /** SMS to manager when a client approves/declines a proposal. Placeholders: {{company_name}}, {{manager_name}}, {{client_name}}, {{title}}, {{action}}, {{option_label}}, {{price}}, {{currency}}, {{price_line}}, {{link}} */
  sms_client_response_template: string | null;
  /** Notify manager when a partner submits a quote */
  notify_on_quote: boolean | null;
  /** Notify manager when a partner sends a question/comment */
  notify_on_message: boolean | null;
  /** Notification channels: comma list of "email", "sms" */
  notify_channels: string | null;
  updated_at: string | null;
};

export const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  quoting: "Quoting",
  clarifying: "Clarifying",
  awarded: "Awarded",
  closed: "Closed",
};

export const STATUS_ORDER = ["draft", "sent", "quoting", "clarifying", "awarded", "closed"];
