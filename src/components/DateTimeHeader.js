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
    <div className="datetime-header">
      <div className="datetime-date-wrapper">
        <Calendar size={16} color="#2563eb" style={{ flexShrink: 0 }} />
        <span className="datetime-date-text">
          {dateStr}
        </span>
      </div>
      <div className="datetime-time-pill">
        <Clock size={13} color="#2563eb" style={{ flexShrink: 0 }} />
        <span className="datetime-time-text">
          {timeStr}
        </span>
      </div>
    </div>
  );
}
