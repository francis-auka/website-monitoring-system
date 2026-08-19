"use client";

import type { MonitorReport } from "@/lib/supabase";
import { calcUptime } from "@/lib/supabase";

interface Props {
  reports: MonitorReport[];
}

function UptimePill({ pct }: { pct: number }) {
  const color =
    pct >= 99 ? "var(--sky-primary)" : pct >= 95 ? "var(--sky-bright)" : "var(--sky-dark)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <p style={{ fontSize: "2.25rem", fontWeight: 800, color, letterSpacing: "-0.04em" }}>
        {pct.toFixed(1)}
        <span style={{ fontSize: "1rem", fontWeight: 600, marginLeft: "0.2rem" }}>%</span>
      </p>
      <div className="uptime-bar" style={{ borderRadius: 0 }}>
        <div className="uptime-fill" style={{ width: `${pct}%`, background: color, borderRadius: 0 }} />
      </div>
    </div>
  );
}

export default function UptimeStat({ reports }: Props) {
  const u7 = calcUptime(reports, 7);
  const u30 = calcUptime(reports, 30);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
      <div className="stat-tile" style={{ borderRadius: 0 }}>
        <p className="label">7-day uptime</p>
        <UptimePill pct={u7} />
        <p style={{ fontSize: "0.7rem", color: "var(--muted)", marginTop: "0.25rem", fontWeight: 500 }}>
          {reports.filter((r) => {
            const d = new Date(r.checked_at);
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - 7);
            return d >= cutoff;
          }).length}{" "}
          checks
        </p>
      </div>
      <div className="stat-tile" style={{ borderRadius: 0 }}>
        <p className="label">30-day uptime</p>
        <UptimePill pct={u30} />
        <p style={{ fontSize: "0.7rem", color: "var(--muted)", marginTop: "0.25rem", fontWeight: 500 }}>
          {reports.filter((r) => {
            const d = new Date(r.checked_at);
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - 30);
            return d >= cutoff;
          }).length}{" "}
          checks
        </p>
      </div>
    </div>
  );
}
