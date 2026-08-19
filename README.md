# Website Monitor — sportykenya.co.ke

Monitors availability, DNS/nameserver integrity, SSL, and content for
signs of another hijack (like the nameserver redirect to a gambling
spam site).

## 1. Install

```bash
pip install -r requirements.txt --break-system-packages
```

(SMS via Africa's Talking is optional — leave `alerts.sms.enabled: false`
in `config.json` if you don't need it.)

## 2. Configure

Edit `config.json`:

- `dns.expected_nameservers` — your **known-good** Truehost nameservers.
  Verify these directly in your Truehost dashboard right now while DNS
  is clean; don't trust memory.
- `content.blacklist_keywords` — add/remove terms as needed.
- `alerts.email.app_password` — a **Gmail App Password** (not your normal
  password). Generate one at https://myaccount.google.com/apppasswords
  (requires 2FA enabled on the Gmail account — you should enable this
  anyway as part of your post-hijack cleanup).
- `alerts.sms` — fill in if you want SMS alerts via Africa's Talking.

## 3. Set the baseline (do this once, now, while the site is clean)

```bash
python monitor.py --baseline
```

This records the current content hash and nameservers as "known good."
Every future run compares against this.

## 4. Run a single check (recommended: via cron/Task Scheduler every 2h)

```bash
python monitor.py --once
```

**Linux/cron** — every 2 hours:
```
0 */2 * * * cd /path/to/website-monitor && /usr/bin/python3 monitor.py --once >> cron.log 2>&1
```

**Windows Task Scheduler:**
- Trigger: Daily, repeat every 2 hours
- Action: `python.exe` with argument `monitor.py --once`, start-in folder set to this directory

## 5. Or run it as a persistent process (checks every 2h automatically)

```bash
python monitor.py --loop
```

Use this on a server with `nohup`, `screen`, `tmux`, or as a `systemd`
service if you don't have cron access (e.g. some hosting panels).

## Output

- `reports/YYYYMMDD_HHMMSS.json` — one detailed report per check
- `monitor.log` — running human-readable log of every check + alerts
- `baseline.json` — the known-good snapshot checks are compared against

## What triggers an alert

- Site down or returning an error status
- Nameservers don't match `expected_nameservers` (the hijack vector last time)
- SSL certificate invalid or expired
- Blacklisted keywords found on the homepage (spam/gambling injection)
- Homepage content hash changed unexpectedly

Alerts go out by email (and SMS if enabled) the moment any check fails —
you don't need to read the log to find out.

## After a real incident (reminder)

If an alert fires and it's a genuine hijack again:
1. Log into your domain registrar/Truehost immediately and restore correct nameservers.
2. Change registrar and hosting passwords, enable 2FA if not already on.
3. Report the abuse to Cloudflare (or whichever host was serving the spam site).
4. Once restored, re-run `python monitor.py --baseline` to reset the known-good state.
