import { useEffect, useMemo, useState } from "react";

export default function FleetPage({
  setCurrentPage,
  setSelectedVehicle,
}) {
  const [vehicles, setVehicles] = useState([]);
  const [maintenanceHistory, setMaintenanceHistory] = useState([]);

  const [maintenanceVehicle, setMaintenanceVehicle] = useState(null);
  const [maintenanceReasons, setMaintenanceReasons] = useState([]);

  const [error, setError] = useState("");

  // ======================
  // LOAD DATA
  // ======================
  useEffect(() => {
    loadVehicles();
    loadMaintenanceHistory();
  }, []);

  function loadVehicles() {
    fetch("http://localhost:3001/api/vehicles")
      .then((res) => res.json())
      .then((data) => {
        setVehicles(
          data.map((v) => ({
            id: `v${v.id}`,
            name: v.internal_name,
            plate: v.registration_number,
            type: v.vehicle_type,
            status: v.status,
            currentSiteName: v.current_site_name,
            originSiteName: v.origin_site_name,
          }))
        );
      });
  }

  function loadMaintenanceHistory() {
    fetch("http://localhost:3001/api/maintenance")
      .then((res) => res.json())
      .then(setMaintenanceHistory);
  }

  // ======================
  // MAINTENANCE LOGIC
  // ======================
  function toggleMaintenance(vehicle) {
    if (vehicle.status !== "maintenance") {
      setMaintenanceVehicle(vehicle);
      return;
    }

    fetch(
      `http://localhost:3001/api/vehicles/${vehicle.id.replace("v", "")}/available`,
      { method: "PATCH" }
    )
      .then(() => {
        loadVehicles();
        loadMaintenanceHistory();
      });
  }

  function validateMaintenance() {
    if (maintenanceReasons.length === 0) {
      setError("Choisis une raison");
      return;
    }

    const reason = maintenanceReasons.join(", ");

    fetch("http://localhost:3001/api/maintenance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vehicle_id: Number(maintenanceVehicle.id.replace("v", "")),
        declared_by_user_id: 4,
        reason,
      }),
    }).then(() => {
      setMaintenanceVehicle(null);
      setMaintenanceReasons([]);
      loadVehicles();
      loadMaintenanceHistory();
    });
  }

  // ======================
  // UI
  // ======================
  return (
    <div style={{ padding: 20 }}>

      <h1>Flotte</h1>

      {vehicles.map((vehicle) => (
        <div
          key={vehicle.id}
          style={{
            border: "1px solid #ccc",
            padding: 10,
            marginBottom: 10,
          }}
        >
          <h3>{vehicle.name}</h3>

          <p>{vehicle.plate} — {vehicle.type}</p>

          <p><strong>Statut :</strong> {vehicle.status}</p>

          <p><strong>Site :</strong> {vehicle.currentSiteName}</p>

          <button
            onClick={() => {
              setSelectedVehicle(vehicle);
              setCurrentPage("vehicle");
            }}
          >
            Voir la fiche
          </button>

          <button
            style={{ marginLeft: 10 }}
            onClick={() => toggleMaintenance(vehicle)}
          >
            {vehicle.status === "maintenance"
              ? "Remettre disponible"
              : "Maintenance"}
          </button>
        </div>
      ))}

      {/* ================= POPUP MAINTENANCE ================= */}
      {maintenanceVehicle && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}>
          <div style={{ background: "#fff", padding: 20, width: 400 }}>
            <h2>Maintenance</h2>

            <p>{maintenanceVehicle.name}</p>

            <textarea
              placeholder="Raison"
              onChange={(e) =>
                setMaintenanceReasons([e.target.value])
              }
              style={{ width: "100%" }}
            />

            <button onClick={validateMaintenance}>
              Valider
            </button>

            <button onClick={() => setMaintenanceVehicle(null)}>
              Annuler
            </button>

            {error && <p style={{ color: "red" }}>{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}