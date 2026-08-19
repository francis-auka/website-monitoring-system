import { fetchAllSitesLatest } from "@/lib/supabase";
import SiteCard from "@/components/SiteCard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "All Sites — Site Monitor",
  description: "Overview of all monitored websites — real-time availability, SSL, and DNS status.",
};

// Revalidate every 5 minutes so the home page always shows fresh data
export const revalidate = 300;

export default async function HomePage() {
  let reports = await fetchAllSitesLatest().catch(() => []);

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
          <span className="gradient-text">Site Monitor</span>
        </h1>
        <p style={{ color: "var(--muted)", marginTop: "0.5rem", fontSize: "0.9375rem" }}>
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
        <SummaryTile value={ok} label="Online" color="var(--green)" />
        <SummaryTile value={warn} label="Warning" color="var(--yellow)" />
        <SummaryTile value={down} label="Down" color="var(--red)" />
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

      <p style={{ marginTop: "3rem", fontSize: "0.75rem", color: "var(--subtle)", textAlign: "center" }}>
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
        background: "var(--surface)",
        border: `1px solid var(--border)`,
        borderTop: `3px solid ${color}`,
        borderRadius: "0.75rem",
        padding: "1.25rem",
        textAlign: "center",
      }}
    >
      <p style={{ fontSize: "2rem", fontWeight: 800, color }}>{value}</p>
      <p style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: "0.25rem" }}>
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
      }}
    >
      <p style={{ fontSize: "3rem", marginBottom: "1rem" }}>📡</p>
      <h2 style={{ color: "var(--text)", marginBottom: "0.5rem" }}>No data yet</h2>
      <p style={{ fontSize: "0.875rem", maxWidth: "380px", margin: "0 auto", lineHeight: 1.6 }}>
        Run <code style={{ color: "var(--accent)", background: "var(--surface-2)", padding: "0.1em 0.4em", borderRadius: "4px" }}>python monitor.py --once</code> to generate your first report,
        then make sure your Supabase credentials are set in <code style={{ color: "var(--accent)", background: "var(--surface-2)", padding: "0.1em 0.4em", borderRadius: "4px" }}>.env</code>.
      </p>
    </div>
  );
}
