"use client";

import { format } from "date-fns";
import type { MonitorReport } from "@/lib/supabase";
import { getAnomalies } from "@/lib/supabase";

interface Props {
  alerts: MonitorReport[];
}

const iconFor = (report: MonitorReport) => {
  if (!report.avail_ok) return "🔴";
  if (report.dns_ok === false) return "🌐";
  if (report.ssl_ok === false) return "🔒";
  if ((report.content_flagged_keywords?.length ?? 0) > 0) return "⚠️";
  if (report.content_hash_changed) return "📄";
  return "⚠️";
};

export default function AlertFeed({ alerts }: Props) {
  if (alerts.length === 0) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "2.5rem 1rem",
          color: "var(--muted)",
          fontSize: "0.875rem",
        }}
      >
        <p style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>✅</p>
        No anomalies recorded — everything looks clean.
      </div>
    );
  }

  return (
    <div>
      {alerts.map((alert) => {
        const anomalies = getAnomalies(alert);
        return (
          <div key={alert.id} className="alert-item">
            <span style={{ fontSize: "1.25rem", flexShrink: 0, lineHeight: 1.4 }}>
              {iconFor(alert)}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", flexWrap: "wrap" }}>
                <span
                  style={{
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    color: "var(--text)",
                  }}
                >
                  {format(new Date(alert.checked_at), "MMM d, yyyy · HH:mm")} UTC
                </span>
              </div>
              <ul style={{ marginTop: "0.375rem", listStyle: "none", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                {anomalies.map((issue, i) => (
                  <li
                    key={i}
                    style={{
                      fontSize: "0.8rem",
                      color: "var(--muted)",
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      borderRadius: "0.375rem",
                      padding: "0.25rem 0.625rem",
                      display: "inline-block",
                    }}
                  >
                    {issue}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );
      })}
    </div>
  );
}
