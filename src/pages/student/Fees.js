// src/pages/student/Fees.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, getDocs, query, where } from "firebase/firestore";

const FEES_TYPES = ["College Fees", "Bus Fees", "Mess Fees", "Exam Fees", "Library Fees", "Other"];

export default function StudentFees() {
  const { currentUser, userProfile } = useAuth();
  const [feesStatus, setFeesStatus] = useState([]);
  const [fetching, setFetching] = useState(true);

  async function fetchFeesStatus() {
    setFetching(true);
    try {
      const results = [];
      for (const feesType of FEES_TYPES) {
        const docId = `${userProfile.dept}_${userProfile.year}_${feesType}`.replace(/\s+/g, "_");
        try {
          const snap = await getDocs(query(collection(db, "fees"), where("dept", "==", userProfile.dept), where("year", "==", userProfile.year), where("feesType", "==", feesType)));
          if (!snap.empty) {
            const data = snap.docs[0].data();
            const paid = data.payments?.[currentUser.uid] || false;
            results.push({ feesType, paid, updatedAt: data.updatedAt });
          } else {
            results.push({ feesType, paid: null });
          }
        } catch (e) {
          results.push({ feesType, paid: null });
        }
      }
      setFeesStatus(results);
    } catch (err) {}
    setFetching(false);
  }

  useEffect(() => { fetchFeesStatus(); }, []);

  const paidCount = feesStatus.filter(f => f.paid === true).length;
  const pendingCount = feesStatus.filter(f => f.paid === false).length;

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>💰 My Fees Status</h1>
          <p>{userProfile?.dept} • {userProfile?.year}</p>
        </div>

        {/* Stats */}
        <div className="stats-grid" style={{ marginBottom: 28 }}>
          <div className="stat-card">
            <div className="stat-icon">✅</div>
            <div className="stat-value" style={{ color: "#48bb78" }}>{paidCount}</div>
            <div className="stat-label">Fees Paid</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⏳</div>
            <div className="stat-value" style={{ color: "#fc8181" }}>{pendingCount}</div>
            <div className="stat-label">Fees Pending</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📋</div>
            <div className="stat-value">{feesStatus.filter(f => f.paid === null).length}</div>
            <div className="stat-label">Not Updated Yet</div>
          </div>
        </div>

        {/* Fees List */}
        {fetching ? (
          <div style={{ textAlign: "center", padding: 60 }}>
            <div className="spinner" style={{ margin: "0 auto" }}></div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {feesStatus.map(({ feesType, paid, updatedAt }) => (
              <div key={feesType} className="card" style={{
                borderLeft: `4px solid ${paid === true ? "#48bb78" : paid === false ? "#fc8181" : "#a0aec0"}`,
                position: "relative", overflow: "hidden"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{feesType}</div>
                    {updatedAt && (
                      <div style={{ fontSize: 12, color: "#a0aec0" }}>
                        Updated: {new Date(updatedAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <div style={{
                    padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 700,
                    background: paid === true ? "rgba(72,187,120,0.15)" : paid === false ? "rgba(252,129,129,0.15)" : "rgba(160,174,192,0.15)",
                    color: paid === true ? "#48bb78" : paid === false ? "#fc8181" : "#a0aec0"
                  }}>
                    {paid === true ? "✅ Paid" : paid === false ? "❌ Pending" : "— N/A"}
                  </div>
                </div>
                {paid === false && (
                  <div style={{
                    marginTop: 12, padding: "8px 12px", background: "rgba(252,129,129,0.08)",
                    borderRadius: 8, fontSize: 13, color: "#fc8181"
                  }}>
                    ⚠️ Please pay your {feesType} at the office.
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}