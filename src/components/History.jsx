export default function History({ reservations }) {
  const completed = reservations.filter(
    (r) => r.status === "completed" || r.status === "cancelled"
  );

  return (
    <div>
      <h2>Historique</h2>

      {completed.map((r) => (
        <div key={r.id} style={{ border: "1px solid #ccc", margin: 5, padding: 10 }}>
          <p>{r.vehicleId}</p>
          <p>{r.user}</p>
          <p>{r.start} → {r.end}</p>
          <p>{r.status}</p>
        </div>
      ))}
    </div>
  );
}