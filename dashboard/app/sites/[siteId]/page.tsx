import { fetchLatestReport, fetchReports, fetchAlerts } from "@/lib/supabase";
import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import type { Metadata } from "next";
import StatusBadge from "@/components/StatusBadge";
import ResponseTimeChart from "@/components/ResponseTimeChart";
import UptimeStat from "@/components/UptimeStat";
import AlertFeed from "@/components/AlertFeed";
import CheckTimeline from "@/components/CheckTimeline";

interface PageProps {
  params: Promise<{ siteId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { siteId } = await params;
  return {
    title: `${siteId} — Site Monitor`,
    description: `Detailed monitoring history, uptime, and alert feed for ${siteId}.`,
  };
}

export const revalidate = 120;

export default async function SiteDetailPage({ params }: PageProps) {
  const { siteId } = await params;

  const [latest, reports, alerts] = await Promise.all([
    fetchLatestReport(siteId).catch(() => null),
    fetchReports(siteId, 100).catch(() => []),
    fetchAlerts(siteId, 50).catch(() => []),
  ]);

  if (!latest && reports.length === 0) notFound();

  const displayName = siteId;
  const siteUrl = latest?.site ?? "";

  return (
    <div className="page-wrapper" style={{ paddingTop: "2rem" }}>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem" }}>
        <Link href="/" style={{ color: "var(--sky-primary)", fontSize: "0.875rem", textDecoration: "none", fontWeight: 600 }}>
          ← All Sites
        </Link>
        <span style={{ color: "var(--subtle)" }}>/</span>
        <span style={{ fontSize: "0.875rem", color: "var(--text)", fontWeight: 600 }}>{displayName}</span>
      </div>

      {/* Page header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "1rem",
          marginBottom: "2rem",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1 }}>
          <h1 style={{ textTransform: "capitalize" }}>{displayName.replace(/_/g, " ")}</h1>
          <a
            href={siteUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: "0.875rem", color: "var(--sky-primary)", textDecoration: "none", fontWeight: 500 }}
          >
            {siteUrl} ↗
          </a>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.5rem" }}>
          <StatusBadge report={latest} />
          {latest && (
            <span style={{ fontSize: "0.7rem", color: "var(--muted)", fontWeight: 500 }}>
              Last check: {format(new Date(latest.checked_at), "MMM d, yyyy HH:mm")} UTC
            </span>
          )}
        </div>
      </div>

      {/* Latest check details */}
      {latest && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            gap: "1rem",
            marginBottom: "2rem",
          }}
        >
          <DetailTile label="HTTP Status" value={latest.avail_status_code?.toString() ?? "—"} ok={latest.avail_ok} />
          <DetailTile label="Response Time" value={latest.avail_response_time_ms != null ? `${latest.avail_response_time_ms.toFixed(0)} ms` : "—"} ok={latest.avail_ok} />
          <DetailTile label="SSL Issuer" value={latest.ssl_issuer ?? "—"} ok={latest.ssl_ok} />
          <DetailTile label="SSL Expires" value={latest.ssl_expires ?? "—"} ok={latest.ssl_ok} />
          <DetailTile label="SSL Days Left" value={latest.ssl_days_remaining?.toString() ?? "—"} ok={(latest.ssl_days_remaining ?? 0) > 14} />
          <DetailTile label="DNS" value={latest.dns_ok === true ? "Match" : latest.dns_ok === false ? "Mismatch" : "Unchecked"} ok={latest.dns_ok} />
          <DetailTile label="Content" value={latest.content_ok === false ? "Issue" : "Clean"} ok={latest.content_ok} />
          <DetailTile label="Keywords" value={(latest.content_flagged_keywords?.length ?? 0) === 0 ? "None" : latest.content_flagged_keywords!.join(", ")} ok={(latest.content_flagged_keywords?.length ?? 0) === 0} />
        </div>
      )}

      {/* Uptime */}
      <Section title="Uptime">
        <UptimeStat reports={reports} />
      </Section>

      {/* Response Time Chart */}
      <Section title="Response Time">
        <ResponseTimeChart reports={reports} />
      </Section>

      {/* Alert Feed */}
      <Section
        title={`Alert History`}
        badge={alerts.length > 0 ? `${alerts.length} events` : undefined}
      >
        <AlertFeed alerts={alerts} />
      </Section>

      {/* Check Timeline */}
      <Section title="Check History" badge={`Last ${reports.length} runs`}>
        <CheckTimeline reports={reports} />
      </Section>
    </div>
  );
}

function DetailTile({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok: boolean | null | undefined;
}) {
  const color =
    ok === true ? "var(--sky-primary)" : ok === false ? "var(--sky-dark)" : "var(--text)";
  return (
    <div className="stat-tile" style={{ borderRadius: 0 }}>
      <p className="label">{label}</p>
      <p style={{ fontSize: "1rem", fontWeight: 800, color, wordBreak: "break-all", marginTop: "0.3rem" }}>
        {value}
      </p>
    </div>
  );
}

function Section({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card" style={{ marginBottom: "1.25rem", borderRadius: 0 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          marginBottom: "1.25rem",
        }}
      >
        <h2>{title}</h2>
        {badge && (
          <span className="badge badge-muted" style={{ borderRadius: 0 }}>{badge}</span>
        )}
      </div>
      {children}
    </div>
  );
}
