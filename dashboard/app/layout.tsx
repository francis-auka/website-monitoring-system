import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Site Monitor Dashboard",
  description: "Real-time website monitoring dashboard — availability, DNS, SSL, and content integrity.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <nav className="navbar">
          <div className="page-wrapper" style={{ display: "flex", alignItems: "center", gap: "1rem", height: "60px" }}>
            <Link href="/" style={{ display: "flex", alignItems: "center", gap: "0.625rem", textDecoration: "none" }}>
              <span style={{ fontSize: "1.25rem", color: "var(--sky-primary)" }}>🛡️</span>
              <span style={{ fontWeight: 800, fontSize: "1.125rem", color: "var(--text)", letterSpacing: "-0.02em" }}>
                SITE<span className="sky-text">MONITOR</span>
              </span>
            </Link>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Live · Every 2h
            </span>
            <div style={{ width: 8, height: 8, borderRadius: 0, background: "var(--sky-primary)", animation: "pulse 2s ease-in-out infinite" }} />
          </div>
        </nav>
        <main style={{ paddingBottom: "4rem" }}>
          {children}
        </main>
      </body>
    </html>
  );
}
