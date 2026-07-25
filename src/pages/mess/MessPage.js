// src/pages/mess/MessPage.js
import React, { useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where
} from "firebase/firestore";
import {
  Utensils,
  PlusCircle,
  CheckCircle2,
  RefreshCw,
  Clock,
  CreditCard,
  Inbox
} from "lucide-react";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MEALS = ["Breakfast", "Lunch", "Dinner"];
const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

function getMonthValue() {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}`;
}

export default function MessPage() {
  const { currentUser, userProfile } = useAuth();
  const role = userProfile?.role;
  const isStudent = role === "student";
  const isStaff = role === "staff";
  const isHod = role === "hod";

  const [tab, setTab] = useState("menu");

  const [menuEntries, setMenuEntries] = useState([]);
  const [menuFetching, setMenuFetching] = useState(false);
  const [menuError, setMenuError] = useState("");

  const [dayFilter, setDayFilter] = useState("all");
  const [menuForm, setMenuForm] = useState({
    day: "",
    meal: "",
    items: ""
  });
  const [menuSaving, setMenuSaving] = useState(false);
  const [menuSuccess, setMenuSuccess] = useState("");

  const [selectedYear, setSelectedYear] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(getMonthValue());
  const [students, setStudents] = useState([]);
  const [payments, setPayments] = useState({});
  const [studentsFetching, setStudentsFetching] = useState(false);
  const [paymentsSaving, setPaymentsSaving] = useState(false);
  const [paymentsSaved, setPaymentsSaved] = useState(false);
  const [paymentsError, setPaymentsError] = useState("");

  const [myPaymentMonth, setMyPaymentMonth] = useState(getMonthValue());
  const [myPaid, setMyPaid] = useState(null);
  const [myFetching, setMyFetching] = useState(false);

  async function fetchMenu() {
    setMenuFetching(true);
    setMenuError("");
    try {
      const q = query(collection(db, "mess_menu"), where("dept", "==", userProfile?.dept || ""));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMenuEntries(list);
    } catch (err) {
      console.error(err);
      setMenuError("Failed to fetch mess menu.");
    }
    setMenuFetching(false);
  }

  useEffect(() => {
    if (userProfile) {
      fetchMenu();
    }
  }, [userProfile]);

  function handleMenuChange(e) {
    setMenuForm({ ...menuForm, [e.target.name]: e.target.value });
  }

  async function handleMenuSubmit(e) {
    e.preventDefault();
    setMenuError("");
    setMenuSuccess("");

    if (!menuForm.day || !menuForm.meal || !menuForm.items.trim()) {
      setMenuError("All fields are required.");
      return;
    }

    setMenuSaving(true);
    try {
      await addDoc(collection(db, "mess_menu"), {
        dept: userProfile?.dept || "",
        day: menuForm.day,
        meal: menuForm.meal,
        items: menuForm.items.trim(),
        createdById: currentUser?.uid || "",
        createdByName: userProfile?.name || "Staff",
        createdAt: new Date().toISOString()
      });

      setMenuSuccess("Menu item added successfully!");
      setMenuForm({ day: "", meal: "", items: "" });
      fetchMenu();
    } catch (err) {
      console.error(err);
      setMenuError("Failed to add menu item.");
    }
    setMenuSaving(false);
  }

  async function fetchStudentsAndPayments() {
    if (!selectedYear || !selectedMonth || !userProfile) return;

    setStudentsFetching(true);
    setPaymentsError("");
    setPaymentsSaved(false);

    try {
      const studQ = query(
        collection(db, "users"),
        where("role", "==", "student"),
        where("dept", "==", userProfile.dept),
        where("year", "==", selectedYear)
      );
      const studSnap = await getDocs(studQ);
      const studList = studSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      studList.sort((a, b) => (a.registerNo || "").localeCompare(b.registerNo || ""));
      setStudents(studList);

      const docId = `${userProfile.dept}_${selectedYear}_${selectedMonth}`.replace(/\s+/g, "_");
      const paySnap = await getDoc(doc(db, "mess_payments", docId));
      if (paySnap.exists()) {
        setPayments(paySnap.data().payments || {});
      } else {
        const initial = {};
        studList.forEach(s => { initial[s.id] = false; });
        setPayments(initial);
      }
    } catch (err) {
      console.error(err);
      setPaymentsError("Failed to fetch students or payments.");
    }
    setStudentsFetching(false);
  }

  useEffect(() => {
    if (tab === "payments") {
      fetchStudentsAndPayments();
    }
  }, [tab, selectedYear, selectedMonth, userProfile]);

  function handlePaymentToggle(studentId) {
    setPayments(prev => ({
      ...prev,
      [studentId]: !prev[studentId]
    }));
  }

  async function handleSavePayments() {
    if (!selectedYear || !selectedMonth) return;
    setPaymentsSaving(true);
    try {
      const docId = `${userProfile.dept}_${selectedYear}_${selectedMonth}`.replace(/\s+/g, "_");
      await setDoc(doc(db, "mess_payments", docId), {
        dept: userProfile.dept,
        year: selectedYear,
        month: selectedMonth,
        payments,
        updatedAt: new Date().toISOString(),
        updatedBy: userProfile.name
      });
      setPaymentsSaved(true);
    } catch (err) {
      setPaymentsError("Failed to save payments.");
    }
    setPaymentsSaving(false);
  }

  async function fetchMyPayment() {
    if (!isStudent || !myPaymentMonth || !userProfile) return;
    setMyFetching(true);
    try {
      const docId = `${userProfile.dept}_${userProfile.year}_${myPaymentMonth}`.replace(/\s+/g, "_");
      const snap = await getDoc(doc(db, "mess_payments", docId));
      if (snap.exists()) {
        const val = snap.data().payments?.[currentUser?.uid];
        setMyPaid(val === true);
      } else {
        setMyPaid(null);
      }
    } catch (err) {
      console.error(err);
    }
    setMyFetching(false);
  }

  useEffect(() => {
    if (tab === "my-payment") {
      fetchMyPayment();
    }
  }, [tab, myPaymentMonth, userProfile]);

  const filteredMenu = useMemo(() => {
    return menuEntries.filter(entry => dayFilter === "all" || entry.day === dayFilter);
  }, [menuEntries, dayFilter]);

  const menuByDay = useMemo(() => {
    const map = {};
    DAYS.forEach(day => { map[day] = []; });
    filteredMenu.forEach(entry => {
      if (!map[entry.day]) map[entry.day] = [];
      map[entry.day].push(entry);
    });
    return map;
  }, [filteredMenu]);

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>Mess & Dining Portal</h1>
          <p>Weekly dining menu and monthly mess billing management</p>
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>
          {["menu", isStudent ? "my-payment" : "payments"]
            .filter(Boolean)
            .map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: "8px 18px", borderRadius: 20, border: "none", cursor: "pointer",
                  fontSize: 13, fontWeight: 600, transition: "all 0.2s ease",
                  background: tab === t ? "rgba(37, 99, 235, 0.18)" : "rgba(255,255,255,0.04)",
                  color: tab === t ? "var(--highlight)" : "var(--text-muted)"
                }}
              >
                {t === "menu" ? "Mess Menu" : isStudent ? "My Mess Bills" : "Mess Payments"}
              </button>
            ))}
        </div>

        {tab === "menu" && (
          <div className={`mess-layout ${isStaff ? "" : "single"}`}>
            {isStaff && (
              <div className="card" style={{ height: "fit-content" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                  <PlusCircle size={20} color="var(--highlight)" />
                  <h3 style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 17, fontWeight: 700 }}>Add Menu Item</h3>
                </div>

                {menuError && <div className="error-msg">{menuError}</div>}
                {menuSuccess && (
                  <div style={{
                    background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.3)",
                    borderRadius: "var(--radius-md)", padding: "12px 16px", color: "var(--success)",
                    fontSize: 14, marginBottom: 20, display: "flex", alignItems: "center", gap: 8
                  }}>
                    <CheckCircle2 size={16} /> {menuSuccess}
                  </div>
                )}

                <form onSubmit={handleMenuSubmit}>
                  <div className="form-group">
                    <label>Day *</label>
                    <select name="day" value={menuForm.day} onChange={handleMenuChange} required>
                      <option value="" disabled>Select Day</option>
                      {DAYS.map(day => <option key={day} value={day}>{day}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Meal *</label>
                    <select name="meal" value={menuForm.meal} onChange={handleMenuChange} required>
                      <option value="" disabled>Select Meal</option>
                      {MEALS.map(meal => <option key={meal} value={meal}>{meal}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Food Items *</label>
                    <input
                      name="items"
                      value={menuForm.items}
                      onChange={handleMenuChange}
                      placeholder="e.g. Idli, Sambar, Chutney"
                      required
                    />
                  </div>
                  <button className="btn-primary" type="submit" disabled={menuSaving}>
                    {menuSaving ? "Saving..." : "Add Menu Item"}
                  </button>
                </form>
              </div>
            )}

            <div>
              <div className="card" style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <h3 style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 17, fontWeight: 700 }}>Weekly Mess Menu</h3>
                    <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 2 }}>{userProfile?.dept} Department Mess</p>
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <select value={dayFilter} onChange={e => setDayFilter(e.target.value)} style={{ width: "auto" }}>
                      <option value="all">All Days</option>
                      {DAYS.map(day => <option key={day} value={day}>{day}</option>)}
                    </select>
                    <button
                      onClick={fetchMenu}
                      className="btn-secondary"
                      style={{ margin: 0, padding: "8px 14px", fontSize: 13, width: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}
                    >
                      <RefreshCw size={14} /> Refresh
                    </button>
                  </div>
                </div>
              </div>

              {menuFetching ? (
                <div style={{ textAlign: "center", padding: 60 }}>
                  <div className="spinner" style={{ margin: "0 auto" }}></div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {(dayFilter === "all" ? DAYS : [dayFilter]).map(day => (
                    <div key={day} className="card">
                      <h3 style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 16, fontWeight: 700, marginBottom: 14, color: "var(--text)" }}>
                        {day}
                      </h3>
                      {menuByDay[day] && menuByDay[day].length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {menuByDay[day].map(entry => (
                            <div key={entry.id} style={{
                              padding: "12px 16px", borderRadius: "var(--radius-md)",
                              border: "1px solid var(--border)", background: "rgba(11, 19, 43, 0.4)",
                              display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10
                            }}>
                              <div>
                                <span className="badge" style={{ background: "rgba(37, 99, 235, 0.12)", color: "var(--highlight)", border: "1px solid rgba(37, 99, 235, 0.3)", marginBottom: 4 }}>
                                  {entry.meal}
                                </span>
                                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginTop: 6 }}>
                                  {entry.items}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ color: "var(--text-muted)", fontSize: 13 }}>No menu items specified for this day.</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "my-payment" && isStudent && (
          <div className="card" style={{ maxWidth: 500 }}>
            <h3 style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 17, fontWeight: 700, marginBottom: 20 }}>
              My Mess Fee Status
            </h3>
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label>Select Month</label>
              <input
                type="month"
                value={myPaymentMonth}
                onChange={e => setMyPaymentMonth(e.target.value)}
              />
            </div>

            {myFetching ? (
              <div style={{ textAlign: "center", padding: 40 }}>
                <div className="spinner" style={{ margin: "0 auto" }}></div>
              </div>
            ) : myPaid === true ? (
              <div style={{ padding: 20, borderRadius: "var(--radius-md)", background: "rgba(16, 185, 129, 0.14)", border: "1px solid rgba(16, 185, 129, 0.3)", textAlign: "center" }}>
                <CheckCircle2 size={32} color="var(--success)" style={{ margin: "0 auto 8px" }} />
                <div style={{ color: "var(--success)", fontWeight: 700, fontSize: 16 }}>Mess Fee Settled</div>
                <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>Your mess bill for {myPaymentMonth} is fully paid.</div>
              </div>
            ) : myPaid === false ? (
              <div style={{ padding: 20, borderRadius: "var(--radius-md)", background: "rgba(239, 68, 68, 0.14)", border: "1px solid rgba(239, 68, 68, 0.3)", textAlign: "center" }}>
                <Clock size={32} color="var(--danger)" style={{ margin: "0 auto 8px" }} />
                <div style={{ color: "var(--danger)", fontWeight: 700, fontSize: 16 }}>Mess Fee Pending</div>
                <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>Your mess bill for {myPaymentMonth} is currently unpaid. Please submit payment via Fees portal.</div>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: 30, color: "var(--text-muted)" }}>
                No mess bill generated for {myPaymentMonth}.
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
