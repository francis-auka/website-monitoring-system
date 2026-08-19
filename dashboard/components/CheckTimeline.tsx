"use client";

import { format } from "date-fns";
import type { MonitorReport } from "@/lib/supabase";

interface Props {
  reports: MonitorReport[];
}

function BoolCell({ val, trueLabel = "OK", falseLabel = "FAIL" }: { val: boolean | null; trueLabel?: string; falseLabel?: string }) {
  if (val === null || val === undefined) {
    return <span style={{ color: "var(--muted)", fontSize: "0.75rem" }}>—</span>;
  }
  return (
    <span
      style={{
        fontSize: "0.7rem",
        fontWeight: 700,
        color: val ? "var(--sky-primary)" : "#ffffff",
        background: val ? "var(--sky-light)" : "var(--sky-dark)",
        border: `1px solid ${val ? "var(--sky-border)" : "var(--sky-dark)"}`,
        borderRadius: 0,
        padding: "0.15rem 0.5rem",
        display: "inline-block",
        letterSpacing: "0.03em",
      }}
    >
      {val ? trueLabel : falseLabel}
    </span>
  );
}

export default function CheckTimeline({ reports }: Props) {
  if (reports.length === 0) {
    return (
      <div style={{ color: "var(--muted)", padding: "2rem", textAlign: "center", fontSize: "0.875rem" }}>
        No history yet.
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <div className="timeline-row timeline-header" style={{ marginBottom: "0.25rem" }}>
        <span>Time (UTC)</span>
        <span>Status</span>
        <span className="col-hide">Response</span>
        <span className="col-hide">SSL</span>
        <span className="col-hide">DNS</span>
      </div>
      {reports.map((r) => (
        <div key={r.id} className="timeline-row">
          <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontFamily: "JetBrains Mono, monospace" }}>
            {format(new Date(r.checked_at), "MMM d HH:mm")}
          </span>
          <BoolCell val={r.overall_ok} trueLabel="UP" falseLabel="DOWN" />
          <span className="col-hide" style={{ fontSize: "0.8125rem", color: r.avail_response_time_ms == null ? "var(--muted)" : (r.avail_response_time_ms > 1500 ? "var(--sky-dark)" : "var(--text)"), fontWeight: 600 }}>
            {r.avail_response_time_ms != null ? `${r.avail_response_time_ms.toFixed(0)} ms` : "—"}
          </span>
          <span className="col-hide">
            <BoolCell val={r.ssl_ok} />
          </span>
          <span className="col-hide">
            <BoolCell val={r.dns_ok} />
          </span>
        </div>
      ))}
    </div>
  );
}
