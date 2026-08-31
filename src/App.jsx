import React, { useMemo, useState, useEffect } from "react";

const initialSites = [];

const initialVehicles = [
  { id: "v1", name: "Camion 1", plate: "AB-123-CD", type: "Camion", siteId: "s1", status: "available" },
  { id: "v2", name: "Camion 2", plate: "EF-456-GH", type: "Utilitaire", siteId: "s1", status: "available" },
  { id: "v3", name: "Camion 3", plate: "IJ-789-KL", type: "Camion", siteId: "s2", status: "maintenance" },
  { id: "v4", name: "Camion 4", plate: "MN-234-OP", type: "Fourgon", siteId: "s3", status: "available" },
];

function formatDate(value) {
  const d = new Date(value);
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}
function formatDuration(start, end) {
  const s = new Date(start);
  const e = new Date(end);

  const diffMs = e - s;
  if (isNaN(diffMs)) return "—";

  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);
  const باقيMinutes = minutes % 60;

  return `${hours}h ${باقيMinutes}min`;
}
function formatDurationSmart(start, end) {
  const s = new Date(start);
  const e = new Date(end);

  const diffMs = e - s;
  if (isNaN(diffMs)) return "—";

  const totalHours = diffMs / (1000 * 60 * 60);

  // 🔥 MODE JOURNÉE
  if (totalHours >= 24) {
    const days = Math.floor(totalHours / 24);
    const hours = Math.floor(totalHours % 24);

    return hours > 0
      ? `${days} jour(s) ${hours}h`
      : `${days} jour(s)`;
  }

  // 🔥 MODE HEURES CLASSIQUE
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  return `${hours}h ${mins}min`;
}

function cleanValue(v) {
  if (v === null || v === undefined) return null;

  const val = String(v).trim();

  if (
    val === "_" ||
    val === "" ||
    val.toLowerCase() === "null" ||
    val.toLowerCase() === "undefined"
  ) {
    return null;
  }

  return val;
}

function formatMileage(value) {
  if (value === null || value === undefined || value === "") return "—";

  const num = Number(String(value).replace(/\s/g, ""));

  if (isNaN(num)) return "—";

  return num.toLocaleString("fr-FR");
}

function formatMileageInput(value) {
  const digits = value.replace(/\D/g, "");

  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function getUpcomingReservationsForVehicle(vehicleId, reservations) {
  const now = new Date();

  return reservations
    .filter(
      (r) =>
        r.vehicleId === vehicleId &&
        normalizeStatus(r.status) === "active" &&
        new Date(r.end) >= now
    )
    .sort((a, b) => new Date(a.start) - new Date(b.start))
    .slice(0, 3);
}

function formatDayLabel(value) {
  const d = new Date(value);
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

function getPurposeColor(purpose) {
  switch (purpose) {
    case "Livraison": return "#4A7BA7";
    case "Archive": return "#A8927A";
    case "Vide Maison": return "#5C7A5A";
    case "Déchetterie": return "#C0572A";
    case "Usage Personnel": return "#7A5C8A";
    default: return "#6b7280";
  }
}

function normalizeStatus(status) {
  if (!status) return "unknown";

  const s = status.toLowerCase();

  if (s === "active") return "active";
  if (s === "completed") return "completed";
  if (s === "cancelled" || s === "canceled") return "cancelled";

  return "unknown";
}

function normalizeReservation(r) {
  return {
    id: `r${r.id}`,

    vehicleId: `v${r.vehicle_id}`,
    fromSiteId: `s${r.from_site_id}`,
    toSiteId: `s${r.to_site_id}`,

    user: r.user_name ?? "Inconnu",

    start: r.start_at,
    end: r.end_at,

    purpose: r.purpose ?? "",

    status: normalizeStatus(r.status),

    startMileage: r.start_mileage ?? null,

    departureNotes: r.departure_notes ?? "",

    endMileage:
  r.end_mileage === "_" ||
  r.end_mileage === "" ||
  r.end_mileage === "null" ||
  r.end_mileage === "undefined"
    ? null
    : r.end_mileage,

returnNotes:
  r.return_notes === "_" ||
  r.return_notes === "" ||
  r.return_notes === "null" ||
  r.return_notes === "undefined"
    ? null
    : r.return_notes,
  };
}


export default function App() {
  const [sites, setSites] = useState(initialSites);
  const [vehicles, setVehicles] = useState(initialVehicles);
  const [reservations, setReservations] = useState([]);
  const [users, setUsers] = useState([]);

  const [filterSite, setFilterSite] = useState("all");
  const [filterVehicle, setFilterVehicle] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [reservationToComplete, setReservationToComplete] = useState(null);

  const [isCompleting, setIsCompleting] = useState(false);
  const [maintenanceReasons, setMaintenanceReasons] = useState([]);
  const [maintenanceVehicle, setMaintenanceVehicle] = useState(null);
  const [maintenanceError, setMaintenanceError] = useState("");
  const [maintenanceHistoryOpen, setMaintenanceHistoryOpen] = useState(false);
  const [maintenanceHistory, setMaintenanceHistory] = useState([]);

  const [historyOpen, setHistoryOpen] = useState(false);

  const [currentPage, setCurrentPage] = useState("fleet");
  const [selectedVehicle, setSelectedVehicle] = useState(null);

  const [historyFilterVehicle, setHistoryFilterVehicle] = useState("all");
const [historyFilterUser, setHistoryFilterUser] = useState("all");

const [search, setSearch] = useState("");
const [currentUser, setCurrentUser] = useState(null);

const [weekOffset, setWeekOffset] = useState(0);

const [documents, setDocuments] = useState([]);
const [docLabel, setDocLabel] = useState("");
const [docFile, setDocFile] = useState(null);

const [adminSection, setAdminSection] = useState("sites");
const [newSiteName, setNewSiteName] = useState("");
const [newVehicle, setNewVehicle] = useState({ internal_name: "", registration_number: "", vehicle_type: "Voiture", origin_site_id: "", current_site_id: "", fuel_type: "" });
const [newUser, setNewUser] = useState({ first_name: "", last_name: "", email: "", role: "employee", is_authorized_driver: 1, site_id: "" });
const [editingUser, setEditingUser] = useState(null);
const [editingVehicle, setEditingVehicle] = useState(null);

const [vehicleReports, setVehicleReports] = useState([]);
  
const [vehicleSettingsForm, setVehicleSettingsForm] = useState({
  ctExpiryDate: "",
  revisionIntervalKm: "",
  lastRevisionKm: "",
  fuelType: "",
});
  
  const maintenanceOptions = [
  "Panne moteur",
  "Batterie HS",
  "Pneu crevé",
  "Freinage",
  "Carrosserie",
  "Éclairage",
  "Révision",
  "Contrôle technique",
  "Autre",
];;

const [returnForm, setReturnForm] = useState({
  endMileage: "",
  returnNotes: "",
});
  

  const [form, setForm] = useState({
    vehicleId: "",
    user: "",
    fromSiteId: "",
    toSiteId: "",
    start: "",
    end: "",
    purpose: "",

     startMileage: "",
  departureNotes: "",

  });

  async function loadDocuments(vehicleId) {
  try {
    const id = vehicleId.replace("v", "");
    const res = await fetch(`https://fleet-app-1j2a.onrender.com/api/vehicles/${id}/documents`);
    const data = await res.json();
    setDocuments(data);
  } catch (err) {
    console.error("Erreur chargement documents :", err);
  }
}

async function loadVehicleReports(vehicleId) {
  try {
    const id = vehicleId.replace("v", "");
    const res = await fetch(`https://fleet-app-1j2a.onrender.com/api/vehicles/${id}/reports`);
    const data = await res.json();
    setVehicleReports(data);
  } catch (err) {
    console.error("Erreur chargement reports :", err);
  }
}

  async function loadVehicles() {
  try {
    const res = await fetch("https://fleet-app-1j2a.onrender.com/api/vehicles");
    const data = await res.json();

    const mappedVehicles = data.map((v) => ({
  id: `v${v.id}`,
  name: v.internal_name,
  plate: v.registration_number,
  type: v.vehicle_type,
  siteId: `s${v.origin_site_id}`,
  currentSiteId: `s${v.current_site_id}`,
  status: v.status,
  originSiteName: v.origin_site_name,
  currentSiteName: v.current_site_name,
  ctExpiryDate: v.ct_expiry_date || null,
  revisionIntervalKm: v.revision_interval_km || null,
  lastRevisionKm: v.last_revision_km || null,
  fuelType: v.fuel_type || null,
}));

    setVehicles(mappedVehicles);
  } catch (err) {
    console.error("Erreur chargement véhicules :", err);
  }
}

function handleSaveVehicleSettings() {
  console.log("SAVE SETTINGS:", selectedVehicle.id, vehicleSettingsForm);
  fetch(`https://fleet-app-1j2a.onrender.com/api/vehicles/${selectedVehicle.id.replace("v", "")}/settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ct_expiry_date: vehicleSettingsForm.ctExpiryDate || null,
      revision_interval_km: vehicleSettingsForm.revisionIntervalKm || null,
      last_revision_km: vehicleSettingsForm.lastRevisionKm || null,
    }),
  })
    .then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur sauvegarde.");
      return data;
    })
    .then(async () => {
  console.log("SETTINGS SAVED OK");
  await loadVehicles();
  const res = await fetch("https://fleet-app-1j2a.onrender.com/api/vehicles");
  const data = await res.json();
  const updated = data.find((v) => `v${v.id}` === selectedVehicle.id);
  if (updated) {
    setSelectedVehicle({
      ...selectedVehicle,
      ctExpiryDate: updated.ct_expiry_date || null,
      revisionIntervalKm: updated.revision_interval_km || null,
      lastRevisionKm: updated.last_revision_km || null,
    });
  }
  setSuccess("Informations sauvegardées.");
})
    .catch((err) => {
      console.log("ERREUR SETTINGS:", err);
      setError(err.message);
    });
}
async function loadReservations() {
  try {
    const res = await fetch("https://fleet-app-1j2a.onrender.com/api/reservations");
    const data = await res.json();
console.log("RAW END MILEAGE:", data?.map(r => r.end_mileage));
console.log("RAW RETURN NOTES:", data?.map(r => r.return_notes));
    const mappedReservations = data.map(normalizeReservation);

    setReservations(mappedReservations);
  } catch (err) {
    console.error("Erreur chargement réservations :", err);
  }
}

async function loadMaintenanceHistory() {
  try {
    const res = await fetch("https://fleet-app-1j2a.onrender.com/api/maintenance");
    const data = await res.json();

    setMaintenanceHistory(data);
  } catch (err) {
    console.error("Erreur chargement maintenance :", err);
  }
}
useEffect(() => {
  loadMaintenanceHistory();
}, []);

  useEffect(() => {
    loadVehicles();
  }, []);

  useEffect(() => {
    fetch("https://fleet-app-1j2a.onrender.com/api/sites")
      .then((res) => res.json())
      .then((data) => {
        const mappedSites = data.map((s) => ({
          id: `s${s.id}`,
          name: s.name,
        }));

        setSites(mappedSites);
      })
      .catch((err) => console.error("Erreur chargement sites :", err));
  }, []);

  useEffect(() => {
  loadReservations();
}, []);

  useEffect(() => {
    fetch("https://fleet-app-1j2a.onrender.com/api/users")
      .then((res) => res.json())
      .then((data) => {
        setUsers(data);
      })
      .catch((err) => console.error("Erreur chargement utilisateurs :", err));
  }, []);

  const siteName = (siteId) => sites.find((s) => s.id === siteId)?.name || "—";
  const vehicleName = (vehicleId) => vehicles.find((v) => v.id === vehicleId)?.name || "—";

  const enrichedVehicles = useMemo(() => vehicles, [vehicles]);

 const visibleVehicles = enrichedVehicles.filter((v) => {
  const siteOk =
    filterSite === "all" ||
    v.currentSiteId === filterSite ||
    v.siteId === filterSite;

  const vehicleOk = filterVehicle === "all" || v.id === filterVehicle;
  const statusOk = filterStatus === "all" || v.status === filterStatus;

  const searchOk =
    search === "" ||
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.plate.toLowerCase().includes(search.toLowerCase());

  return siteOk && vehicleOk && statusOk && searchOk;
});


const visibleReservations = reservations
  .filter((r) => normalizeStatus(r.status) === "active")
  .filter((r) =>
    filterSite === "all"
      ? true
      : r.fromSiteId === filterSite || r.toSiteId === filterSite
  )
  .filter((r) =>
    filterVehicle === "all" ? true : r.vehicleId === filterVehicle
  )
  .filter((r) =>
    search === ""
      ? true
      : vehicleName(r.vehicleId).toLowerCase().includes(search.toLowerCase()) ||
        r.user.toLowerCase().includes(search.toLowerCase())
  )
  .sort((a, b) => new Date(a.start) - new Date(b.start));

const upcomingReservationsByVehicle = visibleVehicles.reduce((acc, vehicle) => {
  acc[vehicle.id] = getUpcomingReservationsForVehicle(vehicle.id, reservations);
  return acc;
}, {});


const reservationsByDay = visibleReservations.reduce((acc, reservation) => {
  const dayKey = new Date(reservation.start).toDateString();

  if (!acc[dayKey]) {
    acc[dayKey] = [];
  }

  acc[dayKey].push(reservation);
  return acc;
}, {});

function hasConflict(vehicleId, start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end);

  return reservations.some((r) => {
    if (r.vehicleId !== vehicleId) return false;
    if (normalizeStatus(r.status) !== "active") return false;

    const rStart = new Date(r.start);
    const rEnd = new Date(r.end);

    return startDate < rEnd && endDate > rStart;
  });
}

  function handleCreateReservation() {
  setError("");
  setSuccess("");
  console.log("FORM DEBUG:", form);
 const startDate = new Date(form.start);
const endDate = new Date(form.end);

const diffMs = endDate - startDate;

if (diffMs <= 0) {
  setError("La date de fin doit être après la date de début.");
  return;
} 
const requiredFields = [
  form.vehicleId,
  form.user,
  form.fromSiteId,
  form.toSiteId,
  form.start,
  form.end,
];

if (requiredFields.some((f) => f === "" || f === null || f === undefined)) {
  setError("Merci de remplir tous les champs obligatoires.");
  return;
}
console.log("VALUES CHECK:", {
  vehicleId: form.vehicleId,
  user: form.user,
  fromSiteId: form.fromSiteId,
  toSiteId: form.toSiteId,
  start: form.start,
  end: form.end,
});

   const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
if (new Date(form.start) < fiveMinutesAgo) {
  setError("La date de début ne peut pas être dans le passé.");
  return;
}


    if (new Date(form.start) >= new Date(form.end)) {
      setError("La date de fin doit être après la date de début.");
      return;
    }

    const selectedUser = users.find((u) => `u${u.id}` === form.user);

    if (!selectedUser) {
      setError("Utilisateur introuvable.");
      return;
    }
   if (form.startMileage === "" || form.startMileage === null) {
  setError("Le kilométrage de départ est obligatoire.");
  return;
}

const enteredMileage = Number(String(form.startMileage).replace(/\s/g, ""));

const vehicleCompletedReservations = reservations
  .filter(
    (r) =>
      r.vehicleId === form.vehicleId &&
      normalizeStatus(r.status) === "completed" && r.purpose !== "Initialisation" &&
      r.endMileage !== null
  )
  .sort((a, b) => new Date(b.end) - new Date(a.end));

const lastKnownMileage = vehicleCompletedReservations[0]
  ? Number(vehicleCompletedReservations[0].endMileage)
  : null;

if (lastKnownMileage !== null && enteredMileage < lastKnownMileage) {
  setError(
    `Le kilométrage saisi (${enteredMileage.toLocaleString("fr-FR")} km) est inférieur au dernier kilométrage connu (${lastKnownMileage.toLocaleString("fr-FR")} km). Vérifiez le compteur.`
  );
  return;
}
if (!form.departureNotes || !form.departureNotes.trim()) {
  setError("L'état du véhicule au départ est obligatoire.");
  return;
}
if (!form.purpose || !form.purpose.trim()) {
  setError("Le motif de la réservation est obligatoire.");
  return;
}
if (hasConflict(form.vehicleId, form.start, form.end)) {
  setError("Ce véhicule est déjà réservé sur ce créneau.");
  return;
}

    fetch("https://fleet-app-1j2a.onrender.com/api/reservations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
  vehicle_id: Number(form.vehicleId.replace("v", "")),
user_id: Number(form.user.replace("u", "")),
from_site_id: Number(form.fromSiteId.replace("s", "")),
to_site_id: Number(form.toSiteId.replace("s", "")),
  start_at: form.start,
  end_at: form.end,
  purpose: form.purpose || "",
  start_mileage: Number(String(form.startMileage).replace(/\s/g, "")) || null,
  departure_notes: form.departureNotes || "",
})
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Erreur lors de la création de la réservation.");
        }
        return data;
      })
      .then((created) => {
        const newReservation = {
          id: `r${created.id}`,
          vehicleId: `v${created.vehicle_id}`,
          user: `${selectedUser.first_name} ${selectedUser.last_name}`,
          fromSiteId: `s${created.from_site_id}`,
          toSiteId: `s${created.to_site_id}`,
          start: created.start_at,
          end: created.end_at,
          purpose: created.purpose || "",
          status: created.status,
          startMileage: created.start_mileage,
departureNotes: created.departure_notes,
        };

        loadReservations();

        setSuccess("Réservation créée avec succès.");

        setForm({
          vehicleId: "",
          user: "",
          fromSiteId: "",
          toSiteId: "",
          start: "",
          end: "",
          purpose: "",
          startMileage: "",
departureNotes: "",
        });
      })
      .catch((err) => {
        setError(err.message);
      });
  }

  function handleCancelReservation(reservationId) {
    setError("");
    setSuccess("");

    fetch(`https://fleet-app-1j2a.onrender.com/api/reservations/${String(reservationId).replace(/^r/, "")}/cancel`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
  cancelled_by_user_id: currentUser ? currentUser.id : 4,
}),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Erreur lors de l'annulation.");
        }
        return data;
      })
      .then(() => {
  loadReservations();
  setSuccess("Réservation annulée.");
})
      .catch((err) => {
        setError(err.message);
      });
  }

function handleCompleteReservation() {
  if (!reservationToComplete) return;
  if (isCompleting) return;

  setError("");
  setSuccess("");
  setIsCompleting(true);

const mileageOk =
  returnForm.endMileage !== "" &&
  returnForm.endMileage !== null &&
  returnForm.endMileage !== undefined;

if (!mileageOk) {
  setError("Le kilométrage retour est obligatoire.");
  setIsCompleting(false);
  return;
}

if (!returnForm.returnNotes || !returnForm.returnNotes.trim()) {
  setError("L'état du véhicule au retour est obligatoire.");
  setIsCompleting(false);
  return;
}
const endMileage = Number(
  String(returnForm.endMileage).replace(/\s/g, "")
);

const startMileage = Number(reservationToComplete?.startMileage);

const distance =
  startMileage !== null &&
  endMileage !== null &&
  !isNaN(startMileage) &&
  !isNaN(endMileage)
    ? endMileage - startMileage
    : null;

// validation logique km
if (endMileage <= startMileage) {
  setError(
    `Le kilométrage retour doit être supérieur au kilométrage de départ (${formatMileage(
      startMileage
    )} km).`
  );
  setIsCompleting(false);
  return;
}

 const reservationId = String(reservationToComplete.id).replace(/^r/, "");
console.log("COMPLETE RESERVATION ID:", reservationId);

fetch(
  `https://fleet-app-1j2a.onrender.com/api/reservations/${reservationId}/complete`,
  {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      end_mileage: Number(
        String(returnForm.endMileage).replace(/\s/g, "")
      ),
      return_notes: returnForm.returnNotes?.trim() || null,
    }),
  }
)
    .then(async (res) => {
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Erreur lors de la clôture.");
  }
  return data;
})
.then((data) => {
  console.log("COMPLETE RESPONSE:", data);
  return data;
})
    .then(() => {
      loadReservations();
      loadVehicles();

      setReservationToComplete(null);

      setReturnForm({
        endMileage: "",
        returnNotes: "",
      });

      setSuccess("Réservation terminée.");
    })
    .catch((err) => {
      setError(err.message);
    })
    .finally(() => {
      setIsCompleting(false);
    });
}

 function toggleMaintenance(vehicleId) {
  console.log("CLICK MAINTENANCE", vehicleId);
  setError("");
  setSuccess("");

  const vehicle = vehicles.find((v) => v.id === vehicleId);

  if (!vehicle) {
    setError("Véhicule introuvable.");
    return;
  }

  // Ouvre la popup de choix des pannes
  if (vehicle.status !== "maintenance") {
    console.log("OUVERTURE POPUP");
    setMaintenanceVehicle(vehicle);
    return;
  }

  // Remise disponible
  fetch(`https://fleet-app-1j2a.onrender.com/api/vehicles/${vehicleId.replace("v", "")}/available`, {
  method: "PATCH",
})
  .then(async (res) => {
    const text = await res.text(); // IMPORTANT (pas json direct)
    let data;

    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    if (!res.ok) {
      throw new Error(data.error || "Erreur remise disponible");
    }

    return data;
  })
  .then(() => {
    loadVehicles();
    loadMaintenanceHistory();
    setSuccess("Véhicule remis disponible.");
  })
  .catch((err) => {
    console.error("ERROR AVAILABLE:", err);
    setError(err.message);
  });
}

  const stats = {
    total: vehicles.length,
    available: vehicles.filter((v) => v.status === "available").length,
    maintenance: vehicles.filter((v) => v.status === "maintenance").length,
    reservations: reservations.filter(
  (r) =>
    normalizeStatus(r.status) === "active" &&
    new Date(r.end) > new Date()
).length,
history: reservations.filter(
  (r) => normalizeStatus(r.status) === "completed" && r.purpose !== "Initialisation"
).length,
  };
const historyByMonth = useMemo(() => {
  return reservations
    .filter(
      (r) =>
        (normalizeStatus(r.status) === "completed" && r.purpose !== "Initialisation") ||
        normalizeStatus(r.status) === "cancelled"
    )
    .slice()
    .sort((a, b) => new Date(b.end) - new Date(a.end)) // + récent en premier
    .reduce((acc, r) => {
      const date = new Date(r.end);

      const monthKey = date.toLocaleDateString("fr-FR", {
        year: "numeric",
        month: "long",
      });

      const dayKey = date.toLocaleDateString("fr-FR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });

      if (!acc[monthKey]) acc[monthKey] = {};
      if (!acc[monthKey][dayKey]) acc[monthKey][dayKey] = [];

      acc[monthKey][dayKey].push(r);

      return acc;
    }, {});
}, [reservations]);
Object.keys(historyByMonth).forEach((month) => {
  Object.keys(historyByMonth[month]).forEach((day) => {
    historyByMonth[month][day].sort(
      (a, b) => new Date(b.end) - new Date(a.end)
    );
  });
});
const maintenanceByMonth = useMemo(() => {
  return maintenanceHistory
    .slice()
    .sort(
      (a, b) => new Date(b.start_at) - new Date(a.start_at)
    )
    .reduce((acc, m) => {
      const date = new Date(m.start_at);

      const monthKey = date.toLocaleDateString("fr-FR", {
        year: "numeric",
        month: "long",
      });

      const dayKey = date.toLocaleDateString("fr-FR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });

      if (!acc[monthKey]) acc[monthKey] = {};
      if (!acc[monthKey][dayKey]) acc[monthKey][dayKey] = [];

      acc[monthKey][dayKey].push(m);

      return acc;
    }, {});
}, [maintenanceHistory]);
const vehicleReservations = selectedVehicle
  ? reservations.filter(
      (r) => r.vehicleId === selectedVehicle.id
    )
  : [];

const vehicleMaintenances = selectedVehicle
  ? maintenanceHistory.filter(
      (m) =>
        `v${m.vehicle_id}` === selectedVehicle.id
    )
  : [];

const completedReservations =
  vehicleReservations.filter(
    (r) => normalizeStatus(r.status) === "completed" && r.purpose !== "Initialisation"
  );

const totalKm = completedReservations.reduce(
  (sum, r) => {
    const start = Number(r.startMileage);
    const end = Number(r.endMileage);

    if (isNaN(start) || isNaN(end)) return sum;

    return sum + (end - start);
  },
  0
);
const lastReservation = completedReservations
  .slice()
  .sort((a, b) => new Date(b.end) - new Date(a.end))[0] || null;

  const averageKm =
  completedReservations.length > 0
    ? totalKm / completedReservations.length
    : 0;

    const maintenanceDays = vehicleMaintenances.reduce((sum, m) => {
  if (!m.end_at) return sum;

  const start = new Date(m.start_at);
  const end = new Date(m.end_at);

  const diff = end - start;

  if (isNaN(diff)) return sum;

  return sum + diff / (1000 * 60 * 60 * 24);
}, 0);



if (!currentUser) {

  return (
    <div style={styles.page}>
      <div style={{
        maxWidth: "400px",
        margin: "100px auto",
        background: "#fff",
        padding: "40px",
        borderRadius: "10px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
      }}>
        <h1 style={{ marginBottom: "8px" }}>Gestion flotte</h1>
        <p style={{ color: "#555", marginBottom: "24px" }}>
          Identifiez-vous pour continuer
        </p>

        <label>Qui êtes-vous ?</label><br />
        <select
          defaultValue=""
          onChange={(e) => {
            const selected = users.find((u) => `u${u.id}` === e.target.value);
            if (selected) setCurrentUser(selected);
          }}
          style={styles.input}
        >
          <option value="" disabled>Choisir votre nom</option>
          {users.map((u) => (
            <option key={u.id} value={`u${u.id}`}>
              {u.first_name} {u.last_name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

if (currentPage === "dashboard") {
  const kmByVehicle = vehicles.map((v) => {
    const completed = reservations.filter(
      (r) => r.vehicleId === v.id && normalizeStatus(r.status) === "completed" && r.purpose !== "Initialisation"
    );
    const totalKm = completed.reduce((sum, r) => {
      const start = Number(r.startMileage);
      const end = Number(r.endMileage);
      if (isNaN(start) || isNaN(end)) return sum;
      return sum + (end - start);
    }, 0);
    return { ...v, totalKm, tripCount: completed.length };
  }).sort((a, b) => b.totalKm - a.totalKm);

  const bestVehicle = kmByVehicle[0] || null;

  const reservationsByMonth = reservations
    .filter((r) => normalizeStatus(r.status) === "completed" && r.purpose !== "Initialisation")
    .reduce((acc, r) => {
      const monthKey = new Date(r.end).toLocaleDateString("fr-FR", {
        year: "numeric",
        month: "long",
      });
      acc[monthKey] = (acc[monthKey] || 0) + 1;
      return acc;
    }, {});

  const totalKmAll = kmByVehicle.reduce((sum, v) => sum + v.totalKm, 0);

  return (
    <div style={styles.page}>
      <div style={styles.container}>

        <button
          style={styles.buttonSecondary}
          onClick={() => setCurrentPage("fleet")}
        >
          ← Retour flotte
        </button>

        <h1 style={{ marginTop: "20px" }}>Tableau de bord</h1>

        {/* STATS GLOBALES */}
        <div style={styles.stats}>
          <div style={styles.card}>
            <strong>Véhicules</strong><br />{stats.total}
          </div>
          <div style={styles.card}>
            <strong>Disponibles</strong><br />{stats.available}
          </div>
          <div style={styles.card}>
            <strong>En maintenance</strong><br />{stats.maintenance}
          </div>
          <div style={styles.card}>
            <strong>Trajets terminés</strong><br />{stats.history}
          </div>
          <div style={styles.card}>
            <strong>Km total flotte</strong><br />{totalKmAll.toLocaleString("fr-FR")} km
          </div>
        </div>

        {/* VEHICULE LE PLUS UTILISE */}
        {bestVehicle && (
          <div style={styles.section}>
            <h2>🏆 Véhicule le plus utilisé</h2>
            <p><strong>Véhicule :</strong> {bestVehicle.name} — {bestVehicle.plate}</p>
            <p><strong>Km parcourus :</strong> {bestVehicle.totalKm.toLocaleString("fr-FR")} km</p>
            <p><strong>Nombre de trajets :</strong> {bestVehicle.tripCount}</p>
          </div>
        )}

        {/* KM PAR VEHICULE */}
        <div style={styles.section}>
          <h2>Km par véhicule</h2>
          {kmByVehicle.length === 0 ? (
            <p>Aucune donnée.</p>
          ) : (
            <div style={styles.gridCards}>
              {kmByVehicle.map((v) => (
                <div key={v.id} style={styles.card}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: 8 }}>
                    <div style={{
                      width: "12px",
                      height: "12px",
                      borderRadius: "50%",
                      backgroundColor: v.status === "maintenance" ? "#dc2626" : "#16a34a",
                      flexShrink: 0,
                    }} />
                    <strong>{v.name}</strong>
                  </div>
                  <p>{v.plate}</p>
                  <p><strong>Km total :</strong> {v.totalKm.toLocaleString("fr-FR")} km</p>
                  <p><strong>Trajets :</strong> {v.tripCount}</p>
                  <p><strong>Km moyen :</strong> {v.tripCount > 0 ? Math.round(v.totalKm / v.tripCount).toLocaleString("fr-FR") : "—"} km</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RESERVATIONS PAR MOIS */}
        <div style={styles.section}>
          <h2>Réservations par mois</h2>
          {Object.keys(reservationsByMonth).length === 0 ? (
            <p>Aucune donnée.</p>
          ) : (
            <div style={styles.gridCards}>
              {Object.entries(reservationsByMonth)
                .sort((a, b) => new Date(b[0]) - new Date(a[0]))
                .map(([month, count]) => (
                  <div key={month} style={styles.card}>
                    <p><strong>{month}</strong></p>
                    <p style={{ fontSize: "24px", fontWeight: "bold", color: "#2563eb" }}>{count}</p>
                    <p>réservation(s)</p>
                  </div>
                ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

if (currentPage === "vehicle" && selectedVehicle) {
  return (
    <div style={styles.page}>
      <div style={styles.container}>

        <button
          style={styles.buttonSecondary}
          onClick={() => {
            setCurrentPage("fleet");
            setSelectedVehicle(null);
          }}
        >
          ← Retour flotte
        </button>

        <h1 style={{ marginTop: "20px" }}>
          {selectedVehicle.name}
        </h1>

        {/* RESUME GLOBAL */}
        <div style={styles.section}>
          <h2>Résumé véhicule</h2>

          <div style={styles.gridCards}>

            <div style={styles.card}>
              <p><strong>Statut :</strong> {selectedVehicle.status === "maintenance" ? "Maintenance" : "Disponible"}</p>
              <p><strong>Site :</strong> {selectedVehicle.currentSiteName}</p>
            </div>

            <div style={styles.card}>
              <p><strong>Total km :</strong> {totalKm.toLocaleString("fr-FR")} km</p>
              <p><strong>Trajets :</strong> {completedReservations.length}</p>
            </div>

            <div style={styles.card}>
              <p><strong>Maintenances :</strong> {vehicleMaintenances.length}</p>
              <p>
                <strong>Dernier usage :</strong>{" "}
                {lastReservation ? formatDate(lastReservation.end) : "—"}
              </p>
            </div>
            {/* RESERVATIONS A VENIR */}
<div style={styles.section}>
  <h2>Réservations à venir</h2>

  {(() => {
    const now = new Date();
    const upcoming = vehicleReservations
      .filter(
        (r) =>
          normalizeStatus(r.status) === "active" &&
          new Date(r.end) >= now
      )
      .sort((a, b) => new Date(a.start) - new Date(b.start));

    if (upcoming.length === 0) {
      return <p>Aucune réservation à venir.</p>;
    }

    return upcoming.map((r) => (
      <div key={r.id} style={{
        ...styles.card,
        borderLeft: `5px solid ${getPurposeColor(r.purpose)}`,
      }}>
        <p><strong>Période :</strong> {formatDate(r.start)} → {formatDate(r.end)}</p>
        <p><strong>Utilisateur :</strong> {r.user}</p>
        <p><strong>Motif :</strong> {r.purpose || "—"}</p>
        <p><strong>Trajet :</strong> {siteName(r.fromSiteId)} → {siteName(r.toSiteId)}</p>
      </div>
    ));
  })()}
</div>

          </div>
        </div>

        {/* INFOS VEHICULE */}
        <div style={styles.section}>
          <h2>Informations générales</h2>

          <p><strong>Immatriculation :</strong> {selectedVehicle.plate}</p>
          <p><strong>Type :</strong> {selectedVehicle.type}</p>
          <p><strong>Statut :</strong> {selectedVehicle.status === "maintenance" ? "Maintenance" : "Disponible"}</p>
          <p><strong>Site actuel :</strong> {selectedVehicle.currentSiteName}</p>
          <p><strong>Site d'origine :</strong> {selectedVehicle.originSiteName}</p>
          <p>
  <strong>Kilométrage actuel :</strong>{" "}
  {(() => {
    const lastKm = vehicleReservations
      .filter((r) => normalizeStatus(r.status) === "completed" && r.endMileage)
      .sort((a, b) => new Date(b.end) - new Date(a.end))[0];
    return lastKm ? formatMileage(lastKm.endMileage) + " km" : "Non renseigné";
  })()}
</p>

<p>
  <strong>Carburant :</strong>{" "}
  {selectedVehicle.fuelType || "Non renseigné"}
</p>
        </div>

        {/* PERFORMANCES */}
        <div style={styles.section}>
          <h2>Performances</h2>

          <p>
            <strong>Km total :</strong>{" "}
            {totalKm.toLocaleString("fr-FR")} km
          </p>

          <p>
            <strong>Km moyen / trajet :</strong>{" "}
            {averageKm.toFixed(0)} km
          </p>

          <p>
            <strong>Nombre de trajets :</strong>{" "}
            {completedReservations.length}
          </p>
          <p>
    <strong>Dernier kilométrage connu :</strong>{" "}
    {lastReservation && lastReservation.endMileage
      ? formatMileage(lastReservation.endMileage) + " km"
      : "—"}
  </p>
        </div>

        {/* DERNIER USAGE */}
        <div style={styles.section}>
          <h2>Dernière utilisation</h2>

          <p>
            <strong>Date :</strong>{" "}
            {lastReservation ? formatDate(lastReservation.end) : "—"}
          </p>

          <p>
            <strong>Utilisateur :</strong>{" "}
            {lastReservation ? lastReservation.user : "—"}
          </p>

          <p>
            <strong>Kilométrage :</strong>{" "}
            {lastReservation
              ? formatMileage(lastReservation.endMileage)
              : "—"}
          </p>
        </div>
{/* ALERTES */}
{(() => {
  const alerts = [];
  const now = new Date();

  // Alerte contrôle technique
  if (selectedVehicle.ctExpiryDate) {
    const ctDate = new Date(selectedVehicle.ctExpiryDate);
    const daysLeft = Math.ceil((ctDate - now) / (1000 * 60 * 60 * 24));

    if (daysLeft < 0) {
      alerts.push({ level: "danger", message: `Contrôle technique expiré depuis ${Math.abs(daysLeft)} jour(s) !` });
    } else if (daysLeft <= 30) {
      alerts.push({ level: "warning", message: `Contrôle technique expire dans ${daysLeft} jour(s).` });
    }
  }

  // Alerte révision
  if (selectedVehicle.revisionIntervalKm && selectedVehicle.lastRevisionKm) {
    const nextRevisionKm = selectedVehicle.lastRevisionKm + selectedVehicle.revisionIntervalKm;
    const currentKm = lastReservation ? Number(lastReservation.endMileage) : null;

    if (currentKm) {
      const kmLeft = nextRevisionKm - currentKm;
      if (kmLeft <= 0) {
        alerts.push({ level: "danger", message: `Révision dépassée de ${Math.abs(kmLeft).toLocaleString("fr-FR")} km !` });
      } else if (kmLeft <= 500) {
        alerts.push({ level: "warning", message: `Révision dans ${kmLeft.toLocaleString("fr-FR")} km.` });
      }
    }
  }

  // Alerte maintenance trop longue
  const openMaintenance = vehicleMaintenances.find((m) => m.status === "open");
  if (openMaintenance) {
    const daysOpen = Math.ceil((now - new Date(openMaintenance.start_at)) / (1000 * 60 * 60 * 24));
    if (daysOpen >= 7) {
      alerts.push({ level: "warning", message: `Maintenance ouverte depuis ${daysOpen} jour(s).` });
    }
  }

  if (alerts.length === 0) return (
    <div style={styles.section}>
      <h2>Alertes</h2>
      <p style={{ color: "#16a34a" }}>✅ Aucune alerte pour ce véhicule.</p>
    </div>
  );

  return (
    <div style={styles.section}>
      <h2>Alertes</h2>
      {alerts.map((a, i) => (
        <div key={i} style={{
          background: a.level === "danger" ? "#fee2e2" : "#fef9c3",
          color: a.level === "danger" ? "#991b1b" : "#854d0e",
          padding: "10px 14px",
          borderRadius: "8px",
          marginBottom: "8px",
          fontWeight: "bold",
        }}>
          {a.level === "danger" ? "🔴 " : "🟡 "}{a.message}
        </div>
      ))}
    </div>
  );
})()}

{/* PARAMETRES VEHICULE */}
<div style={styles.section}>
  <h2>Paramètres véhicule</h2>

  <div style={{ marginBottom: 12 }}>
    <label>Date d'expiration du contrôle technique</label><br />
    <input
      type="date"
      value={vehicleSettingsForm.ctExpiryDate || selectedVehicle.ctExpiryDate || ""}
      onChange={(e) => setVehicleSettingsForm((f) => ({ ...f, ctExpiryDate: e.target.value }))}
      style={styles.input}
    />
  </div>

  <div style={{ marginBottom: 12 }}>
    <label>Intervalle de révision (km)</label><br />
    <input
      type="number"
      value={vehicleSettingsForm.revisionIntervalKm || selectedVehicle.revisionIntervalKm || ""}
      onChange={(e) => setVehicleSettingsForm((f) => ({ ...f, revisionIntervalKm: e.target.value }))}
      style={styles.input}
      placeholder="Ex : 15000"
    />
  </div>

  <div style={{ marginBottom: 12 }}>
    <label>Kilométrage de la dernière révision</label><br />
    <input
      type="number"
      value={vehicleSettingsForm.lastRevisionKm || selectedVehicle.lastRevisionKm || ""}
      onChange={(e) => setVehicleSettingsForm((f) => ({ ...f, lastRevisionKm: e.target.value }))}
      style={styles.input}
      placeholder="Ex : 120000"
    />
  </div>
  <div style={{ marginBottom: 12 }}>
  <label>Carburant</label><br />
  <select
    value={vehicleSettingsForm.fuelType || selectedVehicle.fuelType || ""}
    onChange={(e) => setVehicleSettingsForm((f) => ({ ...f, fuelType: e.target.value }))}
    style={styles.input}
  >
    <option value="">Choisir</option>
    <option value="ES">Essence (ES)</option>
    <option value="GO">Diesel (GO)</option>
    <option value="EE">Hybride (EE)</option>
    <option value="E">Électrique (E)</option>
  </select>
</div>

  <button style={styles.buttonPrimary} onClick={handleSaveVehicleSettings}>
    Sauvegarder
  </button>
</div>
        {/* MAINTENANCE */}
        <div style={styles.section}>
          <h2>Maintenance</h2>

          <p>
            <strong>Nombre d’interventions :</strong>{" "}
            {vehicleMaintenances.length}
          </p>

          <p>
            <strong>Temps immobilisé :</strong>{" "}
            {maintenanceDays.toFixed(1)} jours
          </p>

          {vehicleMaintenances.length === 0 ? (
            <p>Aucune maintenance enregistrée.</p>
          ) : (
            vehicleMaintenances.map((m) => (
              <div key={m.id} style={styles.card}>
                <p><strong>Début :</strong> {formatDate(m.start_at)}</p>
                <p><strong>Fin :</strong> {m.end_at ? formatDate(m.end_at) : "En cours"}</p>
                <p><strong>Motif :</strong> {m.reason || "—"}</p>
              </div>
            ))
          )}
        </div>
        {/* ÉTAT DU VÉHICULE */}
<div style={styles.section}>
  <h2>État signalé</h2>

  {vehicleReports.length === 0 ? (
    <p style={{ color: "#16a34a" }}>✅ Aucun signalement en cours.</p>
  ) : (
    <div style={styles.gridCards}>
      {vehicleReports.map((r) => (
        <div key={r.id} style={{
          ...styles.card,
          borderLeft: r.status === "open" ? "5px solid #dc2626" : "5px solid #16a34a",
          opacity: r.status === "resolved" ? 0.6 : 1,
        }}>
          <p>
            <strong>{r.report_type === "departure" ? "🚗 Départ" : "🏁 Retour"}</strong>{" "}
            <span style={{ fontSize: 12, color: "#666" }}>{new Date(r.created_at).toLocaleDateString("fr-FR")}</span>
          </p>
          <p>{r.content}</p>
          <p style={{ fontSize: 12, color: "#666" }}>Par : {r.user_name}</p>

          {r.status === "open" && ["manager", "admin"].includes(currentUser.role) && (
            <button
              style={{ ...styles.buttonSecondary, marginTop: 8, fontSize: 12 }}
              onClick={async () => {
                await fetch(`https://fleet-app-1j2a.onrender.com/api/reports/${r.id}/resolve`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ resolved_by: `${currentUser.first_name} ${currentUser.last_name}` }),
                });
                loadVehicleReports(selectedVehicle.id);
                setSuccess("Signalement clôturé.");
              }}
            >
              Clôturer
            </button>
          )}

          {r.status === "resolved" && (
            <p style={{ fontSize: 12, color: "#16a34a", marginTop: 8 }}>
              ✅ Résolu par {r.resolved_by} le {new Date(r.resolved_at).toLocaleDateString("fr-FR")}
            </p>
          )}
        </div>
      ))}
    </div>
  )}
</div>
{/* DOCUMENTS */}
<div style={styles.section}>
  <h2>Documents</h2>

  {/* Upload */}
  <div style={{ marginBottom: 16 }}>
    <div style={{ marginBottom: 8 }}>
      <label>Nom du document</label><br />
      <input
        type="text"
        value={docLabel}
        onChange={(e) => setDocLabel(e.target.value)}
        style={styles.input}
        placeholder="Ex : Carte grise, Assurance..."
      />
    </div>
    <div style={{ marginBottom: 8 }}>
      <label>Fichier (PDF, image)</label><br />
      <input
        type="file"
        accept=".pdf,image/*"
        onChange={(e) => setDocFile(e.target.files[0])}
        style={{ marginTop: 6 }}
      />
    </div>
    <button
      style={styles.buttonPrimary}
      onClick={async () => {
        if (!docFile) { setError("Sélectionne un fichier."); return; }
        const formData = new FormData();
        formData.append("file", docFile);
        formData.append("label", docLabel || docFile.name);
        const id = selectedVehicle.id.replace("v", "");
        const res = await fetch(`https://fleet-app-1j2a.onrender.com/api/vehicles/${id}/documents`, {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error || "Erreur upload."); return; }
        setDocLabel("");
        setDocFile(null);
        loadDocuments(selectedVehicle.id);
        setSuccess("Document ajouté.");
      }}
    >
      Ajouter le document
    </button>
  </div>

  {/* Liste */}
  {documents.length === 0 ? (
    <p>Aucun document pour ce véhicule.</p>
  ) : (
    <div style={styles.gridCards}>
      {documents.map((doc) => (
        <div key={doc.id} style={styles.card}>
          <p><strong>{doc.label}</strong></p>
          <p style={{ fontSize: 12, color: "#666" }}>{new Date(doc.created_at).toLocaleDateString("fr-FR")}</p>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <a
              href={`https://fleet-app-1j2a.onrender.com/api/documents/${doc.filename}`}
              target="_blank"
              rel="noreferrer"
              style={{ ...styles.buttonPrimary, textDecoration: "none", fontSize: 13 }}
            >
              Voir
            </a>
            <button
              style={{ ...styles.buttonSecondary, fontSize: 13 }}
              onClick={async () => {
                if (!window.confirm("Supprimer ce document ?")) return;
                await fetch(`https://fleet-app-1j2a.onrender.com/api/documents/${doc.id}`, { method: "DELETE" });
                loadDocuments(selectedVehicle.id);
              }}
            >
              Supprimer
            </button>
          </div>
        </div>
      ))}
    </div>
  )}
</div>
                
          {["manager", "admin"].includes(currentUser.role) && (
  <button
    style={{ ...styles.buttonSecondary, color: "#dc2626", marginTop: "20px" }}
    onClick={() => {
      if (window.confirm(`Supprimer définitivement ${selectedVehicle.name} ? Cette action est irréversible.`)) {
        fetch(`https://fleet-app-1j2a.onrender.com/api/vehicles/${selectedVehicle.id.replace("v", "")}`, {
          method: "DELETE",
        })
          .then(async (res) => {
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Erreur suppression.");
            return data;
          })
          .then(() => {
            loadVehicles();
            setCurrentPage("fleet");
            setSelectedVehicle(null);
          })
          .catch((err) => setError(err.message));
      }
    }}
  >
    🗑 Supprimer ce véhicule
  </button>
)}

      </div>
    </div>
  );
}
if (currentPage === "admin") {
  if (!["manager", "admin"].includes(currentUser.role)) {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <p>Accès refusé.</p>
          <button style={styles.buttonSecondary} onClick={() => setCurrentPage("fleet")}>← Retour</button>
        </div>
      </div>
    );
  }
  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
          <h1>Administration</h1>
          <button style={styles.buttonSecondary} onClick={() => setCurrentPage("fleet")}>← Retour</button>
        </div>

        {/* ONGLETS */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          {(currentUser.role === "admin" ? ["sites", "vehicles", "users", "data"] : ["vehicles"]).map((s) => (
  <button
    key={s}
    style={{ ...styles.buttonPrimary, opacity: adminSection === s ? 1 : 0.5 }}
    onClick={() => setAdminSection(s)}
  >
    {s === "sites" ? "Sites" : s === "vehicles" ? "Véhicules" : s === "users" ? "Utilisateurs" : "Données"}
  </button>
))}
        </div>

        {error && <div style={styles.error}>{error}</div>}
        {success && <div style={styles.success}>{success}</div>}

        {/* SITES */}
        {adminSection === "sites" && (
          <div style={styles.section}>
            <h2>Sites</h2>
            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              <input
                type="text"
                value={newSiteName}
                onChange={(e) => setNewSiteName(e.target.value)}
                placeholder="Nom du site"
                style={{ ...styles.input, width: "300px" }}
              />
              <button
                style={styles.buttonPrimary}
                onClick={async () => {
                  if (!newSiteName.trim()) { setError("Nom obligatoire."); return; }
                  const res = await fetch("https://fleet-app-1j2a.onrender.com/api/sites", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: newSiteName.trim() }),
                  });
                  const data = await res.json();
                  if (!res.ok) { setError(data.error); return; }
                  setNewSiteName("");
                  setSuccess("Site ajouté.");
                  const res2 = await fetch("https://fleet-app-1j2a.onrender.com/api/sites");
                  const sites2 = await res2.json();
                  setSites(sites2.map((s) => ({ id: `s${s.id}`, name: s.name })));
                }}
              >
                Ajouter
              </button>
            </div>
            <div style={styles.gridCards}>
              {sites.map((s) => (
                <div key={s.id} style={styles.card}>
                  <p><strong>{s.name}</strong></p>
                  <button
                    style={{ ...styles.buttonSecondary, color: "#dc2626", marginTop: 8 }}
                    onClick={async () => {
                      if (!window.confirm(`Supprimer ${s.name} ?`)) return;
                      const res = await fetch(`https://fleet-app-1j2a.onrender.com/api/sites/${s.id.replace("s", "")}`, { method: "DELETE" });
                      const data = await res.json();
                      if (!res.ok) { setError(data.error); return; }
                      setSuccess("Site supprimé.");
                      const res2 = await fetch("https://fleet-app-1j2a.onrender.com/api/sites");
                      const sites2 = await res2.json();
                      setSites(sites2.map((s) => ({ id: `s${s.id}`, name: s.name })));
                    }}
                  >
                    Supprimer
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VEHICULES */}
        {adminSection === "vehicles" && (
          <div style={styles.section}>
            <h2>Véhicules</h2>
            <div style={styles.grid2}>
              <div>
                <label>Nom</label><br />
                <input type="text" value={newVehicle.internal_name} onChange={(e) => setNewVehicle((f) => ({ ...f, internal_name: e.target.value }))} style={styles.input} placeholder="Ex : Renault Clio" />
              </div>
              <div>
                <label>Immatriculation</label><br />
                <input type="text" value={newVehicle.registration_number} onChange={(e) => setNewVehicle((f) => ({ ...f, registration_number: e.target.value }))} style={styles.input} placeholder="Ex : AB-123-CD" />
              </div>
              <div>
                <label>Type</label><br />
                <select value={newVehicle.vehicle_type} onChange={(e) => setNewVehicle((f) => ({ ...f, vehicle_type: e.target.value }))} style={styles.input}>
                  <option value="Voiture">Voiture</option>
                  <option value="Camionnette">Camionnette</option>
                  <option value="Camion">Camion</option>
                </select>
              </div>
              <div>
                <label>Carburant</label><br />
                <select value={newVehicle.fuel_type} onChange={(e) => setNewVehicle((f) => ({ ...f, fuel_type: e.target.value }))} style={styles.input}>
                  <option value="">Choisir</option>
                  <option value="ES">Essence (ES)</option>
                  <option value="GO">Diesel (GO)</option>
                  <option value="EE">Hybride (EE)</option>
                  <option value="E">Électrique (E)</option>
                </select>
              </div>
              <div>
                <label>Site d'origine</label><br />
                <select value={newVehicle.origin_site_id} onChange={(e) => setNewVehicle((f) => ({ ...f, origin_site_id: e.target.value }))} style={styles.input}>
                  <option value="">Choisir</option>
                  {sites.map((s) => <option key={s.id} value={s.id.replace("s", "")}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label>Site actuel</label><br />
                <select value={newVehicle.current_site_id} onChange={(e) => setNewVehicle((f) => ({ ...f, current_site_id: e.target.value }))} style={styles.input}>
                  <option value="">Choisir</option>
                  {sites.map((s) => <option key={s.id} value={s.id.replace("s", "")}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <button
              style={{ ...styles.buttonPrimary, marginTop: 16 }}
              onClick={async () => {
                const res = await fetch("https://fleet-app-1j2a.onrender.com/api/vehicles", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(newVehicle),
                });
                const data = await res.json();
                if (!res.ok) { setError(data.error); return; }
                setNewVehicle({ internal_name: "", registration_number: "", vehicle_type: "Voiture", origin_site_id: "", current_site_id: "", fuel_type: "" });
                setSuccess("Véhicule ajouté.");
                loadVehicles();
              }}
            >
              Ajouter le véhicule
            </button>

            <hr style={{ margin: "24px 0" }} />

            <div style={styles.gridCards}>
              {vehicles.map((v) => (
                <div key={v.id} style={styles.card}>
                  {editingVehicle?.id === v.id ? (
                    <>
                      <input type="text" value={editingVehicle.name} onChange={(e) => setEditingVehicle((f) => ({ ...f, name: e.target.value }))} style={styles.input} />
                      <input type="text" value={editingVehicle.plate} onChange={(e) => setEditingVehicle((f) => ({ ...f, plate: e.target.value }))} style={styles.input} />
                      <select value={editingVehicle.type} onChange={(e) => setEditingVehicle((f) => ({ ...f, type: e.target.value }))} style={styles.input}>
                        <option value="Voiture">Voiture</option>
                        <option value="Camionnette">Camionnette</option>
                        <option value="Camion">Camion</option>
                      </select>
                      <select value={editingVehicle.fuelType || ""} onChange={(e) => setEditingVehicle((f) => ({ ...f, fuelType: e.target.value }))} style={styles.input}>
                        <option value="">Choisir</option>
                        <option value="ES">Essence (ES)</option>
                        <option value="GO">Diesel (GO)</option>
                        <option value="EE">Hybride (EE)</option>
                        <option value="E">Électrique (E)</option>
                      </select>
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <button style={styles.buttonPrimary} onClick={async () => {
                          const res = await fetch(`https://fleet-app-1j2a.onrender.com/api/vehicles/${v.id.replace("v", "")}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              internal_name: editingVehicle.name,
                              registration_number: editingVehicle.plate,
                              vehicle_type: editingVehicle.type,
                              origin_site_id: editingVehicle.siteId.replace("s", ""),
                              current_site_id: editingVehicle.currentSiteId.replace("s", ""),
                              fuel_type: editingVehicle.fuelType,
                            }),
                          });
                          const data = await res.json();
                          if (!res.ok) { setError(data.error); return; }
                          setEditingVehicle(null);
                          setSuccess("Véhicule modifié.");
                          loadVehicles();
                        }}>Sauvegarder</button>
                        <button style={styles.buttonSecondary} onClick={() => setEditingVehicle(null)}>Annuler</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p><strong>{v.name}</strong></p>
                      <p>{v.plate} — {v.type}</p>
                      <p>{v.fuelType || "—"}</p>
                                            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <button style={styles.buttonPrimary} onClick={() => setEditingVehicle(v)}>Modifier</button>
                        <button style={{ ...styles.buttonSecondary, color: "#dc2626" }} onClick={async () => {
                          if (!window.confirm(`Supprimer ${v.name} ?`)) return;
                          const res = await fetch(`https://fleet-app-1j2a.onrender.com/api/vehicles/${v.id.replace("v", "")}`, { method: "DELETE" });
                          const data = await res.json();
                          if (!res.ok) { setError(data.error); return; }
                          setSuccess("Véhicule supprimé.");
                          loadVehicles();
                        }}>Supprimer</button>
                      </div>
                      <div style={{ marginTop: 8 }}>
  <input
    type="text"
    placeholder="Km initial"
    id={`km-init-${v.id}`}
    style={{ ...styles.input, marginBottom: 6 }}
  />
  <button
    style={{ ...styles.buttonSecondary, fontSize: 12 }}
    onClick={async () => {
      const input = document.getElementById(`km-init-${v.id}`);
      const mileage = input.value.replace(/\s/g, "");
      if (!mileage) { setError("Entre un kilométrage."); return; }
      const res = await fetch(`https://fleet-app-1j2a.onrender.com/api/vehicles/${v.id.replace("v", "")}/initial-mileage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mileage: Number(mileage) }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      input.value = "";
      setSuccess(`Kilométrage initialisé pour ${v.name}.`);
      loadReservations();
    }}
  >
    Initialiser km
  </button>
</div>
                    
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* UTILISATEURS */}
        {adminSection === "users" && (
          <div style={styles.section}>
            <h2>Utilisateurs</h2>
            <div style={styles.grid2}>
              <div>
                <label>Prénom</label><br />
                <input type="text" value={newUser.first_name} onChange={(e) => setNewUser((f) => ({ ...f, first_name: e.target.value }))} style={styles.input} />
              </div>
              <div>
                <label>Nom</label><br />
                <input type="text" value={newUser.last_name} onChange={(e) => setNewUser((f) => ({ ...f, last_name: e.target.value }))} style={styles.input} />
              </div>
              <div>
                <label>Email</label><br />
                <input type="email" value={newUser.email} onChange={(e) => setNewUser((f) => ({ ...f, email: e.target.value }))} style={styles.input} />
              </div>
              <div>
                <label>Rôle</label><br />
                <select value={newUser.role} onChange={(e) => setNewUser((f) => ({ ...f, role: e.target.value }))} style={styles.input}>
                  <option value="employee">Employé</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label>Site</label><br />
                <select value={newUser.site_id} onChange={(e) => setNewUser((f) => ({ ...f, site_id: e.target.value }))} style={styles.input}>
                  <option value="">Choisir</option>
                  {sites.map((s) => <option key={s.id} value={s.id.replace("s", "")}>{s.name}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 24 }}>
                <input type="checkbox" checked={newUser.is_authorized_driver === 1} onChange={(e) => setNewUser((f) => ({ ...f, is_authorized_driver: e.target.checked ? 1 : 0 }))} />
                <label>Conducteur autorisé</label>
              </div>
            </div>
            <button
              style={{ ...styles.buttonPrimary, marginTop: 16 }}
              onClick={async () => {
                const res = await fetch("https://fleet-app-1j2a.onrender.com/api/users", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(newUser),
                });
                const data = await res.json();
                if (!res.ok) { setError(data.error); return; }
                setNewUser({ first_name: "", last_name: "", email: "", role: "employee", is_authorized_driver: 1, site_id: "" });
                setSuccess("Utilisateur ajouté.");
                const res2 = await fetch("https://fleet-app-1j2a.onrender.com/api/users");
                setUsers(await res2.json());
              }}
            >
              Ajouter l'utilisateur
            </button>

            <hr style={{ margin: "24px 0" }} />

            <div style={styles.gridCards}>
              {users.map((u) => (
                <div key={u.id} style={styles.card}>
                  {editingUser?.id === u.id ? (
                    <>
                      <input type="text" value={editingUser.first_name} onChange={(e) => setEditingUser((f) => ({ ...f, first_name: e.target.value }))} style={styles.input} placeholder="Prénom" />
                      <input type="text" value={editingUser.last_name} onChange={(e) => setEditingUser((f) => ({ ...f, last_name: e.target.value }))} style={styles.input} placeholder="Nom" />
                      <input type="email" value={editingUser.email} onChange={(e) => setEditingUser((f) => ({ ...f, email: e.target.value }))} style={styles.input} placeholder="Email" />
                      <select value={editingUser.role} onChange={(e) => setEditingUser((f) => ({ ...f, role: e.target.value }))} style={styles.input}>
                        <option value="employee">Employé</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                      </select>
                      <select value={editingUser.site_id || ""} onChange={(e) => setEditingUser((f) => ({ ...f, site_id: e.target.value }))} style={styles.input}>
                        <option value="">Choisir</option>
                        {sites.map((s) => <option key={s.id} value={s.id.replace("s", "")}>{s.name}</option>)}
                      </select>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "8px 0" }}>
                        <input type="checkbox" checked={editingUser.is_authorized_driver === 1} onChange={(e) => setEditingUser((f) => ({ ...f, is_authorized_driver: e.target.checked ? 1 : 0 }))} />
                        <label>Conducteur autorisé</label>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "8px 0" }}>
                        <input type="checkbox" checked={editingUser.is_active === 1} onChange={(e) => setEditingUser((f) => ({ ...f, is_active: e.target.checked ? 1 : 0 }))} />
                        <label>Actif</label>
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <button style={styles.buttonPrimary} onClick={async () => {
                          const res = await fetch(`https://fleet-app-1j2a.onrender.com/api/users/${u.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(editingUser),
                          });
                          const data = await res.json();
                          if (!res.ok) { setError(data.error); return; }
                          setEditingUser(null);
                          setSuccess("Utilisateur modifié.");
                          const res2 = await fetch("https://fleet-app-1j2a.onrender.com/api/users");
                          setUsers(await res2.json());
                        }}>Sauvegarder</button>
                        <button style={styles.buttonSecondary} onClick={() => setEditingUser(null)}>Annuler</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p><strong>{u.first_name} {u.last_name}</strong></p>
                      <p>{u.email}</p>
                      <p>{u.role} — {u.is_authorized_driver ? "Conducteur ✅" : "Non conducteur"}</p>
                      <p>{u.is_active ? "Actif" : "Inactif"}</p>
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <button style={styles.buttonPrimary} onClick={() => setEditingUser(u)}>Modifier</button>
                        <button style={{ ...styles.buttonSecondary, color: "#dc2626" }} onClick={async () => {
                          if (!window.confirm(`Supprimer ${u.first_name} ${u.last_name} ?`)) return;
                          const res = await fetch(`https://fleet-app-1j2a.onrender.com/api/users/${u.id}`, { method: "DELETE" });
                          const data = await res.json();
                          if (!res.ok) { setError(data.error); return; }
                          setSuccess("Utilisateur supprimé.");
                          const res2 = await fetch("https://fleet-app-1j2a.onrender.com/api/users");
                          setUsers(await res2.json());
                        }}>Supprimer</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {adminSection === "data" && (
          <div style={styles.section}>
            <h2>Purge des données</h2>

            <div style={{ marginBottom: 20 }}>
              <p><strong>Historique des réservations</strong></p>
              <p style={{ color: "#666", fontSize: 14 }}>Supprime toutes les réservations terminées et annulées. Les réservations actives ne sont pas touchées.</p>
              <button
                style={{ ...styles.buttonSecondary, color: "#dc2626", marginTop: 8 }}
                onClick={async () => {
                  if (!window.confirm("Supprimer tout l'historique des réservations ? Cette action est irréversible.")) return;
                  const res = await fetch("https://fleet-app-1j2a.onrender.com/api/reservations/history", { method: "DELETE" });
                  const data = await res.json();
                  if (!res.ok) { setError(data.error); return; }
                  setSuccess("Historique des réservations supprimé.");
                  loadReservations();
                }}
              >
                🗑 Supprimer l'historique des réservations
              </button>
            </div>

            <hr />

            <div style={{ marginTop: 20 }}>
              <p><strong>Historique des maintenances</strong></p>
              <p style={{ color: "#666", fontSize: 14 }}>Supprime toutes les maintenances clôturées. Les maintenances en cours ne sont pas touchées.</p>
              <button
                style={{ ...styles.buttonSecondary, color: "#dc2626", marginTop: 8 }}
                onClick={async () => {
                  if (!window.confirm("Supprimer tout l'historique des maintenances ? Cette action est irréversible.")) return;
                  const res = await fetch("https://fleet-app-1j2a.onrender.com/api/maintenance/history", { method: "DELETE" });
                  const data = await res.json();
                  if (!res.ok) { setError(data.error); return; }
                  setSuccess("Historique des maintenances supprimé.");
                  loadMaintenanceHistory();
                }}
              >
                🗑 Supprimer l'historique des maintenances
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
  return (
  <div style={styles.page}>
    <div style={styles.container}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
  <h1>Gestion flotte</h1>
  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
    <span style={{ color: "#555" }}>
      👤 {currentUser.first_name} {currentUser.last_name}
    </span>
    <button
      style={styles.buttonSecondary}
      onClick={() => setCurrentUser(null)}
    >
      Se déconnecter
    </button>
  </div>
</div>
      <div style={{
  display: "flex",
  gap: "10px",
  marginBottom: "20px",
}}>
  <button
    style={styles.buttonPrimary}
    onClick={() => setCurrentPage("dashboard")}
  >
    Tableau de bord
  </button>

  <button
    style={styles.buttonPrimary}
    onClick={() => setCurrentPage("fleet")}
  >
    Flotte
  </button>

  <button
    style={styles.buttonPrimary}
    onClick={() => setCurrentPage("reservations")}
  >
    Réservations
  </button>
  {["manager", "admin"].includes(currentUser.role) && (
  <button
    style={styles.buttonPrimary}
    onClick={() => setCurrentPage("admin")}
  >
    Admin
  </button>
)}
</div>
      {/* ALERTES CENTRALISÉES */}
{(() => {
  const alerts = [];
  const now = new Date();

  vehicles.forEach((v) => {
    // Alerte CT
    if (v.ctExpiryDate) {
      const ctDate = new Date(v.ctExpiryDate);
      const daysLeft = Math.ceil((ctDate - now) / (1000 * 60 * 60 * 24));
      if (daysLeft < 0) {
        alerts.push({ level: "danger", message: `CT expiré depuis ${Math.abs(daysLeft)} jour(s)`, vehicle: v.name });
      } else if (daysLeft <= 30) {
        alerts.push({ level: "warning", message: `CT expire dans ${daysLeft} jour(s)`, vehicle: v.name });
      }
    }

    // Alerte révision
    if (v.revisionIntervalKm && v.lastRevisionKm) {
      const nextRevisionKm = v.lastRevisionKm + v.revisionIntervalKm;
      const lastRes = reservations
        .filter((r) => r.vehicleId === v.id && normalizeStatus(r.status) === "completed" && r.purpose !== "Initialisation" && r.endMileage)
        .sort((a, b) => new Date(b.end) - new Date(a.end))[0];
      const currentKm = lastRes ? Number(lastRes.endMileage) : null;
      if (currentKm) {
        const kmLeft = nextRevisionKm - currentKm;
        if (kmLeft <= 0) {
          alerts.push({ level: "danger", message: `Révision dépassée de ${Math.abs(kmLeft).toLocaleString("fr-FR")} km`, vehicle: v.name });
        } else if (kmLeft <= 500) {
          alerts.push({ level: "warning", message: `Révision dans ${kmLeft.toLocaleString("fr-FR")} km`, vehicle: v.name });
        }
      }
    }
  });

  // Alerte maintenance longue
  maintenanceHistory
    .filter((m) => m.status === "open")
    .forEach((m) => {
      const daysOpen = Math.ceil((now - new Date(m.start_at)) / (1000 * 60 * 60 * 24));
      if (daysOpen >= 30) {
        alerts.push({ level: "danger", message: `Maintenance ouverte depuis ${daysOpen} jour(s)`, vehicle: m.vehicle_name });
      } else if (daysOpen >= 7) {
        alerts.push({ level: "warning", message: `Maintenance ouverte depuis ${daysOpen} jour(s)`, vehicle: m.vehicle_name });
      }
    });

  if (alerts.length === 0) return (
    <div style={{
      background: "#dcfce7",
      color: "#166534",
      padding: "12px 16px",
      borderRadius: "8px",
      marginBottom: "20px",
      fontWeight: "bold",
    }}>
      ✅ Aucune alerte sur la flotte.
    </div>
  );

  return (
    <div style={{
      background: "#fff",
      border: "1px solid #ddd",
      borderRadius: "10px",
      padding: "16px",
      marginBottom: "20px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
    }}>
      <h2 style={{ marginTop: 0, marginBottom: 12 }}>⚠️ Alertes flotte</h2>
      {alerts.map((a, i) => (
        <div key={i} style={{
          background: a.level === "danger" ? "#fee2e2" : "#fef9c3",
          color: a.level === "danger" ? "#991b1b" : "#854d0e",
          padding: "10px 14px",
          borderRadius: "8px",
          marginBottom: "8px",
          display: "flex",
          gap: "10px",
          alignItems: "center",
        }}>
          <span>{a.level === "danger" ? "🔴" : "🟡"}</span>
          <span><strong>{a.vehicle}</strong> — {a.message}</span>
        </div>
      ))}
    </div>
  );
})()}

      <div style={styles.stats}>
        <div style={styles.card}><strong>Véhicules</strong><br />{stats.total}</div>
        <div style={styles.card}><strong>Disponibles</strong><br />{stats.available}</div>
        <div style={styles.card}><strong>Maintenance</strong><br />{stats.maintenance}</div>
        <div style={styles.card}><strong>Réservations</strong><br />{stats.reservations}</div>
        <div style={styles.card}>
          <strong>Historique</strong>
          <br />
          {stats.history}
        </div>
        
      </div>

      <div style={styles.section}>
        <h2>Filtres</h2>
        <div style={{ marginBottom: 12 }}>
  <label>Recherche</label><br />
  <input
    type="text"
    value={search}
    onChange={(e) => setSearch(e.target.value)}
    style={styles.input}
    placeholder="Nom véhicule, plaque, utilisateur..."
  />
</div>
        <div style={styles.grid2}>
          <div>
            <label>Site</label><br />
            <select value={filterSite} onChange={(e) => setFilterSite(e.target.value)} style={styles.input}>
              <option value="all">Tous les sites</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>{site.name}</option>
              ))}
            </select>
          </div>
<div>
    <label>Statut</label><br />
    <select
      value={filterStatus}
      onChange={(e) => setFilterStatus(e.target.value)}
      style={styles.input}
    >
      <option value="all">Tous les statuts</option>
      <option value="available">Disponibles</option>
      <option value="maintenance">En maintenance</option>
    </select>
  </div>
          <div>
            <label>Véhicule</label><br />
            <select value={filterVehicle} onChange={(e) => setFilterVehicle(e.target.value)} style={styles.input}>
              <option value="all">Tous les véhicules</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>{vehicle.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {reservationToComplete && (
  <div style={styles.modalOverlay}>
    <div style={styles.modal}>
      <h2>Retour véhicule</h2>
<p>
  <strong>Réservant :</strong> {reservationToComplete.user}
</p>

<p>
  <strong>Période :</strong>{" "}
  {formatDate(reservationToComplete.start)} → {formatDate(reservationToComplete.end)}
</p>
      <p>
        <strong>Véhicule :</strong>{" "}
        {vehicleName(reservationToComplete.vehicleId)}
      </p>

      <div style={{ marginTop: 12 }}>
  <label>
    Kilométrage retour <span style={{ color: "red" }}>*</span>
  </label>

 <input
  type="text"
  value={returnForm.endMileage}
  onChange={(e) => {
    const raw = e.target.value.replace(/\D/g, "");

    const formatted = raw.replace(
      /\B(?=(\d{3})+(?!\d))/g,
      " "
    );

    setReturnForm((f) => ({
      ...f,
      endMileage: formatted,
    }));
  }}
  style={styles.input}
  placeholder="Ex : 125 500"
/>

  <p style={{ marginTop: 6, color: "#666" }}>
    Kilométrage départ :{" "}
    {formatMileage(reservationToComplete.startMileage)} km
  </p>
  {reservationToComplete?.startMileage != null &&
 returnForm.endMileage && (
  (() => {
    const start = Number(reservationToComplete.startMileage);
    const end = Number(String(returnForm.endMileage).replace(/\s/g, ""));
    const diff = end - start;

    return diff > 0 ? (
      <p style={{ marginTop: 6, color: "#666" }}>
        Distance parcourue : <strong>{diff.toLocaleString("fr-FR")} km</strong>
      </p>
    ) : null;
  })()
)}
</div>

      <div style={{ marginTop: 12 }}>
        <label>
  État du véhicule au retour <span style={{ color: "red" }}>*</span>
</label>
        <textarea
          rows={4}
          value={returnForm.returnNotes}
          onChange={(e) =>
            setReturnForm((f) => ({
              ...f,
              returnNotes: e.target.value,
            }))
          }
          style={styles.input}
        />
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button
          style={styles.buttonPrimary}
          onClick={handleCompleteReservation}
        >
          Valider le retour
        </button>

        <button
          style={styles.buttonSecondary}
          onClick={() => setReservationToComplete(null)}
        >
          Annuler
        </button>
      </div>
    </div>
  </div>
)}

{maintenanceVehicle && (
  <div style={styles.modalOverlay}>
    <div style={styles.modal}>
      <h2>Passer en maintenance</h2>

      <p>
        <strong>Véhicule :</strong> {maintenanceVehicle.name}
      </p>

      <div style={{ marginTop: 15 }}>
        {maintenanceOptions.map((reason) => (
          <label
            key={reason}
            style={{
              display: "block",
              marginBottom: 8,
            }}
          >
            <input
              type="checkbox"
              checked={maintenanceReasons.includes(reason)}
              onChange={(e) => {
                if (e.target.checked) {
                  setMaintenanceReasons((prev) => [...prev, reason]);
                } else {
                  setMaintenanceReasons((prev) =>
                    prev.filter((r) => r !== reason)
                  );
                }
              }}
            />
            {" "}
            {reason}
          </label>
        ))}
      </div>
{maintenanceError && (
  <div
    style={{
      color: "#b91c1c",
      background: "#fee2e2",
      padding: "10px",
      borderRadius: "6px",
      marginTop: "15px",
    }}
  >
    {maintenanceError}
  </div>
)}
      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button
          style={styles.buttonPrimary}
          onClick={() => {
            const reason = maintenanceReasons.join(", ");
            if (maintenanceReasons.length === 0) {
  setMaintenanceError(
    "Veuillez sélectionner au moins une raison de maintenance."
  );
  return;
}

setMaintenanceError("");

            fetch("https://fleet-app-1j2a.onrender.com/api/maintenance", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
             body: JSON.stringify({
  vehicle_id: Number(
    maintenanceVehicle.id.replace("v", "")
  ),
  declared_by_user_id: currentUser ? currentUser.id : 4,
  reason: reason || "Non spécifié",
}),
            })
              .then(async (res) => {
                const data = await res.json();

                if (!res.ok) {
                  throw new Error(
                    data.error ||
                      "Erreur lors du passage en maintenance."
                  );
                }

                return data;
              })
                .then(() => {
    loadVehicles();
loadMaintenanceHistory();

    setMaintenanceVehicle(null);
    setMaintenanceReasons([]);
    setMaintenanceError("");

    setSuccess("Véhicule passé en maintenance.");
  })
  .catch((err) => {
    setError(err.message);
    setMaintenanceVehicle(null);
    setMaintenanceReasons([]);
  });
          }}
        >
          Valider
        </button>

        <button
          style={styles.buttonSecondary}
          onClick={() => {
            setMaintenanceVehicle(null);
            setMaintenanceReasons([]);
          }}
        >
          Annuler
        </button>
      </div>
    </div>
  </div>
)}
{currentPage === "fleet" && <>
      <div style={styles.section}>
       <h2>Flotte</h2>

  <button
    style={{
      ...styles.buttonPrimary,
      marginBottom: "15px",
    }}
    onClick={() => {
  loadMaintenanceHistory();
  setMaintenanceHistoryOpen(!maintenanceHistoryOpen);
}}
  >
    {maintenanceHistoryOpen
      ? "Masquer historique maintenance"
      : "Voir historique maintenance"}
  </button>

  <div style={styles.gridCards}>
          {visibleVehicles.map((vehicle) => (
            <div key={vehicle.id} style={styles.card}>
  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
    <div style={{
      width: "12px",
      height: "12px",
      borderRadius: "50%",
      backgroundColor: vehicle.status === "maintenance" ? "#dc2626" : "#16a34a",
      flexShrink: 0,
    }} />
    <h3 style={{ margin: 0 }}>{vehicle.name}</h3>
  </div>
  <p>{vehicle.plate} — {vehicle.type}</p>

              <p>
                <strong>Statut :</strong>{" "}
                {vehicle.status === "maintenance" && vehicle.notes && (
  <p>
    <strong>Cause :</strong> {vehicle.notes}
  </p>
)}
                {vehicle.status === "maintenance" ? "Maintenance" : "Disponible"}
              </p>

              <p>
                <strong>Site actuel :</strong>{" "}
                {vehicle.currentSiteName || siteName(vehicle.currentSiteId) || "—"}
              </p>

              <p>
                <strong>Site d'origine :</strong>{" "}
                {vehicle.originSiteName || siteName(vehicle.siteId)}
              </p>
              
<button
  style={{
    ...styles.buttonPrimary,
    marginBottom: "10px",
  }}
  onClick={() => {
  setSelectedVehicle(vehicle);
  setCurrentPage("vehicle");
  setVehicleSettingsForm({
    ctExpiryDate: vehicle.ctExpiryDate || "",
    revisionIntervalKm: vehicle.revisionIntervalKm || "",
    lastRevisionKm: vehicle.lastRevisionKm || "",
    fuelType: vehicle.fuelType || "",
  });
  loadDocuments(vehicle.id);
loadVehicleReports(vehicle.id); 
}}
>
  Voir la fiche
</button>
              <button
                onClick={() => toggleMaintenance(vehicle.id)}
                style={styles.buttonSecondary}
              >
                {vehicle.status === "maintenance"
                  ? "Remettre disponible"
                  : "Passer en maintenance"}
              </button>
            </div>
          ))}
              </div>
    </div>

    {maintenanceHistoryOpen && (
  <div style={styles.section}>
    <h2>Historique des maintenances</h2>

    {Object.keys(maintenanceByMonth).length === 0 ? (
      <div style={styles.card}>
        Aucun évènement de maintenance.
      </div>
    ) : (
      Object.entries(maintenanceByMonth).map(([month, days]) => (
        <div key={month} style={{ marginBottom: 25 }}>
          <h3 style={{ marginBottom: 10 }}>
            {month}
          </h3>

          {Object.entries(days).map(([day, items]) => (
            <div
              key={day}
              style={{
                marginLeft: 10,
                marginBottom: 20,
              }}
            >
              <h4 style={{ marginBottom: 10 }}>
                {day}
              </h4>

              <div style={styles.gridCards}>
                {items.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      ...styles.card,
                      borderLeft:
                        m.status === "open"
                          ? "5px solid #dc2626"
                          : "5px solid #16a34a",
                    }}
                  >
                    <h3>{m.vehicle_name}</h3>

                    <p>
                      <strong>Immatriculation :</strong>{" "}
                      {m.registration_number}
                    </p>

                    <p>
                      <strong>Déclaré par :</strong>{" "}
                      {m.declared_by_name}
                    </p>

                    <p>
                      <strong>Début :</strong>{" "}
                      {formatDate(m.start_at)}
                    </p>

                    <p>
                      <strong>Fin :</strong>{" "}
                      {m.end_at
                        ? formatDate(m.end_at)
                        : "En cours"}
                    </p>

                    <p>
                      <strong>Durée :</strong>{" "}
                      {m.end_at
                        ? formatDurationSmart(
                            m.start_at,
                            m.end_at
                          )
                        : "En cours"}
                    </p>

                    <p>
                      <strong>Motif :</strong>{" "}
                      {m.reason || "Non renseigné"}
                    </p>

                    <p>
                      <strong>Statut :</strong>{" "}
                      {m.status === "open"
                        ? "Maintenance en cours"
                        : "Terminée"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))
    )}
  </div>
)}
</>}

{currentPage === "reservations" && <>
  <div style={styles.section}>
    <h2>Réservations</h2>
          {visibleReservations.length === 0 ? (
            <div style={styles.card}>Aucune réservation sur ce filtre.</div>
          ) : (
            visibleReservations
  .sort((a, b) => new Date(a.start) - new Date(b.start))
  .map((r) => (

              <div key={r.id} style={{
  ...styles.card,
  borderLeft: `5px solid ${getPurposeColor(r.purpose)}`,
}}>
  <h3>{vehicleName(r.vehicleId)} — {r.user}</h3>
                <p><strong>Motif :</strong> {r.purpose || "Sans motif"}</p>
                <p><strong>Période :</strong> {formatDate(r.start)} → {formatDate(r.end)}</p>
                <p><strong>Trajet :</strong> {siteName(r.fromSiteId)} → {siteName(r.toSiteId)}</p>
                <p>
  <strong>Kilométrage départ :</strong>{" "}
  {formatMileage(r.startMileage)}
</p>
<p>
  <strong>État départ :</strong> {r.departureNotes || "—"}
</p>
                <p>
                  <strong>Statut :</strong>{" "}
                  {normalizeStatus(r.status) === "active"
                    ? "Active"
                    : r.status === "cancelled"
                    ? "Annulée"
                    : r.status === "completed"
                    ? "Terminée"
                    : r.status}
                </p>

                {normalizeStatus(r.status) === "active" && (
  <div style={{ marginTop: "10px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
   <button
  onClick={() => {
    if (window.confirm("Êtes-vous sûr de vouloir annuler cette réservation ?")) {
      handleCancelReservation(r.id);
    }
  }}
  style={styles.buttonSecondary}
>
  Annuler la réservation
</button>

    <button
  onClick={() => {
    setReservationToComplete(r);
    setReturnForm({
  endMileage: "",
  returnNotes: "",
});
  }}
  style={{
  ...styles.buttonPrimary,
  background: "#bf7575",
  color: "#fff",
}}
>
  Terminer la réservation
    </button>
  </div>
)}
              </div>
            ))
          )}
        </div>

<div style={styles.section}>
  <h2>Planning</h2>

  {(() => {
    const startOfWeek = (date) => {
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      d.setDate(diff);
      d.setHours(0, 0, 0, 0);
      return d;
    };

    const monday = startOfWeek(new Date());
    monday.setDate(monday.getDate() + weekOffset * 7);

    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });

    const dayLabel = (d) =>
      d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });

    const reservationsInWeek = reservations.filter((r) => {
      if (normalizeStatus(r.status) !== "active") return false;
      const rStart = new Date(r.start);
      const rEnd = new Date(r.end);
      const weekEnd = new Date(days[6]);
      weekEnd.setHours(23, 59, 59);
      return rStart <= weekEnd && rEnd >= days[0];
    });

    return (
      <>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
          <button style={styles.buttonSecondary} onClick={() => setWeekOffset((w) => w - 1)}>
            ← Semaine précédente
          </button>
          <span style={{ fontWeight: "bold" }}>
            {days[0].toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} —{" "}
            {days[6].toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
          </span>
          <button style={styles.buttonSecondary} onClick={() => setWeekOffset((w) => w + 1)}>
            Semaine suivante →
          </button>
          {weekOffset !== 0 && (
            <button style={styles.buttonPrimary} onClick={() => setWeekOffset(0)}>
              Aujourd'hui
            </button>
          )}
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "700px" }}>
            <thead>
              <tr>
                <th style={calStyles.th}>Véhicule</th>
                {days.map((d, i) => {
                  const isToday = d.toDateString() === new Date().toDateString();
                  return (
                    <th key={i} style={{
                      ...calStyles.th,
                      background: isToday ? "#dbeafe" : "#f9fafb",
                      color: isToday ? "#1d4ed8" : "#222",
                    }}>
                      {dayLabel(d)}
                    </th>
                  );
                })}
              </tr>
            </thead>
           <tbody>
  {vehicles.map((v) => {
    return (
      <tr key={v.id}>
        <td style={calStyles.td}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              backgroundColor: v.status === "maintenance" ? "#dc2626" : "#16a34a",
              flexShrink: 0,
            }} />
            <span style={{ fontWeight: "bold", fontSize: "13px" }}>{v.name}</span>
          </div>
          <div style={{ fontSize: "11px", color: "#888" }}>{v.plate}</div>
        </td>

        {days.map((d, i) => {
          const dayStart = new Date(d);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(d);
          dayEnd.setHours(23, 59, 59, 999);

          const dayRes = reservationsInWeek.filter(
            (r) =>
              r.vehicleId === v.id &&
              new Date(r.start) <= dayEnd &&
              new Date(r.end) >= dayStart
          );

          return (
            <td key={i} style={{ ...calStyles.td, position: "relative", height: "80px", padding: 0 }}>
              {dayRes.map((r, ri) => {
                const rStart = new Date(r.start);
                const rEnd = new Date(r.end);

                // N'afficher que si la réservation commence ce jour ou si c'est le premier jour de la semaine
  const isFirstDay = rStart >= dayStart || i === 0;
  if (!isFirstDay) return null;

                // Calcule sur combien de jours restants dans la semaine la réservation s'étale
                let spanDays = 1;
                for (let j = i + 1; j < days.length; j++) {
                  const nextDayEnd = new Date(days[j]);
                  nextDayEnd.setHours(23, 59, 59, 999);
                  if (rEnd >= nextDayEnd) {
                    spanDays++;
                  } else if (rEnd > new Date(days[j]).setHours(0, 0, 0, 0)) {
                    spanDays++;
                    break;
                  } else {
                    break;
                  }
                }

                // Est-ce que la réservation commence ce jour ou avant ?
                const startsToday = rStart >= dayStart && rStart <= dayEnd;
                const startH = rStart.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
                const endH = rEnd.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

             // Décalage vertical — compte combien de réservations actives se chevauchent avant celle-ci
const topOffset = dayRes
  .slice(0, ri)
  .filter((prev) => {
    const isFirstDayPrev = new Date(prev.start) >= dayStart || i === 0;
    return isFirstDayPrev;
  }).length * 36;
                return (
                  <div
                    key={r.id}
                    style={{
                      position: "absolute",
                      top: `${topOffset + 4}px`,
                      left: "2px",
                      width: `calc(${spanDays * 100}% - 4px)`,
                      background: getPurposeColor(r.purpose),
                      color: "#fff",
                      borderRadius: "5px",
                      padding: "3px 6px",
                      fontSize: "11px",
                      zIndex: 10,
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                      textOverflow: "ellipsis",
                      boxSizing: "border-box",
                    }}
                  >
                    {startsToday ? `${startH} → ${endH} · ${r.user}` : r.user}
                  </div>
                );
              })}
            </td>
          );
        })}
      </tr>
    );
  })}
</tbody>
          </table>
        </div>
      </>
    );
  })()}
</div>


  <div style={styles.section}>
  <h2>Historique</h2>

  <button
    style={{ ...styles.buttonPrimary, marginBottom: "15px" }}
    onClick={() => setHistoryOpen(!historyOpen)}
  >
    {historyOpen ? "Masquer l'historique" : "Voir l'historique"}
  </button>

  {historyOpen && (
  <>
    <div style={styles.grid2}>
      <div>
        <label>Filtrer par véhicule</label><br />
        <select
          value={historyFilterVehicle}
          onChange={(e) => setHistoryFilterVehicle(e.target.value)}
          style={styles.input}
        >
          <option value="all">Tous les véhicules</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label>Filtrer par utilisateur</label><br />
        <select
          value={historyFilterUser}
          onChange={(e) => setHistoryFilterUser(e.target.value)}
          style={styles.input}
        >
          <option value="all">Tous les utilisateurs</option>
          {users.map((u) => (
            <option key={u.id} value={`${u.first_name} ${u.last_name}`}>
              {u.first_name} {u.last_name}
            </option>
          ))}
        </select>
      </div>
    </div>

    {(() => {
      const filtered = reservations
        .filter((r) =>
          (normalizeStatus(r.status) === "completed" && r.purpose !== "Initialisation") ||
          normalizeStatus(r.status) === "cancelled"
        )
        .filter((r) =>
          historyFilterVehicle === "all" ? true : r.vehicleId === historyFilterVehicle
        )
        .filter((r) =>
          historyFilterUser === "all" ? true : r.user === historyFilterUser
        )
        .slice()
        .sort((a, b) => new Date(b.end) - new Date(a.end))
        .reduce((acc, r) => {
          const date = new Date(r.end);
          const monthKey = date.toLocaleDateString("fr-FR", { year: "numeric", month: "long" });
          const dayKey = date.toLocaleDateString("fr-FR", { year: "numeric", month: "2-digit", day: "2-digit" });
          if (!acc[monthKey]) acc[monthKey] = {};
          if (!acc[monthKey][dayKey]) acc[monthKey][dayKey] = [];
          acc[monthKey][dayKey].push(r);
          return acc;
        }, {});

      return Object.keys(filtered).length === 0 ? (
        <div style={styles.card}>Aucun historique</div>
      ) : (
        Object.entries(filtered).map(([month, days]) => (
          <div key={month} style={{ marginBottom: 25 }}>
            <h3 style={{ marginBottom: 10 }}>{month}</h3>
            {Object.entries(days).map(([day, items]) => (
              <div key={day} style={{ marginLeft: 10, marginBottom: 20 }}>
                <h4 style={{ marginBottom: 10 }}>{day}</h4>
                <div style={styles.gridCards}>
                  {items.map((r) => {
                    const isCancelled = r.status === "cancelled";
                    const isCompleted = r.status === "completed";
                    return (
                      <div
                        key={r.id}
                        style={{
                          ...styles.card,
                          borderLeft: isCompleted
                            ? "5px solid #16a34a"
                            : isCancelled
                            ? "5px solid #dc2626"
                            : "5px solid #2563eb",
                        }}
                      >
                        <h3 style={{ marginBottom: 8 }}>{vehicleName(r.vehicleId)}</h3>
                        <p><strong>Début :</strong> {formatDate(r.start)}</p>
                        <p><strong>Fin :</strong> {formatDate(r.end)}</p>
                        <p><strong>Durée :</strong> {formatDurationSmart(r.start, r.end)}</p>
                        <p><strong>Utilisateur :</strong> {r.user}</p>
                        <hr style={{ margin: "10px 0" }} />
                        <p><strong>Départ :</strong> {formatMileage(r.startMileage)} km</p>
                        <p><strong>État départ :</strong> {r.departureNotes || "—"}</p>
                        <p><strong>Retour :</strong> {formatMileage(r.endMileage)}</p>
                        <p><strong>État retour :</strong> {r.returnNotes || "—"}</p>
                        <p style={{ marginTop: 10 }}>
                          <strong>Statut :</strong>{" "}
                          {isCompleted ? "Terminée" : isCancelled ? "Annulée" : r.status}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ))
      );
    })()}
  </>
)}
</div>

<div style={styles.section}>
          <h2>Créer une réservation</h2>

          {error && <div style={styles.error}>{error}</div>}
          {success && <div style={styles.success}>{success}</div>}

          <div style={styles.grid2}>
            <div>
              <label>Véhicule</label><br />
              <select
                value={form.vehicleId}
                onChange={(e) => setForm((f) => ({ ...f, vehicleId: e.target.value }))}
                style={styles.input}
              >
                <option value="">Choisir un véhicule</option>
                {vehicles.map((vehicle) => (
  <option
    key={vehicle.id}
    value={vehicle.id}
    disabled={vehicle.status === "maintenance"}
  >
    {vehicle.name} — {vehicle.plate}
    {vehicle.status === "maintenance" ? " (maintenance)" : ""}
  </option>
))}

              </select>
            </div>

            <div>
              <label>Nom du réservant</label><br />
              <select
                value={form.user}
                onChange={(e) => setForm((f) => ({ ...f, user: e.target.value }))}
                style={styles.input}
              >
                <option value="">Choisir un salarié</option>
                {users.map((user) => (
                  <option key={user.id} value={`u${user.id}`}>
                    {user.first_name} {user.last_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label>Site de départ</label><br />
              <select
                value={form.fromSiteId}
                onChange={(e) => setForm((f) => ({ ...f, fromSiteId: e.target.value }))}
                style={styles.input}
              >
                <option value="">Choisir un site</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>{site.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label>Site d'arrivée</label><br />
              <select
                value={form.toSiteId}
                onChange={(e) => setForm((f) => ({ ...f, toSiteId: e.target.value }))}
                style={styles.input}
              >
                <option value="">Choisir un site</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>{site.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label>Début</label><br />
             <input
  type="datetime-local"
  value={form.start}
  min={new Date().toISOString().slice(0, 16)}
  step={900}
  onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))}
  style={styles.input}
/>
            </div>

            <div>
              <label>Fin</label><br />
             <input
  type="datetime-local"
  value={form.end}
  min={form.start || new Date().toISOString().slice(0, 16)}
  step={900}
  onChange={(e) => setForm((f) => ({ ...f, end: e.target.value }))}
  style={styles.input}
/>
            </div>
          </div>

<div style={{ marginTop: 12 }}>
  <label>
  Kilométrage au départ{" "}
  <span style={{ color: "red" }}>*</span>
</label>
<br />
 <input
  type="text"
  value={form.startMileage}
  onChange={(e) =>
    setForm((f) => ({
      ...f,
      startMileage: formatMileageInput(e.target.value),
    }))
  }
  style={styles.input}
  placeholder="Ex : 125 000"
/>
{form.vehicleId && (() => {
  const lastRes = reservations
    .filter(
      (r) =>
        r.vehicleId === form.vehicleId &&
        normalizeStatus(r.status) === "completed" && r.purpose !== "Initialisation" &&
        r.endMileage !== null
    )
    .sort((a, b) => new Date(b.end) - new Date(a.end))[0];

  return lastRes ? (
    <p style={{ marginTop: 6, color: "#666" }}>
      Dernier kilométrage connu :{" "}
      <strong>{Number(lastRes.endMileage).toLocaleString("fr-FR")} km</strong>
    </p>
  ) : (
    <p style={{ marginTop: 6, color: "#666" }}>
      Aucun kilométrage connu pour ce véhicule.
    </p>
  );
})()}
</div>

<div style={{ marginTop: 12 }}>
  <label>
  État du véhicule avant départ <span style={{ color: "red" }}>*</span>
</label>
<br />
  <textarea
    value={form.departureNotes}
    onChange={(e) =>
      setForm((f) => ({
        ...f,
        departureNotes: e.target.value,
      }))
    }
    style={styles.input}
    rows={4}
    placeholder="Rayure, propreté, voyant allumé, pneu usé, etc."
  />
</div>

          <div style={{ marginTop: 12 }}>
  <label>
    Motif <span style={{ color: "red" }}>*</span>
  </label>
  <br />
  <select
    value={form.purpose}
    onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
    style={styles.input}
  >
    <option value="">Choisir un motif</option>
    <option value="Livraison">Livraison</option>
    <option value="Archive">Archive</option>
    <option value="Vide Maison">Vide Maison</option>
    <option value="Déchetterie">Déchetterie</option>
    <option value="Usage Personnel">Usage Personnel</option>
  </select>
</div>

        <div style={{ marginTop: 16 }}>
            <button onClick={handleCreateReservation} style={styles.buttonPrimary}>
              Créer la réservation
            </button>
          </div>
        </div>
      </>}
      </div>
    </div>
      
  );
}

const styles = {
  page: {
    fontFamily: "Arial, sans-serif",
    background: "#f4f6f8",
    minHeight: "100vh",
    padding: "20px",
    color: "#222",
  },
  container: {
    maxWidth: "1000px",
    margin: "0 auto",
  },
  subtitle: {
    color: "#555",
    marginBottom: "20px",
  },
  section: {
    background: "#fff",
    padding: "20px",
    borderRadius: "10px",
    marginBottom: "20px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  },
  stats: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "12px",
    marginBottom: "20px",
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    gap: "12px",
  },
  gridCards: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    gap: "12px",
  },
  card: {
    background: "#fff",
    border: "1px solid #ddd",
    borderRadius: "10px",
    padding: "16px",
  },
  input: {
    width: "100%",
    padding: "10px",
    marginTop: "6px",
    borderRadius: "6px",
    border: "1px solid #bbb",
    boxSizing: "border-box",
  background: "#F7F7F7",
  color: "#222",
  colorScheme: "light",
  },
  buttonPrimary: {
    background: "#696F80",
    color: "#ffffff",
    border: "none",
    borderRadius: "6px",
    padding: "10px 16px",
    cursor: "pointer",
  },
  buttonSecondary: {
    background: "#e5e7eb",
    color: "#000000",
    border: "none",
    borderRadius: "6px",
    padding: "10px 16px",
    cursor: "pointer",
  },
  error: {
    background: "#fee2e2",
    color: "#991b1b",
    padding: "10px",
    borderRadius: "6px",
    marginBottom: "12px",
  },
  success: {
    background: "#dcfce7",
    color: "#166534",
    padding: "10px",
    borderRadius: "6px",
    marginBottom: "12px",
  },
  modalOverlay: {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "rgba(0,0,0,0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
},

modal: {
  background: "#fff",
  padding: "20px",
  borderRadius: "10px",
  width: "400px",
  maxWidth: "90%",
},
}; 
const calStyles = {
  th: {
    padding: "10px 8px",
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    textAlign: "center",
    fontSize: "13px",
    fontWeight: "bold",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "6px 8px",
    border: "1px solid #e5e7eb",
    verticalAlign: "top",
    minWidth: "100px",
    fontSize: "12px",
    position: "relative",
  },
};
