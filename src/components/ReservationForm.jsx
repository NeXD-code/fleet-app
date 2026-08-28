import { useState } from "react";

export default function ReservationForm({
  vehicles,
  users,
  sites,
  loadReservations,
}) {
  const [form, setForm] = useState({
    vehicleId: "",
    user: "",
    fromSiteId: "",
    toSiteId: "",
    start: "",
    end: "",
  });

  const [error, setError] = useState("");

  function submit() {
    if (!form.vehicleId || !form.user) {
      setError("Champs obligatoires");
      return;
    }

    fetch("http://localhost:3001/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vehicle_id: Number(form.vehicleId.replace("v", "")),
        user_id: Number(form.user.replace("u", "")),
        from_site_id: Number(form.fromSiteId.replace("s", "")),
        to_site_id: Number(form.toSiteId.replace("s", "")),
        start_at: form.start,
        end_at: form.end,
      }),
    })
      .then(() => {
        loadReservations();
        setForm({
          vehicleId: "",
          user: "",
          fromSiteId: "",
          toSiteId: "",
          start: "",
          end: "",
        });
      })
      .catch((err) => setError(err.message));
  }

  return (
    <div>
      <h2>Créer réservation</h2>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <button onClick={submit}>Créer</button>
    </div>
  );
}