// src/components/DateTimeHeader.js
import React, { useState, useEffect } from "react";
import { Calendar, Clock } from "lucide-react";

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
      padding: "12px 20px",
      marginBottom: 24,
      borderRadius: "var(--radius-md)",
      background: "rgba(11, 19, 43, 0.5)",
      border: "1px solid var(--border)",
      backdropFilter: "blur(12px)"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Calendar size={18} color="var(--highlight)" />
        <span style={{
          fontSize: 14,
          fontWeight: 600,
          color: "var(--text)",
          fontFamily: "Inter, sans-serif"
        }}>
          {dateStr}
        </span>
      </div>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 14px",
        borderRadius: "var(--radius-sm)",
        background: "rgba(37, 99, 235, 0.12)",
        border: "1px solid rgba(37, 99, 235, 0.3)"
      }}>
        <Clock size={16} color="var(--highlight)" />
        <span style={{
          fontSize: 14,
          fontWeight: 700,
          color: "var(--highlight)",
          fontFamily: "Plus Jakarta Sans, sans-serif",
          letterSpacing: "0.02em",
          fontVariantNumeric: "tabular-nums"
        }}>
          {timeStr}
        </span>
      </div>
    </div>
  );
}
