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
  const [paymentsFetching, setPaymentsFetching] = useState(false);
  const [paymentsSaving, setPaymentsSaving] = useState(false);
  const [paymentsError, setPaymentsError] = useState("");
  const [paymentsSaved, setPaymentsSaved] = useState(false);

  const [studentMonth, setStudentMonth] = useState(getMonthValue());
  const [studentPaid, setStudentPaid] = useState(false);
  const [studentFetching, setStudentFetching] = useState(false);

  useEffect(() => {
    if (!userProfile || !currentUser) return;
    fetchMenu();
  }, [userProfile, currentUser]);

  useEffect(() => {
    if (!userProfile || !currentUser) return;
    if (isStudent) {
      fetchStudentPayment(studentMonth);
    }
  }, [userProfile, currentUser, isStudent, studentMonth]);

  useEffect(() => {
    if (!userProfile || !currentUser) return;
    if ((isStaff || isHod) && selectedYear && selectedMonth) {
      fetchPayments(selectedYear, selectedMonth);
    }
  }, [userProfile, currentUser, isStaff, isHod, selectedYear, selectedMonth]);

  async function fetchMenu() {
    setMenuFetching(true);
    setMenuError("");
    try {
      const q = query(
        collection(db, "mess_menu"),
        where("dept", "==", userProfile.dept)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const dayOrder = DAYS.reduce((acc, day, idx) => ({ ...acc, [day]: idx }), {});
      const mealOrder = MEALS.reduce((acc, meal, idx) => ({ ...acc, [meal]: idx }), {});
      list.sort((a, b) => {
        const dayDiff = (dayOrder[a.day] ?? 0) - (dayOrder[b.day] ?? 0);
        if (dayDiff !== 0) return dayDiff;
        return (mealOrder[a.meal] ?? 0) - (mealOrder[b.meal] ?? 0);
      });
      setMenuEntries(list);
    } catch (err) {
      setMenuError("Failed to load mess menu. Please try again.");
    }
    setMenuFetching(false);
  }

  function handleMenuChange(e) {
    setMenuForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleMenuSubmit(e) {
    e.preventDefault();
    setMenuError("");
    setMenuSuccess("");
    if (!menuForm.day || !menuForm.meal || !menuForm.items.trim()) {
      return setMenuError("Please fill all required fields.");
    }
    setMenuSaving(true);
    try {
      await addDoc(collection(db, "mess_menu"), {
        dept: userProfile.dept,
        day: menuForm.day,
        meal: menuForm.meal,
        items: menuForm.items.trim(),
        createdById: currentUser.uid,
        createdByName: userProfile.name,
        createdAt: new Date().toISOString()
      });
      setMenuForm({ day: "", meal: "", items: "" });
      setMenuSuccess("Menu entry added.");
      fetchMenu();
    } catch (err) {
      setMenuError("Failed to add menu entry.");
    }
    setMenuSaving(false);
  }

  async function fetchPayments(year, month) {
    setPaymentsFetching(true);
    setPaymentsError("");
    setPaymentsSaved(false);
    try {
      const q = query(
        collection(db, "users"),
        where("role", "==", "student"),
        where("dept", "==", userProfile.dept),
        where("year", "==", year)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => a.name.localeCompare(b.name));
      setStudents(list);

      const docId = `${userProfile.dept}_${year}_${month}`.replace(/\s+/g, "_");
      const payDoc = await getDoc(doc(db, "mess_payments", docId));
      if (payDoc.exists()) {
        setPayments(payDoc.data().payments || {});
      } else {
        setPayments({});
      }
    } catch (err) {
      setPaymentsError("Failed to load payments.");
    }
    setPaymentsFetching(false);
  }

  async function fetchStudentPayment(month) {
    setStudentFetching(true);
    try {
      const docId = `${userProfile.dept}_${userProfile.year}_${month}`.replace(/\s+/g, "_");
      const payDoc = await getDoc(doc(db, "mess_payments", docId));
      if (payDoc.exists()) {
        const map = payDoc.data().payments || {};
        setStudentPaid(!!map[currentUser.uid]);
      } else {
        setStudentPaid(false);
      }
    } catch (err) {
      setStudentPaid(false);
    }
    setStudentFetching(false);
  }

  function togglePayment(studentId) {
    setPayments(prev => ({
      ...prev,
      [studentId]: !prev[studentId]
    }));
  }

  function selectAll() {
    const all = {};
    students.forEach(s => { all[s.id] = true; });
    setPayments(all);
  }

  function clearAll() {
    setPayments({});
  }

  async function savePayments() {
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

  const paidCount = students.filter(s => payments[s.id]).length;
  const pendingCount = students.length - paidCount;

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>Mess Management</h1>
          <p>Role-based mess menu and payment tracking</p>
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          {["menu", isStudent ? "my-payment" : "payments"]
            .filter(Boolean)
            .map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: "10px 24px",
                  borderRadius: 10,
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "Syne",
                  fontWeight: 600,
                  fontSize: 14,
                  background: tab === t ? "#e94560" : "rgba(255,255,255,0.07)",
                  color: "white"
                }}
              >
                {t === "menu" ? "Menu" : isStudent ? "My Payment" : "Payments"}
              </button>
            ))}
        </div>

        {tab === "menu" && (
          <div className={`mess-layout ${isStaff ? "" : "single"}`}>
            {isStaff && (
              <div className="card" style={{ height: "fit-content" }}>
                <h3 style={{ fontFamily: "Syne", fontSize: 18, marginBottom: 20 }}>Add Menu Item</h3>
                {menuError && <div className="error-msg">{menuError}</div>}
                {menuSuccess && (
                  <div style={{
                    background: "rgba(72,187,120,0.1)",
                    border: "1px solid rgba(72,187,120,0.3)",
                    borderRadius: 10,
                    padding: "12px 16px",
                    color: "#48bb78",
                    fontSize: 14,
                    marginBottom: 20
                  }}>
                    {menuSuccess}
                  </div>
                )}
                <form onSubmit={handleMenuSubmit}>
                  <div className="form-group">
                    <label>Day</label>
                    <select name="day" value={menuForm.day} onChange={handleMenuChange}>
                      <option value="">Select Day</option>
                      {DAYS.map(day => <option key={day} value={day}>{day}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Meal</label>
                    <select name="meal" value={menuForm.meal} onChange={handleMenuChange}>
                      <option value="">Select Meal</option>
                      {MEALS.map(meal => <option key={meal} value={meal}>{meal}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Items</label>
                    <input
                      name="items"
                      value={menuForm.items}
                      onChange={handleMenuChange}
                      placeholder="Example: Idli, Sambar, Chutney"
                    />
                  </div>
                  <button className="btn-primary" type="submit" disabled={menuSaving}>
                    {menuSaving ? "Saving..." : "Add Menu"}
                  </button>
                </form>
              </div>
            )}

            <div>
              <div className="card" style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <h3 style={{ fontFamily: "Syne", fontSize: 18, marginBottom: 6 }}>Weekly Menu</h3>
                    <p style={{ color: "#a0aec0", fontSize: 13 }}>{userProfile?.dept}</p>
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <select value={dayFilter} onChange={e => setDayFilter(e.target.value)}>
                      <option value="all">All Days</option>
                      {DAYS.map(day => <option key={day} value={day}>{day}</option>)}
                    </select>
                    <button
                      onClick={fetchMenu}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 8,
                        border: "1px solid rgba(255,255,255,0.2)",
                        background: "rgba(255,255,255,0.05)",
                        color: "white",
                        cursor: "pointer",
                        fontSize: 13,
                        fontWeight: 600
                      }}
                    >
                      Refresh
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
                      <div style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
                        {day}
                      </div>
                      {menuByDay[day] && menuByDay[day].length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {menuByDay[day].map(entry => (
                            <div key={entry.id} style={{
                              padding: "12px 14px",
                              borderRadius: 12,
                              border: "1px solid rgba(255,255,255,0.08)",
                              background: "rgba(255,255,255,0.03)",
                              display: "flex",
                              justifyContent: "space-between",
                              flexWrap: "wrap",
                              gap: 10
                            }}>
                              <div>
                                <div style={{ fontWeight: 700 }}>{entry.meal}</div>
                                <div style={{ fontSize: 12, color: "#a0aec0", marginTop: 4 }}>
                                  {entry.items}
                                </div>
                              </div>
                              {!isStudent && (
                                <div style={{ fontSize: 12, color: "#a0aec0" }}>
                                  Added by {entry.createdByName}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ color: "#a0aec0", fontSize: 13 }}>No menu entries.</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "payments" && (isStaff || isHod) && (
          <div>
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="form-row">
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Select Year</label>
                  <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
                    <option value="">Choose Year</option>
                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Month</label>
                  <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} />
                </div>
              </div>
            </div>

            {paymentsError && <div className="error-msg">{paymentsError}</div>}

            {paymentsFetching ? (
              <div style={{ textAlign: "center", padding: 60 }}>
                <div className="spinner" style={{ margin: "0 auto" }}></div>
              </div>
            ) : selectedYear ? (
              students.length > 0 ? (
                <div className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
                    <div>
                      <h3 style={{ fontFamily: "Syne", fontSize: 18 }}>
                        Mess Payments - {selectedYear} ({selectedMonth})
                      </h3>
                      <p style={{ color: "#a0aec0", fontSize: 13 }}>{userProfile?.dept}</p>
                    </div>
                    {isStaff && (
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <button onClick={selectAll} style={{
                          padding: "8px 16px",
                          borderRadius: 8,
                          border: "1px solid rgba(72,187,120,0.3)",
                          background: "rgba(72,187,120,0.1)",
                          color: "#48bb78",
                          cursor: "pointer",
                          fontSize: 13,
                          fontWeight: 600
                        }}>Select All</button>
                        <button onClick={clearAll} style={{
                          padding: "8px 16px",
                          borderRadius: 8,
                          border: "1px solid rgba(252,129,129,0.3)",
                          background: "rgba(252,129,129,0.1)",
                          color: "#fc8181",
                          cursor: "pointer",
                          fontSize: 13,
                          fontWeight: 600
                        }}>Clear All</button>
                      </div>
                    )}
                  </div>

                  <div className="stats-grid" style={{ marginBottom: 20 }}>
                    <div className="stat-card">
                      <div className="stat-value">{students.length}</div>
                      <div className="stat-label">Total Students</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value" style={{ color: "#48bb78" }}>{paidCount}</div>
                      <div className="stat-label">Paid</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value" style={{ color: "#fc8181" }}>{pendingCount}</div>
                      <div className="stat-label">Pending</div>
                    </div>
                  </div>

                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                          <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, color: "#a0aec0", fontWeight: 600, textTransform: "uppercase" }}>S.No</th>
                          <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, color: "#a0aec0", fontWeight: 600, textTransform: "uppercase" }}>Name</th>
                          <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, color: "#a0aec0", fontWeight: 600, textTransform: "uppercase" }}>Register No</th>
                          <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 12, color: "#a0aec0", fontWeight: 600, textTransform: "uppercase" }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((student, idx) => {
                          const isPaid = !!payments[student.id];
                          return (
                            <tr
                              key={student.id}
                              style={{
                                borderBottom: "1px solid rgba(255,255,255,0.05)",
                                background: isPaid ? "rgba(72,187,120,0.05)" : "transparent",
                                cursor: isStaff ? "pointer" : "default"
                              }}
                              onClick={() => isStaff && togglePayment(student.id)}
                            >
                              <td style={{ padding: "14px 16px", color: "#a0aec0", fontSize: 14 }}>{idx + 1}</td>
                              <td style={{ padding: "14px 16px", fontWeight: 600, fontSize: 15 }}>{student.name}</td>
                              <td style={{ padding: "14px 16px", color: "#a0aec0", fontSize: 14 }}>{student.registerNo}</td>
                              <td style={{ padding: "14px 16px", textAlign: "center" }}>
                                <div style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: 8,
                                  border: isPaid ? "2px solid #48bb78" : "2px solid rgba(255,255,255,0.2)",
                                  background: isPaid ? "#48bb78" : "transparent",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  margin: "0 auto",
                                  fontSize: 16,
                                  transition: "all 0.2s"
                                }}>
                                  {isPaid ? "OK" : ""}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {isStaff && (
                    <div style={{ marginTop: 24, display: "flex", gap: 12, alignItems: "center" }}>
                      <button className="btn-primary" onClick={savePayments} disabled={paymentsSaving} style={{ width: "auto", padding: "12px 32px" }}>
                        {paymentsSaving ? "Saving..." : "Save Payments"}
                      </button>
                      {paymentsSaved && (
                        <span style={{ color: "#48bb78", fontWeight: 600, fontSize: 14 }}>Saved successfully!</span>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="card" style={{ textAlign: "center", padding: 60 }}>
                  <p style={{ color: "#a0aec0" }}>No students found for {selectedYear}.</p>
                </div>
              )
            ) : (
              <div className="card" style={{ textAlign: "center", padding: 60 }}>
                <p style={{ color: "#a0aec0" }}>Select year and month to view payments.</p>
              </div>
            )}
          </div>
        )}

        {tab === "my-payment" && isStudent && (
          <div className="card" style={{ maxWidth: 480 }}>
            <h3 style={{ fontFamily: "Syne", fontSize: 18, marginBottom: 16 }}>My Mess Payment</h3>
            <div className="form-group">
              <label>Month</label>
              <input type="month" value={studentMonth} onChange={e => setStudentMonth(e.target.value)} />
            </div>
            {studentFetching ? (
              <div style={{ textAlign: "center", padding: 30 }}>
                <div className="spinner" style={{ margin: "0 auto" }}></div>
              </div>
            ) : (
              <div style={{
                padding: "14px 16px",
                borderRadius: 12,
                background: studentPaid ? "rgba(72,187,120,0.1)" : "rgba(252,129,129,0.1)",
                border: `1px solid ${studentPaid ? "rgba(72,187,120,0.3)" : "rgba(252,129,129,0.3)"}`,
                color: studentPaid ? "#48bb78" : "#fc8181",
                fontWeight: 700
              }}>
                {studentPaid ? "Paid" : "Pending"}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
