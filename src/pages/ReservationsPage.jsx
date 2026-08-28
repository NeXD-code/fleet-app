import { useEffect, useState } from "react";

export default function ReservationsPage({
  reservations,
  vehicles,
  sites,
  users,
  loadReservations,
}) {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const siteName = (id) =>
    sites.find((s) => s.id === id)?.name || "—";

  const vehicleName = (id) =>
    vehicles.find((v) => v.id === id)?.name || "—";

  // =====================
  // CANCEL
  // =====================
  function handleCancelReservation(id) {
    fetch(`http://localhost:3001/api/reservations/${id}/cancel`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cancelled_by_user_id: 4 }),
    })
      .then(() => {
        loadReservations();
        setSuccess("Réservation annulée");
      })
      .catch((err) => setError(err.message));
  }

  return (
    <div style={{ padding: 20 }}>

      <h1>Réservations</h1>

      {error && <p style={{ color: "red" }}>{error}</p>}
      {success && <p style={{ color: "green" }}>{success}</p>}

      {reservations.length === 0 ? (
        <p>Aucune réservation</p>
      ) : (
        reservations.map((r) => (
          <div
            key={r.id}
            style={{
              border: "1px solid #ccc",
              padding: 10,
              marginBottom: 10,
            }}
          >
            <h3>
              {vehicleName(r.vehicleId)} — {r.user}
            </h3>

            <p>
              {siteName(r.fromSiteId)} → {siteName(r.toSiteId)}
            </p>

            <p>
              {r.start} → {r.end}
            </p>

            <p>
              <strong>Statut :</strong> {r.status}
            </p>

            {r.status === "active" && (
              <button onClick={() => handleCancelReservation(r.id)}>
                Annuler
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}