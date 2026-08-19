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
              <span style={{ fontSize: "1.25rem" }}>🛡️</span>
              <span style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text)" }}>
                Site<span className="gradient-text">Monitor</span>
              </span>
            </Link>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
              Live · Every 2h
            </span>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--green)", boxShadow: "0 0 8px var(--green)", animation: "pulse 2s ease-in-out infinite" }} />
          </div>
        </nav>
        <main style={{ paddingBottom: "4rem" }}>
          {children}
        </main>
      </body>
    </html>
  );
}
