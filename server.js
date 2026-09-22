require('dotenv').config();
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const SITE_FILE = path.join(__dirname, 'site.json');
const MESSAGES_FILE = path.join(__dirname, 'messages.json');

const defaults = {
  brandName:'استاد فرید آقادادی',
  brandSubtitle:'ارشد فیزیولوژی ورزشی | آکادمی تخصصی تناسب اندام',
  logoUrl:'',
  heroBadge:'آکادمی حرفه‌ای تناسب اندام و فیزیولوژی ورزشی',
  heroTitle:'مسیر قهرمانی و تحول فیزیک با استاد فرید آقادادی',
  heroText:'ارائه برنامه‌های تمرینی تخصصی، تنظیم تغذیه علمی بر اساس فیزیولوژی ورزشی، و نظارت دقیق بر روند پیشرفت شما در مجهزترین آکادمی بدنسازی.',
  heroImageUrl:'',
  phone:'',
  address:'تهران، مجموعه تخصصی بدنسازی آکادمی فرید',
  instagram:'',
  telegram:'',
  whatsapp:'',
  footerText:'ارائه برنامه‌های تخصصی بدنسازی، تغذیه و فیزیولوژی ورزشی زیر نظر مستقیم استاد فرید آقادادی.',
  copyrightText:'تمامی حقوق محفوظ است © ۲۰۲۶ | آکادمی تخصصی تناسب اندام استاد فرید آقادادی'
};

if (!fs.existsSync(SITE_FILE)) fs.writeFileSync(SITE_FILE, JSON.stringify(defaults,null,2));
if (!fs.existsSync(MESSAGES_FILE)) fs.writeFileSync(MESSAGES_FILE, '[]');
const readSite=()=>({...defaults,...JSON.parse(fs.readFileSync(SITE_FILE,'utf8'))});
const writeSite=x=>fs.writeFileSync(SITE_FILE,JSON.stringify({...defaults,...x},null,2));
const readMessages=()=>JSON.parse(fs.readFileSync(MESSAGES_FILE,'utf8'));
const writeMessages=x=>fs.writeFileSync(MESSAGES_FILE,JSON.stringify(x,null,2));

// Demo/admin credentials for this delivered build. Change them in .env before publishing a public repository.
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PHONE = process.env.ADMIN_PHONE || '09121234567';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Academy@2026!';
const PASSWORD_SALT = process.env.ADMIN_PASSWORD_SALT || 'academy-stage1-salt-2026';
const PASSWORD_KEY = process.env.ADMIN_PASSWORD_KEY || crypto.scryptSync(ADMIN_PASSWORD, PASSWORD_SALT, 64).toString('hex');

function verifyPassword(password){
  try {
    const key = crypto.scryptSync(String(password), PASSWORD_SALT, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(key,'hex'), Buffer.from(PASSWORD_KEY,'hex'));
  } catch { return false; }
}
function validIranPhone(v){ return /^09\d{9}$/.test(String(v||'')); }
function requireAdmin(req,res,next){ if(req.session.user?.role!=='coach') return res.status(401).json({message:'دسترسی غیرمجاز'}); next(); }
function normalizeMessage(m){ return {...m, id:Number(m.id), text:String(m.text||''), reply:String(m.reply||'')}; }

app.use(helmet({ contentSecurityPolicy:false }));
app.use(express.json({limit:'6mb'}));
app.use(express.urlencoded({extended:false, limit:'6mb'}));
app.use(session({
  name:'academy_admin',
  secret:process.env.SESSION_SECRET || 'academy-session-secret-change-before-production',
  resave:false,
  saveUninitialized:false,
  cookie:{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:1000*60*60*8}
}));
const loginLimiter=rateLimit({windowMs:15*60*1000,max:10,standardHeaders:true,legacyHeaders:false,message:{message:'تعداد تلاش‌های ورود زیاد است. بعداً دوباره تلاش کنید.'}});
const messageLimiter=rateLimit({windowMs:15*60*1000,max:30,standardHeaders:true,legacyHeaders:false,message:{message:'تعداد پیام‌ها زیاد است. کمی بعد دوباره تلاش کنید.'}});

app.get('/api/site',(req,res)=>res.json(readSite()));

app.post('/api/auth/login',loginLimiter,async(req,res)=>{
  const login=String(req.body.login || req.body.phone || req.body.username || '').trim();
  const password=String(req.body.password||'');
  if(!login || !password) return res.status(400).json({message:'نام کاربری/شماره موبایل و رمز عبور را وارد کنید.'});
  const okLogin = login===ADMIN_USERNAME || login===ADMIN_PHONE;
  if(!okLogin || !verifyPassword(password)) return res.status(401).json({message:'نام کاربری یا رمز عبور اشتباه است.'});
  req.session.user={name:process.env.ADMIN_NAME||'مدیر آکادمی',role:'coach',username:ADMIN_USERNAME,phone:ADMIN_PHONE};
  res.json({user:req.session.user});
});
app.get('/api/auth/me',(req,res)=>res.json({user:req.session.user||null}));
app.post('/api/auth/logout',(req,res)=>req.session.destroy(()=>res.json({ok:true})));

app.put('/api/admin/site',requireAdmin,(req,res)=>{
  const allowed=Object.keys(defaults);
  const incoming=req.body||{};
  const next={...readSite()};
  for(const k of allowed) if(typeof incoming[k]==='string' && incoming[k].length<=5000) next[k]=incoming[k].trim();
  writeSite(next); res.json(next);
});

// Persistent message inbox. Messages are stored on the server so they work across devices.
app.get('/api/messages', requireAdmin, (req,res)=>res.json(readMessages().map(normalizeMessage)));
app.get('/api/messages/mine', messageLimiter, (req,res)=>{
  const phone=String(req.query.phone||'').trim();
  if(!validIranPhone(phone)) return res.status(400).json({message:'شماره موبایل معتبر نیست.'});
  res.json(readMessages().filter(m=>m.phone===phone).map(normalizeMessage));
});
app.post('/api/messages', messageLimiter, (req,res)=>{
  const phone=String(req.body.phone||'').trim();
  const sender=String(req.body.sender||'ورزشکار').trim().slice(0,100);
  const text=String(req.body.text||'').trim().slice(0,4000);
  if(!validIranPhone(phone) || !text) return res.status(400).json({message:'شماره موبایل یا متن پیام معتبر نیست.'});
  const messages=readMessages();
  const msg={id:Date.now(),sender,phone,role:'athlete',text,time:new Date().toLocaleString('fa-IR'),reply:''};
  messages.push(msg); writeMessages(messages); res.status(201).json(msg);
});
app.put('/api/messages/:id/reply', requireAdmin, (req,res)=>{
  const id=Number(req.params.id); const reply=String(req.body.reply||'').trim().slice(0,4000);
  if(!reply) return res.status(400).json({message:'متن پاسخ خالی است.'});
  const messages=readMessages(); const msg=messages.find(m=>Number(m.id)===id);
  if(!msg) return res.status(404).json({message:'پیام پیدا نشد.'});
  msg.reply=reply; msg.repliedAt=new Date().toLocaleString('fa-IR'); writeMessages(messages); res.json(msg);
});

app.use(express.static(__dirname));
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'index.html')));
app.listen(PORT,()=>console.log(`Academy running on http://localhost:${PORT}`));
