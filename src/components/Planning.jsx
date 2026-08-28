export default function Planning({ reservations }) {
  const grouped = reservations.reduce((acc, r) => {
    const day = new Date(r.start).toDateString();

    if (!acc[day]) acc[day] = [];
    acc[day].push(r);

    return acc;
  }, {});

  return (
    <div>
      <h2>Planning</h2>

      {Object.entries(grouped).map(([day, list]) => (
        <div key={day} style={{ marginBottom: 20 }}>
          <h3>{day}</h3>

          {list.map((r) => (
            <div key={r.id} style={{ padding: 5, borderBottom: "1px solid #ddd" }}>
              {r.user} — {r.vehicleId}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}