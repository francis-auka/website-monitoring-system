"use client";

import React, { useState } from "react";
import { format } from "date-fns";
import type { MonitorReport } from "@/lib/supabase";

interface Props {
  reports: MonitorReport[];
}

interface Point {
  time: string;
  ms: number | null;
  ok: boolean;
  status: number | null;
  x: number;
  y: number;
}

export default function ResponseTimeChart({ reports }: Props) {
  const [hoveredPoint, setHoveredPoint] = useState<Point | null>(null);

  const rawData = [...reports]
    .reverse()
    .map((r) => ({
      time: format(new Date(r.checked_at), "MMM d HH:mm"),
      ms: r.avail_response_time_ms ?? null,
      ok: r.avail_ok ?? false,
      status: r.avail_status_code,
    }));

  if (rawData.length === 0) {
    return (
      <div style={{ color: "var(--muted)", padding: "2rem", textAlign: "center", fontSize: "0.875rem" }}>
        No response time data yet.
      </div>
    );
  }

  // Chart Dimensions
  const width = 600;
  const height = 200;
  const padding = { top: 20, right: 30, bottom: 30, left: 55 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const validMs = rawData.map((d) => d.ms).filter((v): v is number => v !== null);
  const maxMs = Math.max(1600, ...validMs) * 1.1;

  const points: Point[] = rawData.map((d, index) => {
    const x = padding.left + (index / Math.max(1, rawData.length - 1)) * innerWidth;
    const yVal = d.ms !== null ? d.ms : maxMs;
    const y = padding.top + innerHeight - (yVal / maxMs) * innerHeight;
    return { ...d, x, y };
  });

  const pathD = points.reduce((acc, point, i) => {
    if (point.ms === null) return acc;
    if (i === 0 || acc === "") return `M ${point.x} ${point.y}`;
    return `${acc} L ${point.x} ${point.y}`;
  }, "");

  const areaD = pathD
    ? `${pathD} L ${points[points.length - 1].x} ${height - padding.bottom} L ${points[0].x} ${height - padding.bottom} Z`
    : "";

  const yTicks = [0, Math.round(maxMs * 0.33), Math.round(maxMs * 0.66), Math.round(maxMs)];
  const step = Math.max(1, Math.floor(rawData.length / 5));
  const xTicks = points.filter((_, idx) => idx % step === 0 || idx === points.length - 1);

  const refY = padding.top + innerHeight - (1500 / maxMs) * innerHeight;

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: "100%", height: "auto", overflow: "visible" }}
      >
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--sky-primary)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--sky-primary)" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {yTicks.map((tick) => {
          const y = padding.top + innerHeight - (tick / maxMs) * innerHeight;
          return (
            <g key={tick}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="var(--border)"
                strokeDasharray="2 2"
              />
              <text
                x={padding.left - 8}
                y={y + 4}
                fill="var(--muted)"
                fontSize="10"
                fontWeight="500"
                textAnchor="end"
              >
                {tick}ms
              </text>
            </g>
          );
        })}

        {/* X-axis labels */}
        {xTicks.map((tick, i) => (
          <text
            key={i}
            x={tick.x}
            y={height - 8}
            fill="var(--muted)"
            fontSize="10"
            fontWeight="500"
            textAnchor="middle"
          >
            {tick.time}
          </text>
        ))}

        {/* 1500ms Reference Line */}
        {refY >= padding.top && refY <= height - padding.bottom && (
          <g>
            <line
              x1={padding.left}
              y1={refY}
              x2={width - padding.right}
              y2={refY}
              stroke="var(--sky-dark)"
              strokeDasharray="4 4"
              strokeWidth="1.5"
            />
            <text
              x={width - padding.right}
              y={refY - 4}
              fill="var(--sky-dark)"
              fontSize="9"
              fontWeight="700"
              textAnchor="end"
            >
              1.5s warning limit
            </text>
          </g>
        )}

        {/* Area fill */}
        {areaD && <path d={areaD} fill="url(#areaGradient)" />}

        {/* Main Line */}
        {pathD && (
          <path
            d={pathD}
            fill="none"
            stroke="var(--sky-primary)"
            strokeWidth="2.5"
            strokeLinecap="square"
            strokeLinejoin="miter"
          />
        )}

        {/* Points / Flat Sharp Square Markers */}
        {points.map((p, i) => {
          const isHovered = hoveredPoint === p;
          const size = isHovered ? 8 : 6;
          return (
            <g key={i}>
              <rect
                x={p.x - size / 2}
                y={p.y - size / 2}
                width={size}
                height={size}
                fill={p.ok ? "var(--sky-primary)" : "var(--sky-dark)"}
                stroke="#ffffff"
                strokeWidth="1.5"
                style={{ cursor: "pointer", transition: "all 0.1s ease" }}
                onMouseEnter={() => setHoveredPoint(p)}
                onMouseLeave={() => setHoveredPoint(null)}
              />
            </g>
          );
        })}
      </svg>

      {/* Flat Sharp Tooltip overlay */}
      {hoveredPoint && (
        <div
          style={{
            position: "absolute",
            top: `${(hoveredPoint.y / height) * 100}%`,
            left: `${(hoveredPoint.x / width) * 100}%`,
            transform: "translate(-50%, -120%)",
            background: "#ffffff",
            border: "2px solid var(--sky-primary)",
            borderRadius: 0,
            padding: "0.5rem 0.75rem",
            fontSize: "0.75rem",
            boxShadow: "0 4px 12px rgba(2, 132, 199, 0.15)",
            pointerEvents: "none",
            zIndex: 10,
            whiteSpace: "nowrap",
          }}
        >
          <p style={{ color: "var(--muted)", marginBottom: "0.2rem", fontWeight: 600 }}>{hoveredPoint.time}</p>
          <p style={{ fontWeight: 800, color: hoveredPoint.ok ? "var(--sky-primary)" : "var(--sky-dark)" }}>
            {hoveredPoint.ms != null ? `${hoveredPoint.ms} ms` : "Unreachable"}
          </p>
          {hoveredPoint.status && (
            <p style={{ color: "var(--muted)", fontSize: "0.7rem", marginTop: "0.1rem" }}>HTTP {hoveredPoint.status}</p>
          )}
        </div>
      )}
    </div>
  );
}
