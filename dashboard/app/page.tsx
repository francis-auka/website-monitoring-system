import { fetchAllSitesLatest } from "@/lib/supabase";
import SiteCard from "@/components/SiteCard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "All Sites — Site Monitor",
  description: "Overview of all monitored websites — real-time availability, SSL, and DNS status.",
};

export const revalidate = 300;

export default async function HomePage() {
  const reports = await fetchAllSitesLatest().catch(() => []);

  const total = reports.length;
  const down = reports.filter((r) => r.overall_ok === false).length;
  const warn = reports.filter(
    (r) => r.overall_ok !== false && (r.ssl_days_remaining ?? 999) < 14
  ).length;
  const ok = total - down - warn;

  return (
    <div className="page-wrapper" style={{ paddingTop: "2.5rem" }}>
      {/* Header */}
      <div style={{ marginBottom: "2.5rem" }}>
        <h1>
          Site <span className="sky-text">Monitor</span>
        </h1>
        <p style={{ color: "var(--muted)", marginTop: "0.5rem", fontSize: "0.9375rem", fontWeight: 500 }}>
          Real-time health dashboard — checks run every 2 hours.
        </p>
      </div>

      {/* Summary bar */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "1rem",
          marginBottom: "2.5rem",
        }}
      >
        <SummaryTile value={ok} label="Online" color="var(--sky-primary)" />
        <SummaryTile value={warn} label="Warning" color="var(--sky-bright)" />
        <SummaryTile value={down} label="Down" color="var(--sky-dark)" />
      </div>

      {/* Site grid */}
      {reports.length === 0 ? (
        <EmptyState />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: "1.25rem",
          }}
        >
          {reports.map((report) => (
            <SiteCard key={report.site_id} report={report} />
          ))}
        </div>
      )}

      <p style={{ marginTop: "3rem", fontSize: "0.75rem", color: "var(--subtle)", textAlign: "center", fontWeight: 500 }}>
        Page refreshes every 5 minutes · Powered by Supabase + Next.js
      </p>
    </div>
  );
}

function SummaryTile({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color: string;
}) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: `1px solid var(--border)`,
        borderTop: `4px solid ${color}`,
        borderRadius: 0,
        padding: "1.25rem",
        textAlign: "center",
      }}
    >
      <p style={{ fontSize: "2.25rem", fontWeight: 800, color }}>{value}</p>
      <p style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: "0.25rem", fontWeight: 600 }}>
        {label}
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "5rem 2rem",
        color: "var(--muted)",
        background: "#ffffff",
        border: "1px solid var(--border)",
        borderRadius: 0,
      }}
    >
      <p style={{ fontSize: "3rem", marginBottom: "1rem", color: "var(--sky-primary)" }}>📡</p>
      <h2 style={{ color: "var(--text)", marginBottom: "0.5rem" }}>No data yet</h2>
      <p style={{ fontSize: "0.875rem", maxWidth: "420px", margin: "0 auto", lineHeight: 1.6 }}>
        Run <code style={{ color: "var(--sky-primary)", background: "var(--sky-light)", padding: "0.2em 0.5em", borderRadius: 0, border: "1px solid var(--sky-border)", fontWeight: 600 }}>python monitor.py --once</code> to generate your first report,
        then set your Supabase credentials in <code style={{ color: "var(--sky-primary)", background: "var(--sky-light)", padding: "0.2em 0.5em", borderRadius: 0, border: "1px solid var(--sky-border)", fontWeight: 600 }}>.env</code>.
      </p>
    </div>
  );
}
