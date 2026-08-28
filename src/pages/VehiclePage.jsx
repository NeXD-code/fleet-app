export default function VehiclePage({
  selectedVehicle,
  setCurrentPage,
  setSelectedVehicle,
  reservations = [],
  maintenanceHistory = [],
}) {
  if (!selectedVehicle) return null;

  const vehicleReservations = reservations.filter(
    (r) => r.vehicleId === selectedVehicle.id
  );

  const vehicleMaintenances = maintenanceHistory.filter(
    (m) => `v${m.vehicle_id}` === selectedVehicle.id
  );

  const completedReservations = vehicleReservations.filter(
    (r) => r.status === "completed"
  );

  const totalKm = completedReservations.reduce((sum, r) => {
    const start = Number(r.startMileage);
    const end = Number(r.endMileage);
    if (isNaN(start) || isNaN(end)) return sum;
    return sum + (end - start);
  }, 0);

  const lastReservation =
    completedReservations
      .slice()
      .sort((a, b) => new Date(b.end) - new Date(a.end))[0];

  return (
    <div style={{ padding: 20 }}>
      <button
        onClick={() => {
          setCurrentPage("fleet");
          setSelectedVehicle(null);
        }}
      >
        ← Retour flotte
      </button>

      <h1>{selectedVehicle.name}</h1>

      <p><strong>Immat :</strong> {selectedVehicle.plate}</p>
      <p><strong>Statut :</strong> {selectedVehicle.status}</p>

      <hr />

      <h3>Stats</h3>

      <p>Total km : {totalKm}</p>
      <p>Trajets : {completedReservations.length}</p>

      <p>
        Dernier usage :{" "}
        {lastReservation ? lastReservation.end : "—"}
      </p>

      <p>Maintenances : {vehicleMaintenances.length}</p>
    </div>
  );
}