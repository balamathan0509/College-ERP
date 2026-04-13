// src/components/DateTimeHeader.js
import React, { useState, useEffect } from "react";

export default function DateTimeHeader() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const dateStr = now.toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  const timeStr = now.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });

  return (
    <div className="datetime-header" style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "14px 20px",
      marginBottom: 24,
      borderRadius: 14,
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      backdropFilter: "blur(10px)"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 20 }}>📅</span>
        <span style={{
          fontSize: 14,
          fontWeight: 600,
          color: "#e2e8f0",
          fontFamily: "'DM Sans', sans-serif"
        }}>
          {dateStr}
        </span>
      </div>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 14px",
        borderRadius: 10,
        background: "rgba(233,69,96,0.1)",
        border: "1px solid rgba(233,69,96,0.2)"
      }}>
        <span style={{ fontSize: 14 }}>🕐</span>
        <span style={{
          fontSize: 15,
          fontWeight: 700,
          color: "#e94560",
          fontFamily: "'Syne', sans-serif",
          letterSpacing: "0.5px",
          fontVariantNumeric: "tabular-nums"
        }}>
          {timeStr}
        </span>
      </div>
    </div>
  );
}
