const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");
const path = require("path");

const multer = require("multer");
const fs = require("fs");

const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + "-" + file.originalname);
  },
});

const upload = multer({ storage });

const app = express();
const PORT = 3001;
const dbPath = path.join(__dirname, "fleet.db");
const db = new Database(dbPath);

app.use(cors());
app.use(express.json());

function nowIso() {
  return new Date().toISOString();
}

function parseDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS sites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK(role IN ('employee', 'manager', 'admin')),
  is_authorized_driver INTEGER NOT NULL DEFAULT 0 CHECK(is_authorized_driver IN (0,1)),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
  site_id INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(site_id) REFERENCES sites(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS vehicles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  internal_name TEXT NOT NULL,
  registration_number TEXT NOT NULL UNIQUE,
  vehicle_type TEXT NOT NULL CHECK(vehicle_type IN ('Voiture', 'Camionnette', 'Camion')),
  origin_site_id INTEGER NOT NULL,
  current_site_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available', 'maintenance')),
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(origin_site_id) REFERENCES sites(id) ON DELETE RESTRICT,
  FOREIGN KEY(current_site_id) REFERENCES sites(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS reservations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  from_site_id INTEGER NOT NULL,
  to_site_id INTEGER NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  purpose TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'cancelled', 'completed')),
  cancelled_at TEXT,
  cancelled_by_user_id INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(vehicle_id) REFERENCES vehicles(id) ON DELETE RESTRICT,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY(from_site_id) REFERENCES sites(id) ON DELETE RESTRICT,
  FOREIGN KEY(to_site_id) REFERENCES sites(id) ON DELETE RESTRICT,
  FOREIGN KEY(cancelled_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS maintenance_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id INTEGER NOT NULL,
  declared_by_user_id INTEGER NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'closed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(vehicle_id) REFERENCES vehicles(id) ON DELETE RESTRICT,
  FOREIGN KEY(declared_by_user_id) REFERENCES users(id) ON DELETE RESTRICT
);

`);

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER NOT NULL,
      label TEXT NOT NULL,
      filename TEXT NOT NULL,
      mimetype TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
    );
  `);
} catch {}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS vehicle_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER NOT NULL,
      reservation_id INTEGER NOT NULL,
      user_name TEXT NOT NULL,
      report_type TEXT NOT NULL CHECK(report_type IN ('departure', 'return')),
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'resolved')),
      resolved_at TEXT,
      resolved_by TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
      FOREIGN KEY(reservation_id) REFERENCES reservations(id) ON DELETE CASCADE
    );
  `);
} catch {}

try { db.exec(`ALTER TABLE reservations ADD COLUMN start_mileage INTEGER;`); } catch {}
try { db.exec(`ALTER TABLE reservations ADD COLUMN end_mileage INTEGER;`); } catch {}
try { db.exec(`ALTER TABLE reservations ADD COLUMN departure_notes TEXT;`); } catch {}
try { db.exec(`ALTER TABLE reservations ADD COLUMN return_notes TEXT;`); } catch {}
try { db.exec(`ALTER TABLE vehicles ADD COLUMN ct_expiry_date TEXT;`); } catch {}
try { db.exec(`ALTER TABLE vehicles ADD COLUMN revision_interval_km INTEGER;`); } catch {}
try { db.exec(`ALTER TABLE vehicles ADD COLUMN last_revision_km INTEGER;`); } catch {}
try { db.exec(`ALTER TABLE vehicles ADD COLUMN fuel_type TEXT;`); } catch {}


function seedData() {
  const siteCount = db.prepare("SELECT COUNT(*) AS count FROM sites").get().count;
  if (siteCount === 0) {
    const ts = nowIso();
    const stmt = db.prepare("INSERT INTO sites (name, created_at, updated_at) VALUES (?, ?, ?)");
    [
      "La Chapelle Saint Luc",
      "Romilly Sur Seine",
      "KantinetiK",
      "Bocaloca",
      "CEJ JR 77",
  "Paris",
    ].forEach((name) => stmt.run(name, ts, ts));
  }

  const userCount = db.prepare("SELECT COUNT(*) AS count FROM users").get().count;
  if (userCount === 0) {
    const ts = nowIso();
    const stmt = db.prepare(`
      INSERT INTO users (
        first_name, last_name, email, role, is_authorized_driver, is_active, site_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    [
      ["Marie", "Dupont", "marie@example.org", "employee", 1, 1, 1],
      ["Lucas", "Martin", "lucas@example.org", "employee", 1, 1, 2],
      ["Sonia", "Bernard", "sonia@example.org", "manager", 1, 1, 3],
      ["Admin", "Association", "admin@example.org", "admin", 1, 1, 1],
    ].forEach((u) => stmt.run(...u, ts, ts));
  }

  const vehicleCount = db.prepare("SELECT COUNT(*) AS count FROM vehicles").get().count;
  if (vehicleCount === 0) {
    const ts = nowIso();
    const stmt = db.prepare(`
      INSERT INTO vehicles (
        internal_name, registration_number, vehicle_type, origin_site_id, current_site_id, status, notes, fuel_type, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    [
      ["Renault Captur",          "FJ-019-WE", "Voiture",      1, 1, "available", null, "ES"],
      ["Renault Clio",            "FA-787-FY", "Voiture",      1, 1, "available", null, "ES"],
      ["Renault Clio",            "FJ-920-WD", "Voiture",      1, 1, "available", null, "ES"],
      ["Renault Kangoo Express",  "EM-009-BC", "Camionnette",  1, 1, "available", null, "E"],
      ["Renault Kangoo Frigo",    "CT-178-BF", "Camionnette",  3, 3, "available", null, "GO"],
      ["Renault Zoe Blanche",     "FF-690-WX", "Voiture",      1, 1, "available", null, "E"],
      ["Dacia Logan",             "BA-653-WS", "Voiture",      1, 1, "available", null, "ES"],
      ["Renault Kangoo Express",  "DM-192-VR", "Camionnette",  1, 1, "available", null, "E"],
      ["Volkswagen Caddy Rouge",  "BL-248-QX", "Camionnette",  1, 1, "available", null, "GO"],
      ["Citroën C5X",             "GQ-098-CF", "Voiture",      1, 1, "available", null, "EE"],
      ["Renault Zoe Bleue",       "EN-413-TF", "Voiture",      1, 1, "available", null, "E"],
      ["Renault Traffic",         "CZ-719-MB", "Camion",       1, 1, "available", null, "GO"],
      ["Peugeot Boxer",           "AB-063-GV", "Camion",       1, 1, "available", null, "GO"],
      ["Renault Master Benne",    "GJ-622-GZ", "Camion",       1, 1, "available", null, "GO"],
      ["Renault Expert",          "DH-883-SV", "Camion",       4, 4, "available", null, "GO"],
      ["Renault Master",          "FZ-421-DA", "Camion",       1, 1, "available", null, "GO"],
      ["Renault Maxity Haillon",  "CK-644-HM", "Camion",       1, 1, "available", null, "GO"],
      ["Renault Master",          "AV-474-NJ", "Camion",       1, 1, "available", null, "GO"],
      ["Renault Maxity",          "DD-790-QB", "Camion",       1, 1, "available", null, "GO"],
    ].forEach((v) => stmt.run(...v, ts, ts));
  }
}

seedData();

function getVehicleById(id) {
  return db.prepare("SELECT * FROM vehicles WHERE id = ?").get(id);
}

function getUserById(id) {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id);
}

function hasOpenMaintenance(vehicleId) {
  const row = db.prepare(`
    SELECT id FROM maintenance_events
    WHERE vehicle_id = ? AND status = 'open'
    LIMIT 1
  `).get(vehicleId);
  return Boolean(row);
}

function hasReservationConflict(vehicleId, startAt, endAt) {
  const row = db.prepare(`
    SELECT id FROM reservations
    WHERE vehicle_id = ?
      AND status = 'active'
      AND start_at < ?
      AND end_at > ?
    LIMIT 1
  `).get(vehicleId, endAt, startAt);
  return Boolean(row);
}

app.delete("/api/vehicles/:id", (req, res) => {
  const vehicleId = Number(req.params.id);

  const vehicle = db.prepare("SELECT * FROM vehicles WHERE id = ?").get(vehicleId);
  if (!vehicle) {
    return res.status(404).json({ error: "Véhicule introuvable." });
  }

  const activeReservation = db.prepare(`
    SELECT id FROM reservations
    WHERE vehicle_id = ? AND status = 'active'
    LIMIT 1
  `).get(vehicleId);

  if (activeReservation) {
    return res.status(409).json({ error: "Impossible de supprimer un véhicule avec une réservation active." });
  }

  db.prepare("DELETE FROM maintenance_events WHERE vehicle_id = ?").run(vehicleId);
  db.prepare("DELETE FROM reservations WHERE vehicle_id = ?").run(vehicleId);
  db.prepare("DELETE FROM vehicles WHERE id = ?").run(vehicleId);

  res.json({ message: "Véhicule supprimé." });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, message: "API flotte OK" });
});

app.get("/api/sites", (_req, res) => {
  const rows = db.prepare("SELECT * FROM sites ORDER BY name").all();
  res.json(rows);
});

app.get("/api/users", (_req, res) => {
  const rows = db.prepare(`
    SELECT u.*, s.name AS site_name
    FROM users u
    LEFT JOIN sites s ON s.id = u.site_id
    ORDER BY u.last_name, u.first_name
  `).all();
  res.json(rows);
});

app.get("/api/vehicles", (_req, res) => {
  const rows = db.prepare(`
    SELECT
      v.*,
      os.name AS origin_site_name,
      cs.name AS current_site_name
    FROM vehicles v
    JOIN sites os ON os.id = v.origin_site_id
    JOIN sites cs ON cs.id = v.current_site_id
    ORDER BY v.internal_name
  `).all();
  res.json(rows);
});

app.get("/api/reservations", (_req, res) => {
  const rows = db.prepare(`
    SELECT
      r.*,
      v.internal_name AS vehicle_name,
      u.first_name || ' ' || u.last_name AS user_name,
      fs.name AS from_site_name,
      ts.name AS to_site_name
    FROM reservations r
    JOIN vehicles v ON v.id = r.vehicle_id
    JOIN users u ON u.id = r.user_id
    JOIN sites fs ON fs.id = r.from_site_id
    JOIN sites ts ON ts.id = r.to_site_id
    ORDER BY r.start_at DESC
  `).all();
  res.json(rows);
});

app.post("/api/reservations", (req, res) => {
  const {
  vehicle_id,
  user_id,
  from_site_id,
  to_site_id,
  start_at,
  end_at,
  purpose,
  start_mileage,
  departure_notes
} = req.body;

  if (!vehicle_id || !user_id || !from_site_id || !to_site_id || !start_at || !end_at) {
    return res.status(400).json({ error: "Champs obligatoires manquants." });
  }

  const startDate = parseDate(start_at);
  const endDate = parseDate(end_at);
  if (!startDate || !endDate || startDate >= endDate) {
    return res.status(400).json({ error: "Dates invalides." });
  }

  const vehicle = getVehicleById(Number(vehicle_id));
  if (!vehicle) {
    return res.status(404).json({ error: "Véhicule introuvable." });
  }

  const user = getUserById(Number(user_id));
  if (!user || !user.is_active) {
    return res.status(404).json({ error: "Utilisateur introuvable ou inactif." });
  }

  if (!user.is_authorized_driver) {
    return res.status(403).json({ error: "Utilisateur non habilité." });
  }

  if (vehicle.status === "maintenance" || hasOpenMaintenance(vehicle.id)) {
    return res.status(409).json({ error: "Véhicule en maintenance." });
  }

  if (hasReservationConflict(vehicle.id, start_at, end_at)) {
    return res.status(409).json({ error: "Conflit de réservation." });
  }

  const ts = nowIso();
 const result = db.prepare(`
  INSERT INTO reservations (
    vehicle_id,
    user_id,
    from_site_id,
    to_site_id,
    start_at,
    end_at,
    purpose,
    start_mileage,
    departure_notes,
    created_at,
    updated_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  Number(vehicle_id),
  Number(user_id),
  Number(from_site_id),
  Number(to_site_id),
  start_at,
  end_at,
  purpose || null,
  start_mileage !== "" && start_mileage != null
    ? Number(start_mileage)
    : null,
  departure_notes || null,
  nowIso(),
  nowIso()
);

  const created = db.prepare("SELECT * FROM reservations WHERE id = ?").get(result.lastInsertRowid);
  console.log("RESERVATION CREATED :", created);
  res.status(201).json(created);
});

app.patch("/api/reservations/:id/cancel", (req, res) => {
  const reservationId = Number(req.params.id);
  const { cancelled_by_user_id } = req.body;

  const reservation = db.prepare("SELECT * FROM reservations WHERE id = ?").get(reservationId);
  if (!reservation) {
    return res.status(404).json({ error: "Réservation introuvable." });
  }

  if (reservation.status !== "active") {
    return res.status(400).json({ error: "Seule une réservation active peut être annulée." });
  }

  const ts = nowIso();
  db.prepare(`
    UPDATE reservations
    SET status = 'cancelled',
        cancelled_at = ?,
        cancelled_by_user_id = ?,
        updated_at = ?
    WHERE id = ?
  `).run(ts, cancelled_by_user_id || null, ts, reservationId);

  const updated = db.prepare("SELECT * FROM reservations WHERE id = ?").get(reservationId);
  res.json(updated);
});

app.post("/api/maintenance", (req, res) => {
  const { vehicle_id, declared_by_user_id, reason } = req.body;
  

  if (!vehicle_id || !declared_by_user_id) {
    return res.status(400).json({ error: "vehicle_id et declared_by_user_id sont obligatoires." });
  }

  const vehicle = getVehicleById(Number(vehicle_id));
  if (!vehicle) {
    return res.status(404).json({ error: "Véhicule introuvable." });
  }

  const user = getUserById(Number(declared_by_user_id));
  if (!user) {
    return res.status(404).json({ error: "Utilisateur introuvable." });
  }

  if (!["manager", "admin"].includes(user.role)) {
    return res.status(403).json({ error: "Seuls manager et admin peuvent ouvrir une maintenance." });
  }

  if (hasOpenMaintenance(vehicle.id)) {
    return res.status(409).json({ error: "Une maintenance ouverte existe déjà." });
  }

  const ts = nowIso();
  const result = db.prepare(`
    INSERT INTO maintenance_events (
      vehicle_id, declared_by_user_id, start_at, end_at, reason, status, created_at, updated_at
    ) VALUES (?, ?, ?, NULL, ?, 'open', ?, ?)
  `).run(Number(vehicle_id), Number(declared_by_user_id), ts, reason || null, ts, ts);

  db.prepare("UPDATE vehicles SET status = 'maintenance', updated_at = ? WHERE id = ?")
    .run(ts, Number(vehicle_id));

  const created = db.prepare("SELECT * FROM maintenance_events WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json(created);
});

app.get("/api/maintenance", (_req, res) => {
 
  const rows = db.prepare(`
    SELECT
      m.*,
      v.internal_name AS vehicle_name,
      v.registration_number,
      u.first_name || ' ' || u.last_name AS declared_by_name
    FROM maintenance_events m
    JOIN vehicles v ON v.id = m.vehicle_id
    JOIN users u ON u.id = m.declared_by_user_id
    ORDER BY m.start_at DESC
  `).all();

  res.json(rows);
});

app.patch("/api/maintenance/:id/close", (req, res) => {
  const maintenanceId = Number(req.params.id);
  

  const maintenance = db
    .prepare("SELECT * FROM maintenance_events WHERE id = ?")
    .get(maintenanceId);

  if (!maintenance) {
    return res.status(404).json({ error: "Maintenance introuvable." });
  }

  if (maintenance.status !== "open") {
    return res.status(400).json({ error: "Cette maintenance est déjà fermée." });
  }

  const ts = nowIso();

  db.prepare(`
    UPDATE maintenance_events
    SET status = 'closed',
        end_at = ?,
        updated_at = ?
    WHERE id = ?
  `).run(ts, ts, maintenanceId);

  const stillOpen = db.prepare(`
    SELECT id
    FROM maintenance_events
    WHERE vehicle_id = ? AND status = 'open'
    LIMIT 1
  `).get(maintenance.vehicle_id);

  if (!stillOpen) {
    db.prepare(`
      UPDATE vehicles
      SET status = 'available',
          updated_at = ?
      WHERE id = ?
    `).run(ts, maintenance.vehicle_id);
  }

  const updated = db
    .prepare("SELECT * FROM maintenance_events WHERE id = ?")
    .get(maintenanceId);

  res.json(updated);
});

app.patch("/api/vehicles/:id/available", (req, res) => {
  
  const vehicleId = Number(req.params.id);
  const vehicle = db.prepare("SELECT * FROM vehicles WHERE id = ?").get(vehicleId);

  if (!vehicle) {
    return res.status(404).json({ error: "Véhicule introuvable." });
  }

  const ts = nowIso();

  db.prepare(`
    UPDATE maintenance_events
    SET status = 'closed',
        end_at = ?,
        updated_at = ?
    WHERE vehicle_id = ? AND status = 'open'
  `).run(ts, ts, vehicleId);

  db.prepare(`
    UPDATE vehicles
    SET status = 'available',
        updated_at = ?
    WHERE id = ?
  `).run(ts, vehicleId);

  const updatedVehicle = db.prepare("SELECT * FROM vehicles WHERE id = ?").get(vehicleId);

  res.json({
    message: "Véhicule remis disponible.",
    vehicle: updatedVehicle
  });
});

app.patch("/api/reservations/:id/complete", (req, res) => {
  const reservationId = Number(req.params.id);


  const reservation = db.prepare("SELECT * FROM reservations WHERE id = ?").get(reservationId);
  if (!reservation) {
    return res.status(404).json({ error: "Réservation introuvable." });
  }

  if (reservation.status !== "active") {
    return res.status(400).json({ error: "Seule une réservation active peut être terminée." });
  }

  const ts = nowIso();

  db.prepare(`
  UPDATE reservations
  SET status = 'completed',
      end_mileage = ?,
      return_notes = ?,
      updated_at = ?
  WHERE id = ?
`).run(
  Number(req.body.end_mileage),
  req.body.return_notes || null,
  ts,
  reservationId
);

  db.prepare(`
    UPDATE vehicles
    SET current_site_id = ?,
        updated_at = ?
    WHERE id = ?
  `).run(reservation.to_site_id, ts, reservation.vehicle_id);

  const updated = db.prepare("SELECT * FROM reservations WHERE id = ?").get(reservationId);
const NEUTRAL_KEYWORDS = [
  "ok", "ras", "rien", "nickel", "propre", "bon", "bien",
  "parfait", "impeccable", "correct", "vide", "néant", "—", "-", ""
];

function isSignificant(text) {
  if (!text || !text.trim()) return false;
  const lower = text.trim().toLowerCase();
  return !NEUTRAL_KEYWORDS.some((k) => lower === k || lower === k.toLowerCase());
}

const completedRes = db.prepare("SELECT * FROM reservations WHERE id = ?").get(reservationId);
const declaredUser = completedRes ? db.prepare("SELECT first_name || ' ' || last_name AS name FROM users WHERE id = ?").get(completedRes.user_id) : null;
const userName = declaredUser ? declaredUser.name : "Inconnu";

if (isSignificant(completedRes?.departure_notes)) {
  db.prepare(`
    INSERT INTO vehicle_reports (vehicle_id, reservation_id, user_name, report_type, content, created_at)
    VALUES (?, ?, ?, 'departure', ?, ?)
  `).run(completedRes.vehicle_id, reservationId, userName, completedRes.departure_notes, nowIso());
}

if (isSignificant(req.body.return_notes)) {
  db.prepare(`
    INSERT INTO vehicle_reports (vehicle_id, reservation_id, user_name, report_type, content, created_at)
    VALUES (?, ?, ?, 'return', ?, ?)
  `).run(completedRes.vehicle_id, reservationId, userName, req.body.return_notes, nowIso());
}
  res.json(updated);
});

app.patch("/api/vehicles/:id/settings", (req, res) => {
  console.log("SETTINGS ROUTE HIT", req.params.id, req.body);
  
  const vehicleId = Number(req.params.id);
  const { ct_expiry_date, revision_interval_km, last_revision_km, fuel_type } = req.body;

  const vehicle = db.prepare("SELECT * FROM vehicles WHERE id = ?").get(vehicleId);
  if (!vehicle) {
    return res.status(404).json({ error: "Véhicule introuvable." });
  }

  const ts = nowIso();
  db.prepare(`
    UPDATE vehicles
    SET ct_expiry_date = ?,
        revision_interval_km = ?,
        last_revision_km = ?,
        fuel_type = ?,
        updated_at = ?
    WHERE id = ?
  `).run(
    ct_expiry_date || null,
    revision_interval_km ? Number(revision_interval_km) : null,
    last_revision_km ? Number(last_revision_km) : null,
    fuel_type || null,
    ts,
    vehicleId
  );

  const updated = db.prepare("SELECT * FROM vehicles WHERE id = ?").get(vehicleId);
  res.json(updated);
});

// Upload document
app.post("/api/vehicles/:id/documents", upload.single("file"), (req, res) => {
  const vehicleId = Number(req.params.id);
  const { label } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: "Aucun fichier reçu." });
  }

  const ts = nowIso();
  const result = db.prepare(`
    INSERT INTO documents (vehicle_id, label, filename, mimetype, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(vehicleId, label || req.file.originalname, req.file.filename, req.file.mimetype, ts);

  const created = db.prepare("SELECT * FROM documents WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json(created);
});

// Lister les documents d'un véhicule
app.get("/api/vehicles/:id/documents", (req, res) => {
  const vehicleId = Number(req.params.id);
  const rows = db.prepare("SELECT * FROM documents WHERE vehicle_id = ? ORDER BY created_at DESC").all(vehicleId);
  res.json(rows);
});

// Télécharger un document
app.get("/api/documents/:filename", (req, res) => {
  const filePath = path.join(__dirname, "uploads", req.params.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Fichier introuvable." });
  }
  res.sendFile(filePath);
});

// Supprimer un document
app.delete("/api/documents/:id", (req, res) => {
  const docId = Number(req.params.id);
  const doc = db.prepare("SELECT * FROM documents WHERE id = ?").get(docId);
  if (!doc) return res.status(404).json({ error: "Document introuvable." });

  const filePath = path.join(__dirname, "uploads", doc.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  db.prepare("DELETE FROM documents WHERE id = ?").run(docId);
  res.json({ message: "Document supprimé." });
});
// SITES
app.post("/api/sites", (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Nom obligatoire." });
  const ts = nowIso();
  try {
    const result = db.prepare("INSERT INTO sites (name, created_at, updated_at) VALUES (?, ?, ?)").run(name, ts, ts);
    const created = db.prepare("SELECT * FROM sites WHERE id = ?").get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch {
    res.status(409).json({ error: "Ce site existe déjà." });
  }
});

app.delete("/api/sites/:id", (req, res) => {
  const siteId = Number(req.params.id);
  try {
    db.prepare("DELETE FROM sites WHERE id = ?").run(siteId);
    res.json({ message: "Site supprimé." });
  } catch {
    res.status(409).json({ error: "Impossible de supprimer ce site, il est utilisé." });
  }
});

// VEHICULES
app.post("/api/vehicles", (req, res) => {
  const { internal_name, registration_number, vehicle_type, origin_site_id, current_site_id, fuel_type } = req.body;
  if (!internal_name || !registration_number || !vehicle_type || !origin_site_id || !current_site_id) {
    return res.status(400).json({ error: "Champs obligatoires manquants." });
  }
  const ts = nowIso();
  try {
    const result = db.prepare(`
      INSERT INTO vehicles (internal_name, registration_number, vehicle_type, origin_site_id, current_site_id, status, fuel_type, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'available', ?, ?, ?)
    `).run(internal_name, registration_number, vehicle_type, Number(origin_site_id), Number(current_site_id), fuel_type || null, ts, ts);
    const created = db.prepare("SELECT * FROM vehicles WHERE id = ?").get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch {
    res.status(409).json({ error: "Immatriculation déjà existante." });
  }
});

app.patch("/api/vehicles/:id", (req, res) => {
  const vehicleId = Number(req.params.id);
  const { internal_name, registration_number, vehicle_type, origin_site_id, current_site_id, fuel_type } = req.body;
  const ts = nowIso();
  db.prepare(`
    UPDATE vehicles SET internal_name = ?, registration_number = ?, vehicle_type = ?, origin_site_id = ?, current_site_id = ?, fuel_type = ?, updated_at = ?
    WHERE id = ?
  `).run(internal_name, registration_number, vehicle_type, Number(origin_site_id), Number(current_site_id), fuel_type || null, ts, vehicleId);
  const updated = db.prepare("SELECT * FROM vehicles WHERE id = ?").get(vehicleId);
  res.json(updated);
});

// UTILISATEURS
app.post("/api/users", (req, res) => {
  const { first_name, last_name, email, role, is_authorized_driver, site_id } = req.body;
  if (!first_name || !last_name || !email || !role) {
    return res.status(400).json({ error: "Champs obligatoires manquants." });
  }
  const ts = nowIso();
  try {
    const result = db.prepare(`
      INSERT INTO users (first_name, last_name, email, role, is_authorized_driver, is_active, site_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
    `).run(first_name, last_name, email, role, is_authorized_driver ? 1 : 0, site_id || null, ts, ts);
    const created = db.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch {
    res.status(409).json({ error: "Email déjà utilisé." });
  }
});

app.patch("/api/users/:id", (req, res) => {
  const userId = Number(req.params.id);
  const { first_name, last_name, email, role, is_authorized_driver, is_active, site_id } = req.body;
  const ts = nowIso();
  db.prepare(`
    UPDATE users SET first_name = ?, last_name = ?, email = ?, role = ?, is_authorized_driver = ?, is_active = ?, site_id = ?, updated_at = ?
    WHERE id = ?
  `).run(first_name, last_name, email, role, is_authorized_driver ? 1 : 0, is_active ? 1 : 0, site_id || null, ts, userId);
  const updated = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  res.json(updated);
});

app.delete("/api/users/:id", (req, res) => {
  const userId = Number(req.params.id);
  try {
    db.prepare("DELETE FROM users WHERE id = ?").run(userId);
    res.json({ message: "Utilisateur supprimé." });
  } catch {
    res.status(409).json({ error: "Impossible de supprimer cet utilisateur." });
  }
});
// REPORTS
app.get("/api/vehicles/:id/reports", (req, res) => {
  const vehicleId = Number(req.params.id);
  const rows = db.prepare("SELECT * FROM vehicle_reports WHERE vehicle_id = ? ORDER BY created_at DESC").all(vehicleId);
  res.json(rows);
});

app.patch("/api/reports/:id/resolve", (req, res) => {
  const reportId = Number(req.params.id);
  const { resolved_by } = req.body;
  const ts = nowIso();
  db.prepare(`
    UPDATE vehicle_reports SET status = 'resolved', resolved_at = ?, resolved_by = ? WHERE id = ?
  `).run(ts, resolved_by || "Admin", reportId);
  const updated = db.prepare("SELECT * FROM vehicle_reports WHERE id = ?").get(reportId);
  res.json(updated);
});
// Purge historique réservations
app.delete("/api/reservations/history", (req, res) => {
  db.prepare(`
    DELETE FROM reservations WHERE status IN ('completed', 'cancelled')
  `).run();
  res.json({ message: "Historique des réservations supprimé." });
});

// Purge historique maintenances
app.delete("/api/maintenance/history", (req, res) => {
  db.prepare(`
    DELETE FROM maintenance_events WHERE status = 'closed'
  `).run();
  res.json({ message: "Historique des maintenances supprimé." });
});
app.patch("/api/vehicles/:id/initial-mileage", (req, res) => {
  const vehicleId = Number(req.params.id);
  const { mileage } = req.body;

  if (!mileage || isNaN(Number(mileage))) {
    return res.status(400).json({ error: "Kilométrage invalide." });
  }

  const vehicle = db.prepare("SELECT * FROM vehicles WHERE id = ?").get(vehicleId);
  if (!vehicle) return res.status(404).json({ error: "Véhicule introuvable." });

  const ts = nowIso();
  db.prepare(`
    INSERT INTO reservations (
      vehicle_id, user_id, from_site_id, to_site_id,
      start_at, end_at, purpose, start_mileage, end_mileage,
      departure_notes, return_notes, status, created_at, updated_at
    ) VALUES (?, 1, 1, 1, ?, ?, 'Initialisation', ?, ?, 'Initialisation', 'Initialisation', 'completed', ?, ?)
  `).run(vehicleId, ts, ts, Number(mileage), Number(mileage), ts, ts);

  res.json({ message: "Kilométrage initialisé." });
});
const server = app.listen(PORT, () => {
  console.log("SERVER FILE OK - ROUTES MAINTENANCE CHARGEES");
  console.log(`API flotte démarrée sur http://localhost:${PORT}`);
  console.log(`Base SQLite : ${dbPath}`);
});

server.on("error", (err) => {
  console.error("Erreur serveur HTTP :", err);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception :", err);
});

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection :", err);
});

// Garde le process actif de façon simple pendant les tests locaux
setInterval(() => {}, 60 * 60 * 1000);