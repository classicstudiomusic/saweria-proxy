// ============================================================
// SAWERIA PROXY SERVER
// Node.js (Express) - Deploy GRATIS di Railway atau Render
//
// FUNGSI:
//   - Menerima webhook dari Saweria
//   - Menyimpan donasi di queue
//   - Roblox poll kesini setiap beberapa detik
//
// CARA DEPLOY DI RAILWAY (gratis):
//   1. Buat akun di railway.app
//   2. New Project → Deploy from GitHub Repo
//      (upload file ini ke repo GitHub dulu)
//   3. Atau: railway.app → New → Deploy from Template → Express
//   4. Set environment variable: SECRET_KEY=password_kamu
//   5. Copy URL yang diberikan Railway
//   6. Paste URL ke SaweriaHandler.lua (PROXY_URL)
//   7. Di Saweria Dashboard → Pengaturan → Webhook URL:
//      isi: https://URL_RAILWAY_KAMU/webhook
// ============================================================

const express = require("express");
const app = express();
app.use(express.json());

// Secret key - sama dengan di SaweriaHandler.lua
const SECRET_KEY = process.env.SECRET_KEY || "amclub123";

// Queue donasi yang belum dikirim ke Roblox
let donationQueue = [];

// ============================================================
// HELPER: Format Rupiah
// ============================================================
function formatRupiah(amount) {
  const num = Math.floor(Number(amount) || 0);
  return "Rp " + num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// ============================================================
// ENDPOINT 1: Saweria → Proxy (Webhook receiver)
// Saweria akan POST ke sini setiap ada donasi
// ============================================================
app.post("/webhook", (req, res) => {
  const body = req.body;

  console.log("[Webhook] Donasi masuk:", JSON.stringify(body, null, 2));

  // Validasi minimal
  if (!body || typeof body !== "object") {
    return res.status(400).json({ error: "Invalid body" });
  }

  // Ambil data dari format Saweria
  // (Saweria mengirim: donator_name, amount, message, dll)
  const donation = {
    id:      body.id || body.created_at || Date.now().toString(),
    name:    body.donator_name || body.name || "Anonymous",
    amount:  formatRupiah(body.etc?.amount_to_display || body.amount_raw || body.amount || 0),
    message: body.message || "",
    timestamp: Date.now(),
  };

  // Hindari duplikat
  const alreadyExists = donationQueue.some(d => d.id === donation.id);
  if (!alreadyExists) {
    donationQueue.push(donation);
    console.log(`[Queue] Donasi dari ${donation.name} (${donation.amount}) ditambahkan. Queue: ${donationQueue.length}`);
  }

  res.json({ success: true, queued: donation });
});

// ============================================================
// ENDPOINT 2: Roblox → Proxy (Poll donasi baru)
// Roblox poll ke sini, proxy kasih donasi yang belum dikirim
// ============================================================
app.get("/donations", (req, res) => {
  // Validasi secret key
  const key = req.headers["x-secret-key"];
  if (key !== SECRET_KEY) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  // Ambil semua donasi di queue lalu kosongkan
  const toSend = [...donationQueue];
  donationQueue = [];

  if (toSend.length > 0) {
    console.log(`[Poll] Roblox mengambil ${toSend.length} donasi.`);
  }

  res.json(toSend);
});

// ============================================================
// ENDPOINT 3: Test manual (untuk debug)
// POST /test dengan body: { "name": "Budi", "amount": 50000, "message": "Halo!" }
// ============================================================
app.post("/test", (req, res) => {
  const key = req.headers["x-secret-key"];
  if (key !== SECRET_KEY) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  const { name, amount, message } = req.body || {};
  const donation = {
    id:      "test_" + Date.now(),
    name:    name || "TestDonor",
    amount:  formatRupiah(amount || 10000),
    message: message || "Test donasi dari proxy!",
    timestamp: Date.now(),
  };

  donationQueue.push(donation);
  console.log(`[Test] Donasi test ditambahkan: ${donation.name} - ${donation.amount}`);
  res.json({ success: true, queued: donation });
});

// ============================================================
// ENDPOINT 4: Health check
// ============================================================
app.get("/", (req, res) => {
  res.json({
    status: "online",
    queue:  donationQueue.length,
    message: "Saweria Proxy for Roblox - Running!",
  });
});

// ============================================================
// START SERVER
// ============================================================
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`✅ Saweria Proxy berjalan di port ${PORT}`);
  console.log(`   Webhook URL : /webhook`);
  console.log(`   Poll URL    : /donations`);
  console.log(`   Test URL    : /test`);
});
