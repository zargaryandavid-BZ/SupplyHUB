import { STATUS_LABELS } from "@/lib/types";

export function Badge({ status }: { status: string }) {
  const label = STATUS_LABELS[status] || status;
  return <span className={`badge ${status}`}>{label}</span>;
}
