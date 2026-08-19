import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MonitorSite {
  id: string;
  url: string;
  display_name: string | null;
  created_at: string;
}

export interface MonitorReport {
  id: string;
  site_id: string;
  site: string;
  checked_at: string;
  avail_ok: boolean | null;
  avail_status_code: number | null;
  avail_response_time_ms: number | null;
  avail_error: string | null;
  avail_final_url: string | null;
  dns_ok: boolean | null;
  dns_current_nameservers: string[] | null;
  dns_expected: string[] | null;
  dns_error: string | null;
  ssl_ok: boolean | null;
  ssl_issuer: string | null;
  ssl_expires: string | null;
  ssl_days_remaining: number | null;
  ssl_error: string | null;
  content_ok: boolean | null;
  content_hash: string | null;
  content_hash_changed: boolean | null;
  content_flagged_keywords: string[] | null;
  content_error: string | null;
  overall_ok: boolean | null;
  created_at: string;
  // from monitor_latest view
  display_name?: string | null;
  site_url?: string | null;
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

/** Fetch the latest report for every site (uses monitor_latest view). */
export async function fetchAllSitesLatest(): Promise<MonitorReport[]> {
  const { data, error } = await supabase
    .from("monitor_latest")
    .select("*")
    .order("checked_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as MonitorReport[];
}

/** Fetch all sites from the registry. */
export async function fetchSites(): Promise<MonitorSite[]> {
  const { data, error } = await supabase
    .from("monitor_sites")
    .select("*")
    .order("display_name");

  if (error) throw error;
  return (data ?? []) as MonitorSite[];
}

/** Fetch the single latest report for a site. */
export async function fetchLatestReport(siteId: string): Promise<MonitorReport | null> {
  const { data, error } = await supabase
    .from("monitor_reports")
    .select("*")
    .eq("site_id", siteId)
    .order("checked_at", { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return (data ?? null) as MonitorReport | null;
}

/** Fetch last N reports for a site (for charts and timeline). */
export async function fetchReports(
  siteId: string,
  limit = 50
): Promise<MonitorReport[]> {
  const { data, error } = await supabase
    .from("monitor_reports")
    .select("*")
    .eq("site_id", siteId)
    .order("checked_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as MonitorReport[];
}

/** Fetch reports that had at least one failure (alert feed). */
export async function fetchAlerts(
  siteId: string,
  limit = 100
): Promise<MonitorReport[]> {
  const { data, error } = await supabase
    .from("monitor_reports")
    .select("*")
    .eq("site_id", siteId)
    .eq("overall_ok", false)
    .order("checked_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as MonitorReport[];
}

/** Calculate uptime % for a given number of days. */
export function calcUptime(reports: MonitorReport[], days: number): number {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const inWindow = reports.filter(
    (r) => new Date(r.checked_at) >= since
  );
  if (inWindow.length === 0) return 100;
  const ok = inWindow.filter((r) => r.overall_ok !== false).length;
  return Math.round((ok / inWindow.length) * 1000) / 10;
}

/** Derive the human-readable anomalies for a report. */
export function getAnomalies(report: MonitorReport): string[] {
  const issues: string[] = [];
  if (!report.avail_ok)
    issues.push(
      `Down — HTTP ${report.avail_status_code ?? "error"} (${report.avail_error ?? ""})`
    );
  if (report.dns_ok === false)
    issues.push(
      `DNS mismatch — got [${(report.dns_current_nameservers ?? []).join(", ")}]`
    );
  if (report.ssl_ok === false)
    issues.push(
      `SSL issue — ${report.ssl_error ?? "expired/invalid"}`
    );
  if ((report.content_flagged_keywords?.length ?? 0) > 0)
    issues.push(
      `Blacklisted keywords: ${report.content_flagged_keywords!.join(", ")}`
    );
  if (report.content_hash_changed)
    issues.push("Content hash changed since baseline");
  return issues;
}
