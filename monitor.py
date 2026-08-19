#!/usr/bin/env python3
"""
Website Monitor
================
Monitors one or more websites for:
  1. Availability (HTTP status + response time)
  2. DNS / nameserver integrity (catches hijacks like the one that hit
     sportykenya.co.ke, where nameservers were silently repointed)
  3. SSL certificate validity
  4. Content changes (hash comparison) and blacklisted keyword injection

Each run writes a local JSON report to reports/ AND pushes the report
to a Supabase table (monitor_reports) so the Next.js dashboard can read
it from anywhere.

Supabase credentials are read from a .env file next to this script:
    SUPABASE_URL=https://your-project.supabase.co
    SUPABASE_ANON_KEY=your-anon-key

Runs every 2 hours either as a long-lived process (--loop) or as a
single check (--once, meant to be triggered by cron / Task Scheduler).

Config lives in config.json next to this script. Supports multiple sites
via the "sites" array.

Usage:
    python monitor.py --once          # single check, good for cron
    python monitor.py --loop          # runs forever, checks every 2h
    python monitor.py --once --baseline   # (re)generates the DNS/content
                                            baseline instead of checking
"""

import argparse
import hashlib
import json
import os
import smtplib
import socket
import ssl
import sys
import time
from datetime import datetime, timezone
from email.mime.text import MIMEText
from urllib.parse import urlparse

import requests

try:
    from dotenv import load_dotenv
    load_dotenv()
    DOTENV_AVAILABLE = True
except ImportError:
    DOTENV_AVAILABLE = False

try:
    from supabase import create_client, Client as SupabaseClient
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False

try:
    import dns.resolver  # dnspython
    DNS_AVAILABLE = True
except ImportError:
    DNS_AVAILABLE = False

try:
    import africastalking
    AT_AVAILABLE = True
except ImportError:
    AT_AVAILABLE = False

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(BASE_DIR, "config.json")
REPORTS_DIR = os.path.join(BASE_DIR, "reports")
BASELINE_PATH = os.path.join(BASE_DIR, "baseline.json")
LOG_PATH = os.path.join(BASE_DIR, "monitor.log")

CHECK_INTERVAL_SECONDS = 2 * 60 * 60  # 2 hours

# --------------------------------------------------------------------------
# Supabase client (lazy-initialised once)
# --------------------------------------------------------------------------

_supabase_client: "SupabaseClient | None" = None


def get_supabase() -> "SupabaseClient | None":
    """Return a cached Supabase client, or None if not configured."""
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client
    if not SUPABASE_AVAILABLE:
        return None
    url = os.getenv("SUPABASE_URL", "").strip()
    key = os.getenv("SUPABASE_ANON_KEY", "").strip()
    if not url or not key or url.startswith("https://your-project"):
        return None
    try:
        _supabase_client = create_client(url, key)
        return _supabase_client
    except Exception as exc:
        log(f"Supabase init failed: {exc}")
        return None


def push_to_supabase(report: dict, site_id: str) -> bool:
    """
    Push a monitor report dict to the monitor_reports Supabase table.
    Returns True on success, False on failure (local JSON is the backup).
    The report dict uses the nested JSON structure from run_check(); this
    function flattens it into the column schema.
    """
    client = get_supabase()
    if client is None:
        return False

    avail = report.get("availability", {})
    dns   = report.get("dns", {})
    ssl_r = report.get("ssl", {})
    cont  = report.get("content", {})

    row = {
        "site_id":    site_id,
        "site":       report["site"],
        "checked_at": report["timestamp"],

        # availability
        "avail_ok":               avail.get("ok"),
        "avail_status_code":      avail.get("status_code"),
        "avail_response_time_ms": avail.get("response_time_ms"),
        "avail_error":            avail.get("error"),
        "avail_final_url":        avail.get("final_url"),

        # dns
        "dns_ok":                   dns.get("ok"),
        "dns_current_nameservers":  dns.get("current_nameservers"),
        "dns_expected":             dns.get("expected"),
        "dns_error":                dns.get("error"),

        # ssl
        "ssl_ok":            ssl_r.get("ok"),
        "ssl_issuer":        ssl_r.get("issuer"),
        "ssl_expires":       ssl_r.get("expires"),
        "ssl_days_remaining": ssl_r.get("days_remaining"),
        "ssl_error":         ssl_r.get("error"),

        # content
        "content_ok":               cont.get("ok"),
        "content_hash":             cont.get("content_hash"),
        "content_hash_changed":     cont.get("hash_changed"),
        "content_flagged_keywords": cont.get("flagged_keywords"),
        "content_error":            cont.get("error"),
    }

    try:
        # upsert so re-running with --once doesn't create duplicate rows
        client.table("monitor_reports").upsert(
            row, on_conflict="site_id,checked_at"
        ).execute()
        log(f"[Supabase] Report pushed for {site_id}.")
        return True
    except Exception as exc:
        log(f"[Supabase] Push failed for {site_id}: {exc}")
        return False


# --------------------------------------------------------------------------
# Utilities
# --------------------------------------------------------------------------

def log(msg: str):
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    line = f"[{ts}] {msg}"
    print(line)
    with open(LOG_PATH, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def load_config() -> dict:
    if not os.path.exists(CONFIG_PATH):
        log(f"ERROR: config.json not found at {CONFIG_PATH}")
        sys.exit(1)
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def get_sites(cfg: dict) -> list[dict]:
    """
    Return the list of site configs. Supports both the new 'sites' array
    format and the legacy single-site format (site_url at top level).
    """
    if "sites" in cfg:
        return cfg["sites"]
    # Legacy format — wrap in a list with a generated site_id
    if "site_url" in cfg:
        domain = urlparse(cfg["site_url"]).netloc.replace(".", "_")
        return [{
            "site_id":  domain,
            "site_url": cfg["site_url"],
            "dns":      cfg.get("dns", {}),
            "content":  cfg.get("content", {}),
        }]
    log("ERROR: config.json has neither 'sites' array nor 'site_url' key.")
    sys.exit(1)


def baseline_path_for(site_id: str) -> str:
    """Return the path to the baseline file for a given site."""
    return os.path.join(BASE_DIR, f"baseline_{site_id}.json")


def load_baseline(site_id: str) -> dict:
    path = baseline_path_for(site_id)
    # Fall back to the single baseline.json if per-site file doesn't exist
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    if os.path.exists(BASELINE_PATH):
        with open(BASELINE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_baseline(site_id: str, data: dict):
    path = baseline_path_for(site_id)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    log(f"Baseline saved for {site_id}.")


# --------------------------------------------------------------------------
# Checks
# --------------------------------------------------------------------------

def check_availability(url: str, timeout: int = 15) -> dict:
    result = {"ok": False, "status_code": None, "response_time_ms": None, "error": None}
    try:
        start = time.time()
        resp = requests.get(url, timeout=timeout, allow_redirects=True)
        elapsed_ms = round((time.time() - start) * 1000, 1)
        result["status_code"] = resp.status_code
        result["response_time_ms"] = elapsed_ms
        result["final_url"] = resp.url
        result["ok"] = resp.status_code < 400
        result["_body"] = resp.text  # used by content checks, stripped before saving
    except requests.RequestException as e:
        result["error"] = str(e)
    return result


def check_dns(domain: str, expected_nameservers: list) -> dict:
    result = {"ok": None, "current_nameservers": [], "expected": expected_nameservers, "error": None}
    if not DNS_AVAILABLE:
        result["error"] = "dnspython not installed (pip install dnspython)"
        return result
    try:
        answers = dns.resolver.resolve(domain, "NS")
        current = sorted(str(r.target).rstrip(".").lower() for r in answers)
        result["current_nameservers"] = current
        if expected_nameservers:
            expected_norm = sorted(ns.rstrip(".").lower() for ns in expected_nameservers)
            result["ok"] = current == expected_norm
        else:
            result["ok"] = None  # no baseline set yet
    except Exception as e:
        result["error"] = str(e)
        result["ok"] = False
    return result


def check_ssl(domain: str, port: int = 443, timeout: int = 10) -> dict:
    result = {"ok": False, "issuer": None, "expires": None, "days_remaining": None, "error": None}
    try:
        ctx = ssl.create_default_context()
        with socket.create_connection((domain, port), timeout=timeout) as sock:
            with ctx.wrap_socket(sock, server_hostname=domain) as ssock:
                cert = ssock.getpeercert()
                expires_str = cert.get("notAfter")
                expires = datetime.strptime(expires_str, "%b %d %H:%M:%S %Y %Z")
                expires = expires.replace(tzinfo=timezone.utc)
                days_remaining = (expires - datetime.now(timezone.utc)).days
                issuer = dict(x[0] for x in cert.get("issuer", []))
                result.update({
                    "ok": days_remaining > 0,
                    "issuer": issuer.get("organizationName", "unknown"),
                    "expires": expires.strftime("%Y-%m-%d"),
                    "days_remaining": days_remaining,
                })
    except Exception as e:
        result["error"] = str(e)
    return result


def check_content(body: str, keywords: list, baseline_hash: str) -> dict:
    result = {"ok": True, "content_hash": None, "hash_changed": None,
              "flagged_keywords": [], "error": None}
    if body is None:
        result["ok"] = False
        result["error"] = "No page body to inspect (site unreachable)"
        return result

    current_hash = hashlib.sha256(body.encode("utf-8", errors="ignore")).hexdigest()
    result["content_hash"] = current_hash
    if baseline_hash:
        result["hash_changed"] = current_hash != baseline_hash

    lowered = body.lower()
    hits = [kw for kw in keywords if kw.lower() in lowered]
    result["flagged_keywords"] = hits
    if hits:
        result["ok"] = False
    return result


# --------------------------------------------------------------------------
# Alerting
# --------------------------------------------------------------------------

def send_email_alert(cfg: dict, subject: str, body: str):
    email_cfg = cfg.get("alerts", {}).get("email", {})
    if not email_cfg.get("enabled"):
        return
    try:
        msg = MIMEText(body)
        msg["Subject"] = subject
        msg["From"] = email_cfg["sender"]
        msg["To"] = ", ".join(email_cfg["recipients"])

        app_password = os.getenv("GMAIL_APP_PASSWORD") or email_cfg.get("app_password")
        with smtplib.SMTP_SSL(email_cfg["smtp_host"], email_cfg.get("smtp_port", 465)) as server:
            server.login(email_cfg["sender"], app_password)
            server.sendmail(email_cfg["sender"], email_cfg["recipients"], msg.as_string())
        log("Email alert sent.")
    except Exception as e:
        log(f"Failed to send email alert: {e}")


def send_sms_alert(cfg: dict, message: str):
    sms_cfg = cfg.get("alerts", {}).get("sms", {})
    if not sms_cfg.get("enabled"):
        return
    if not AT_AVAILABLE:
        log("Africa's Talking SDK not installed; skipping SMS.")
        return
    try:
        africastalking.initialize(sms_cfg["username"], sms_cfg["api_key"])
        sms = africastalking.SMS
        sms.send(message[:160], sms_cfg["recipients"], sender_id=sms_cfg.get("sender_id"))
        log("SMS alert sent.")
    except Exception as e:
        log(f"Failed to send SMS alert: {e}")


def maybe_alert(cfg: dict, report: dict):
    problems = []
    if not report["availability"]["ok"]:
        problems.append(f"Site unreachable or erroring (status={report['availability'].get('status_code')}, "
                         f"error={report['availability'].get('error')})")
    if report["dns"].get("ok") is False:
        problems.append(f"DNS/nameserver MISMATCH — current: {report['dns']['current_nameservers']} "
                         f"expected: {report['dns']['expected']}")
    if report["ssl"].get("ok") is False:
        problems.append(f"SSL certificate problem: {report['ssl'].get('error') or 'expired/invalid'}")
    if report["content"].get("flagged_keywords"):
        problems.append(f"Blacklisted keywords found on page: {report['content']['flagged_keywords']}")
    if report["content"].get("hash_changed"):
        problems.append("Page content hash changed since baseline (unexpected content change).")

    if problems:
        subject = f"[ALERT] {report['site']} monitoring flagged {len(problems)} issue(s)"
        body = f"Monitoring run at {report['timestamp']}\n\n" + "\n".join(f"- {p}" for p in problems)
        log("ANOMALY DETECTED:\n" + body)
        send_email_alert(cfg, subject, body)
        send_sms_alert(cfg, f"{report['site']} ALERT: {len(problems)} issue(s) detected. Check email/log.")
    else:
        log("No anomalies detected.")


# --------------------------------------------------------------------------
# Single-site check
# --------------------------------------------------------------------------

def run_check(site_cfg: dict, global_cfg: dict, set_baseline: bool = False) -> dict:
    """Run all checks for one site and return the report dict."""
    site_id = site_cfg["site_id"]
    url = site_cfg["site_url"]
    domain = urlparse(url).netloc

    log(f"[{site_id}] Checking {url} ...")
    availability = check_availability(url)
    body = availability.pop("_body", None)

    dns_expected = site_cfg.get("dns", {}).get("expected_nameservers", [])
    dns_result = check_dns(domain, dns_expected)

    ssl_result = check_ssl(domain)

    baseline = load_baseline(site_id)
    baseline_hash = baseline.get("content_hash")
    content_result = check_content(
        body,
        site_cfg.get("content", {}).get("blacklist_keywords", []),
        baseline_hash,
    )

    report = {
        "site":         url,
        "site_id":      site_id,
        "timestamp":    datetime.now(timezone.utc).isoformat(),
        "availability": availability,
        "dns":          dns_result,
        "ssl":          ssl_result,
        "content":      content_result,
    }

    # --- Local JSON backup ---
    os.makedirs(REPORTS_DIR, exist_ok=True)
    fname = f"{site_id}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.json"
    with open(os.path.join(REPORTS_DIR, fname), "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    log(f"[{site_id}] Local report saved: {fname}")

    # --- Supabase push ---
    push_to_supabase(report, site_id)

    if set_baseline:
        save_baseline(site_id, {
            "content_hash":  content_result["content_hash"],
            "nameservers":   dns_result["current_nameservers"],
            "recorded_at":   report["timestamp"],
        })
        log(f"[{site_id}] Baseline established. No alerts sent for this run.")
        return report

    maybe_alert(global_cfg, report)
    return report


# --------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Website monitoring script")
    parser.add_argument("--once",     action="store_true", help="Run a single check and exit")
    parser.add_argument("--loop",     action="store_true", help="Run forever, checking every 2 hours")
    parser.add_argument("--baseline", action="store_true",
                         help="Record current state as the known-good baseline instead of alerting")
    parser.add_argument("--site",     default=None,
                         help="Only check this site_id (default: check all sites in config)")
    args = parser.parse_args()

    cfg = load_config()
    sites = get_sites(cfg)

    if args.site:
        sites = [s for s in sites if s["site_id"] == args.site]
        if not sites:
            log(f"ERROR: site_id '{args.site}' not found in config.")
            sys.exit(1)

    def run_all():
        for site_cfg in sites:
            try:
                run_check(site_cfg, cfg, set_baseline=args.baseline)
            except Exception as e:
                log(f"[{site_cfg.get('site_id', '?')}] Unhandled error: {e}")

    if args.loop:
        log(f"Starting monitor loop for {len(sites)} site(s) (every 2 hours). Press Ctrl+C to stop.")
        while True:
            run_all()
            time.sleep(CHECK_INTERVAL_SECONDS)
    else:
        run_all()


if __name__ == "__main__":
    main()
