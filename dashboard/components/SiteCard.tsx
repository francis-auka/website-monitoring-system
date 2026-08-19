"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import type { MonitorReport } from "@/lib/supabase";
import StatusBadge, { statusColor } from "@/components/StatusBadge";

interface Props {
  report: MonitorReport;
}

export default function SiteCard({ report }: Props) {
  const siteId = report.site_id;
  const name = report.display_name ?? siteId;
  const url = report.site;
  const lastChecked = formatDistanceToNow(new Date(report.checked_at), { addSuffix: true });
  const color = statusColor(report);
  const rt = report.avail_response_time_ms;

  return (
    <Link href={`/sites/${siteId}`} className="site-card-link">
      <div
        className="card"
        style={{
          borderLeft: `3px solid ${color}`,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* subtle glow behind the border */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            left: 0,
            width: "60%",
            background: `radial-gradient(ellipse at left, ${color}08 0%, transparent 70%)`,
            pointerEvents: "none",
          }}
        />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</h2>
            <span style={{ fontSize: "0.75rem", color: "var(--muted)", wordBreak: "break-all" }}>{url}</span>
          </div>
          <StatusBadge report={report} />
        </div>

        {/* Stats row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "0.75rem",
            marginTop: "1.25rem",
          }}
        >
          <Tile
            label="Response"
            value={rt != null ? `${rt.toFixed(0)} ms` : "—"}
            color={rt == null ? undefined : rt < 500 ? "var(--green)" : rt < 1500 ? "var(--yellow)" : "var(--red)"}
          />
          <Tile
            label="SSL"
            value={report.ssl_days_remaining != null ? `${report.ssl_days_remaining}d` : "—"}
            color={
              report.ssl_days_remaining == null
                ? undefined
                : report.ssl_days_remaining > 30
                ? "var(--green)"
                : report.ssl_days_remaining > 7
                ? "var(--yellow)"
                : "var(--red)"
            }
          />
          <Tile
            label="DNS"
            value={report.dns_ok === true ? "OK" : report.dns_ok === false ? "MISMATCH" : "—"}
            color={report.dns_ok === true ? "var(--green)" : report.dns_ok === false ? "var(--red)" : undefined}
          />
        </div>

        <p style={{ fontSize: "0.7rem", color: "var(--subtle)", marginTop: "1rem" }}>
          Checked {lastChecked}
        </p>
      </div>
    </Link>
  );
}

function Tile({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "0.5rem", padding: "0.625rem 0.75rem" }}>
      <p style={{ fontSize: "0.65rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500 }}>{label}</p>
      <p style={{ fontSize: "1rem", fontWeight: 700, color: color ?? "var(--text)", marginTop: "0.2rem" }}>{value}</p>
    </div>
  );
}
