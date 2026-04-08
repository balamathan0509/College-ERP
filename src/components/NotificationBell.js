// src/components/NotificationBell.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";

function isVisibleToUser(alert, userProfile) {
  if (!userProfile) return false;
  const role = userProfile.role;
  const dept = userProfile.dept;
  const year = userProfile.year;

  const roleOk = alert.roleTarget === "all" || alert.roleTarget === role;
  const deptOk = alert.deptTarget === "all" || alert.deptTarget === dept;

  if (role !== "student") {
    return roleOk && deptOk;
  }
  const yearOk = alert.yearTarget === "all" || alert.yearTarget === year;
  return roleOk && deptOk && yearOk;
}

function fmtShort(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export default function NotificationBell() {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const role = userProfile?.role;
  const enabled = role === "student" || role === "staff" || role === "hod";

  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(false);
  const [lastSeenAt, setLastSeenAt] = useState(0);
  const popoverRef = useRef(null);

  const storageKey = useMemo(() => {
    if (!currentUser) return "";
    return `alerts_last_seen_${currentUser.uid}`;
  }, [currentUser]);

  useEffect(() => {
    if (!storageKey) return;
    const raw = localStorage.getItem(storageKey);
    const ts = raw ? new Date(raw).getTime() : 0;
    setLastSeenAt(Number.isNaN(ts) ? 0 : ts);
  }, [storageKey]);

  useEffect(() => {
    if (!enabled || !userProfile) return;
    fetchAlerts();
    const id = setInterval(fetchAlerts, 60000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, userProfile?.uid, userProfile?.dept, userProfile?.year, role]);

  useEffect(() => {
    function onDocClick(e) {
      if (!open || !popoverRef.current) return;
      if (!popoverRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  async function fetchAlerts() {
    setLoading(true);
    setErr("");
    try {
      const snap = await getDocs(collection(db, "alerts"));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const visible = list.filter(a => isVisibleToUser(a, userProfile));
      setAlerts(visible);
    } catch (e) {
      setErr("Failed to load alerts.");
    }
    setLoading(false);
  }

  function markSeen() {
    if (!storageKey) return;
    const latest = alerts[0]?.createdAt || new Date().toISOString();
    localStorage.setItem(storageKey, latest);
    const ts = new Date(latest).getTime();
    setLastSeenAt(Number.isNaN(ts) ? 0 : ts);
  }

  const unreadCount = useMemo(() => {
    if (!alerts.length) return 0;
    return alerts.filter(a => new Date(a.createdAt).getTime() > lastSeenAt).length;
  }, [alerts, lastSeenAt]);

  if (!enabled) return null;

  const alertsPath = `/${role}/alerts`;

  return (
    <div className="topbar-bell" ref={popoverRef}>
      <button
        className="bell-btn"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) markSeen();
        }}
        aria-label="Notifications"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22zm7-6V11a7 7 0 0 0-5-6.7V3a2 2 0 1 0-4 0v1.3A7 7 0 0 0 5 11v5l-1.6 1.6a1 1 0 0 0 .7 1.7h16.8a1 1 0 0 0 .7-1.7L19 16z" />
        </svg>
        {unreadCount > 0 && (
          <span className="bell-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="bell-popover">
          <div className="bell-popover-header">
            <span>Alerts</span>
            <button
              className="bell-view"
              onClick={() => {
                setOpen(false);
                navigate(alertsPath);
              }}
            >
              View all
            </button>
          </div>

          {loading && <div className="bell-empty">Loading...</div>}
          {!loading && err && <div className="bell-empty">{err}</div>}
          {!loading && !err && alerts.length === 0 && (
            <div className="bell-empty">No alerts yet.</div>
          )}
          {!loading && !err && alerts.length > 0 && (
            <div className="bell-list">
              {alerts.slice(0, 4).map(a => {
                const isNew = new Date(a.createdAt).getTime() > lastSeenAt;
                return (
                  <div key={a.id} className={`bell-item ${isNew ? "new" : ""}`}>
                    <div className="bell-title">{a.title || "Alert"}</div>
                    <div className="bell-meta">{fmtShort(a.createdAt)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
