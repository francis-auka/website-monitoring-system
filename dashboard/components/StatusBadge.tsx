"use client";

import type { MonitorReport } from "@/lib/supabase";

interface Props {
  report: MonitorReport | null;
  size?: "sm" | "md" | "lg";
}

export default function StatusBadge({ report }: Props) {
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

export function statusColor(report: MonitorReport | null): string {
  if (!report) return "var(--muted)";
  if (report.overall_ok === false) return "var(--sky-dark)";
  if ((report.ssl_days_remaining ?? 999) < 14) return "var(--sky-bright)";
  return "var(--sky-primary)";
}
