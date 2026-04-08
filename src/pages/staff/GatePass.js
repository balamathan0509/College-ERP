// src/pages/staff/GatePass.js
import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { sendEmail } from "../../utils/notifications";

export default function StaffGatePass() {
  const { userProfile } = useAuth();
  const [passes, setPasses] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [actionLoading, setActionLoading] = useState("");

  async function fetchPasses() {
    setFetching(true);
    try {
      const q = query(
        collection(db, "gate_pass"),
        where("dept", "==", userProfile.dept),
        where("status", "==", "pending_staff")
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setPasses(list);
    } catch (err) {}
    setFetching(false);
  }

  async function handleAction(pass, action) {
    setActionLoading(pass.id + action);
    try {
      await updateDoc(doc(db, "gate_pass", pass.id), {
        status: action === "approve" ? "pending_hod" : "rejected",
        staffActionAt: new Date().toISOString(),
        staffName: userProfile.name
      });

      if (action === "approve") {
        // Email to HOD
        const hodQ = query(
          collection(db, "users"),
          where("role", "==", "hod"),
          where("dept", "==", userProfile.dept)
        );
        const hodSnap = await getDocs(hodQ);
        const hodList = hodSnap.docs.map(d => d.data());

        for (const hod of hodList) {
          if (hod.email) {
            await sendEmail({
              toEmail: hod.email,
              toName: hod.name,
              subject: `🚪 Gate Pass Approved by Staff — ${pass.studentName}`,
              message: `Hi ${hod.name},

${pass.studentName} (${pass.registerNo}, ${pass.year} - ${pass.dept})'s gate pass has been approved by ${userProfile.name} (Staff) and requires your final approval.

📋 Reason: ${pass.reason}
📍 Place: ${pass.place}
🕐 Out: ${pass.outDate} at ${pass.outTime}
🕐 In: ${pass.inDate} at ${pass.inTime}
📞 Phone: ${pass.phone || "Not provided"}

Please login to College Portal to give Final Approval or Reject.

Regards,
College Portal`
            });
          }
        }
      } else {
        // Rejected — email to student
        if (pass.studentEmail) {
          await sendEmail({
            toEmail: pass.studentEmail,
            toName: pass.studentName,
            subject: `❌ Gate Pass Rejected — ${pass.reason}`,
            message: `Hi ${pass.studentName},

Your gate pass request has been rejected by ${userProfile.name} (Staff, ${userProfile.dept}).

📋 Reason: ${pass.reason}
📍 Place: ${pass.place}
🕐 Out: ${pass.outDate} at ${pass.outTime}

If you have any queries, please contact your class staff directly.

Regards,
College Portal`
          });
        }
      }

      setPasses(prev => prev.filter(p => p.id !== pass.id));
    } catch (err) {}
    setActionLoading("");
  }

  useEffect(() => { fetchPasses(); }, []);

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1>🚪 Gate Pass Approvals</h1>
          <p>Pending requests from {userProfile?.dept} students</p>
        </div>

        {fetching ? (
          <div style={{ textAlign: "center", padding: 60 }}><div className="spinner" style={{ margin: "0 auto" }}></div></div>
        ) : passes.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <p style={{ color: "#a0aec0", fontSize: 16 }}>No pending gate pass requests!</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {passes.map(pass => (
              <div key={pass.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(233,69,96,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🎒</div>
                      <div>
                        <div style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 16 }}>{pass.studentName}</div>
                        <div style={{ color: "#a0aec0", fontSize: 13 }}>{pass.registerNo} • {pass.year} • {pass.dept}</div>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: 16 }}>
                      <div><div style={{ fontSize: 11, color: "#a0aec0", marginBottom: 4 }}>REASON</div><div style={{ fontWeight: 600, fontSize: 14 }}>{pass.reason}</div></div>
                      <div><div style={{ fontSize: 11, color: "#a0aec0", marginBottom: 4 }}>PLACE</div><div style={{ fontWeight: 600, fontSize: 14 }}>📍 {pass.place}</div></div>
                      <div><div style={{ fontSize: 11, color: "#a0aec0", marginBottom: 4 }}>OUT</div><div style={{ fontWeight: 600, fontSize: 14 }}>{pass.outDate} {pass.outTime}</div></div>
                      <div><div style={{ fontSize: 11, color: "#a0aec0", marginBottom: 4 }}>IN</div><div style={{ fontWeight: 600, fontSize: 14 }}>{pass.inDate} {pass.inTime}</div></div>
                      {pass.phone && <div><div style={{ fontSize: 11, color: "#a0aec0", marginBottom: 4 }}>PHONE</div><div style={{ fontWeight: 600, fontSize: 14 }}>📞 {pass.phone}</div></div>}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 160 }}>
                    <button onClick={() => handleAction(pass, "approve")} disabled={!!actionLoading} style={{
                      padding: "12px 20px", borderRadius: 10, border: "1px solid rgba(72,187,120,0.3)",
                      background: "rgba(72,187,120,0.15)", color: "#48bb78", fontWeight: 700, fontSize: 14, cursor: "pointer"
                    }}>
                      {actionLoading === pass.id + "approve" ? "..." : "✅ Approve → HOD"}
                    </button>
                    <button onClick={() => handleAction(pass, "reject")} disabled={!!actionLoading} style={{
                      padding: "12px 20px", borderRadius: 10, border: "1px solid rgba(252,129,129,0.3)",
                      background: "rgba(252,129,129,0.1)", color: "#fc8181", fontWeight: 700, fontSize: 14, cursor: "pointer"
                    }}>
                      {actionLoading === pass.id + "reject" ? "..." : "❌ Reject"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}