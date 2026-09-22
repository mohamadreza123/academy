const express = require("express");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = Number(process.env.PORT || 3000);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE_KEY) {
  console.warn("Supabase environment variables are not fully configured. Copy .env.example to .env and fill it.");
}

const supabaseAdmin = SUPABASE_URL && SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

const supabasePublic = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname)));

function requireConfig(res) {
  if (!supabaseAdmin || !supabasePublic) {
    res.status(500).json({ error: "تنظیمات Supabase در فایل .env کامل نشده است." });
    return false;
  }
  return true;
}

async function getUser(req) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token || !supabasePublic) return null;
  const { data, error } = await supabasePublic.auth.getUser(token);
  return error ? null : data.user;
}

async function requireAdmin(req, res, next) {
  if (!requireConfig(res)) return;
  const user = await getUser(req);
  if (!user || (ADMIN_EMAIL && user.email !== ADMIN_EMAIL)) {
    return res.status(403).json({ error: "دسترسی مدیر لازم است." });
  }
  req.user = user;
  next();
}

async function requireAnyUser(req, res, next) {
  if (!requireConfig(res)) return;
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: "لطفاً ابتدا وارد حساب شوید." });
  req.user = user;
  next();
}

app.post("/api/auth/login", async (req, res) => {
  if (!requireConfig(res)) return;
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "ایمیل/نام کاربری و رمز عبور را وارد کنید." });

  const { data, error } = await supabasePublic.auth.signInWithPassword({ email, password });
  if (error) return res.status(401).json({ error: "اطلاعات ورود صحیح نیست." });

  const role = ADMIN_EMAIL && data.user.email === ADMIN_EMAIL ? "admin" : "athlete";
  let athlete = null;
  if (role === "athlete") {
    const { data: a } = await supabaseAdmin.from("athletes").select("*").eq("user_id", data.user.id).maybeSingle();
    athlete = a || null;
  }
  res.json({ session: data.session, user: { id: data.user.id, email: data.user.email, role }, athlete });
});

app.post("/api/auth/logout", async (req, res) => {
  res.json({ ok: true });
});

app.get("/api/me", requireAnyUser, async (req, res) => {
  const role = ADMIN_EMAIL && req.user.email === ADMIN_EMAIL ? "admin" : "athlete";
  let athlete = null;
  if (role === "athlete") {
    const { data } = await supabaseAdmin.from("athletes").select("*").eq("user_id", req.user.id).maybeSingle();
    athlete = data || null;
  }
  res.json({ user: { id: req.user.id, email: req.user.email, role }, athlete });
});

app.get("/api/athletes", requireAdmin, async (req, res) => {
  const { data, error } = await supabaseAdmin.from("athletes").select("*").order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.post("/api/athletes", requireAdmin, async (req, res) => {
  const { name, email, password, national_id, belt, weight_category, phone, tuition_total } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: "نام، ایمیل و رمز عبور الزامی است." });
  if (password.length < 6) return res.status(400).json({ error: "رمز عبور باید حداقل ۶ کاراکتر باشد." });

  const { data: created, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });
  if (authError) return res.status(400).json({ error: authError.message });

  const { data, error } = await supabaseAdmin.from("athletes").insert([{
    user_id: created.user.id,
    name, email, national_id: national_id || null, belt: belt || null,
    weight_category: weight_category || null, phone: phone || null,
    tuition_total: Number(tuition_total || 0), tuition_paid: 0, last_payment_date: null
  }]).select().single();

  if (error) {
    await supabaseAdmin.auth.admin.deleteUser(created.user.id);
    return res.status(500).json({ error: error.message });
  }
  res.status(201).json(data);
});

app.put("/api/athletes/:id", requireAdmin, async (req, res) => {
  const allowed = ["name", "national_id", "belt", "weight_category", "phone", "tuition_total", "tuition_paid", "last_payment_date"];
  const update = {};
  for (const key of allowed) if (Object.prototype.hasOwnProperty.call(req.body, key)) update[key] = req.body[key];
  if (update.tuition_total !== undefined) update.tuition_total = Number(update.tuition_total || 0);
  if (update.tuition_paid !== undefined) update.tuition_paid = Number(update.tuition_paid || 0);

  const { data, error } = await supabaseAdmin.from("athletes").update(update).eq("id", req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

app.delete("/api/athletes/:id", requireAdmin, async (req, res) => {
  const { data: athlete, error: findError } = await supabaseAdmin.from("athletes").select("user_id").eq("id", req.params.id).single();
  if (findError) return res.status(404).json({ error: "ورزشکار پیدا نشد." });

  const { error } = await supabaseAdmin.from("athletes").delete().eq("id", req.params.id);
  if (error) return res.status(400).json({ error: error.message });

  if (athlete.user_id) await supabaseAdmin.auth.admin.deleteUser(athlete.user_id);
  res.json({ ok: true });
});

app.get("/api/my-payments", requireAnyUser, async (req, res) => {
  const { data, error } = await supabaseAdmin.from("payments").select("*").eq("athlete_user_id", req.user.id).order("payment_date", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.post("/api/payments", requireAdmin, async (req, res) => {
  const { athlete_user_id, amount, payment_date, description } = req.body || {};
  if (!athlete_user_id || !amount || !payment_date) return res.status(400).json({ error: "ورزشکار، مبلغ و تاریخ پرداخت الزامی است." });

  const { data, error } = await supabaseAdmin.from("payments").insert([{
    athlete_user_id, amount: Number(amount), payment_date, description: description || null
  }]).select().single();
  if (error) return res.status(400).json({ error: error.message });

  const { data: athlete } = await supabaseAdmin.from("athletes").select("tuition_paid").eq("user_id", athlete_user_id).single();
  if (athlete) {
    await supabaseAdmin.from("athletes").update({
      tuition_paid: Number(athlete.tuition_paid || 0) + Number(amount),
      last_payment_date: payment_date
    }).eq("user_id", athlete_user_id);
  }
  res.status(201).json(data);
});

app.get("/api/settings", async (req, res) => {
  if (!requireConfig(res)) return;
  const { data, error } = await supabaseAdmin.from("site_settings").select("*").eq("id", 1).maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || { id: 1, academy_name: "آکادمی ورزشکاران", logo_url: "" });
});

app.put("/api/settings", requireAdmin, async (req, res) => {
  const { academy_name, logo_url } = req.body || {};
  const { data, error } = await supabaseAdmin.from("site_settings").upsert([{
    id: 1, academy_name: academy_name || "آکادمی ورزشکاران", logo_url: logo_url || ""
  }]).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

app.listen(PORT, () => console.log(`Academy server running on http://localhost:${PORT}`));
