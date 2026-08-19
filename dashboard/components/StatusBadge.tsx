"use client";

import type { MonitorReport } from "@/lib/supabase";

interface Props {
  report: MonitorReport | null;
  size?: "sm" | "md" | "lg";
}

export default function StatusBadge({ report, size = "md" }: Props) {
  if (!report) {
    return <span className="badge badge-muted">No data</span>;
  }

  if (report.overall_ok === false) {
    return (
      <span className="badge badge-red">
        <span className="dot dot-red" />
        DOWN
      </span>
    );
  }

  // Degraded: site is up but something is off (e.g. DNS null, SSL expiring soon)
  const sslWarn = (report.ssl_days_remaining ?? 999) < 14;
  const dnsNull = report.dns_ok === null;

  if (sslWarn || dnsNull) {
    return (
      <span className="badge badge-yellow">
        <span className="dot dot-yellow dot-pulse" />
        WARNING
      </span>
    );
  }

  return (
    <span className="badge badge-green">
      <span className="dot dot-green dot-pulse" />
      ONLINE
    </span>
  );
}

/** Returns a Tailwind-free CSS color for overall status. */
export function statusColor(report: MonitorReport | null): string {
  if (!report) return "var(--muted)";
  if (report.overall_ok === false) return "var(--red)";
  if ((report.ssl_days_remaining ?? 999) < 14) return "var(--yellow)";
  return "var(--green)";
}
