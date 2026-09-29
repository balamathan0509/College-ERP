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
      padding: "14px 22px",
      marginBottom: 24,
      borderRadius: 10,
      background: "#ffffff",
      border: "1px solid #e2e8f0",
      boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Calendar size={18} color="#2563eb" />
        <span style={{
          fontSize: 14,
          fontWeight: 600,
          color: "#0f172a",
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
        borderRadius: 6,
        background: "#eff6ff",
        border: "1px solid #bfdbfe"
      }}>
        <Clock size={16} color="#1d4ed8" />
        <span style={{
          fontSize: 14,
          fontWeight: 700,
          color: "#1d4ed8",
          fontFamily: "Inter, sans-serif",
          letterSpacing: "0.02em",
          fontVariantNumeric: "tabular-nums"
        }}>
          {timeStr}
        </span>
      </div>
    </div>
  );
}
