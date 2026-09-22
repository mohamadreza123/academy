require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const SITE_FILE = path.join(DATA_DIR, 'site.json');
fs.mkdirSync(DATA_DIR, { recursive: true });

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
const readSite=()=>({...defaults,...JSON.parse(fs.readFileSync(SITE_FILE,'utf8'))});
const writeSite=x=>fs.writeFileSync(SITE_FILE,JSON.stringify({...defaults,...x},null,2));

app.use(helmet({ contentSecurityPolicy:false }));
app.use(express.json({limit:'100kb'}));
app.use(express.urlencoded({extended:false}));
app.use(session({
  name:'academy_admin',
  secret:process.env.SESSION_SECRET || 'CHANGE_THIS_SESSION_SECRET',
  resave:false,
  saveUninitialized:false,
  cookie:{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:1000*60*60*8}
}));
const loginLimiter=rateLimit({windowMs:15*60*1000,max:10,standardHeaders:true,legacyHeaders:false,message:{message:'تعداد تلاش‌های ورود زیاد است. بعداً دوباره تلاش کنید.'}});

function validIranPhone(v){ return /^09\d{9}$/.test(String(v||'')); }
function requireAdmin(req,res,next){ if(req.session.user?.role!=='coach') return res.status(401).json({message:'دسترسی غیرمجاز'}); next(); }

app.get('/api/site',(req,res)=>res.json(readSite()));

app.post('/api/auth/login',loginLimiter,async(req,res)=>{
  const phone=String(req.body.phone||'').trim();
  const password=String(req.body.password||'');
  if(!validIranPhone(phone) || !password) return res.status(400).json({message:'شماره موبایل یا رمز عبور معتبر نیست.'});
  const adminPhone=process.env.ADMIN_PHONE;
  const hash=process.env.ADMIN_PASSWORD_HASH;
  if(!adminPhone || !hash) return res.status(503).json({message:'ورود مدیریت هنوز تنظیم نشده است.'});
  const okPhone=phone===adminPhone;
  const okPassword=await bcrypt.compare(password,hash);
  if(!okPhone || !okPassword) return res.status(401).json({message:'شماره موبایل یا رمز عبور اشتباه است.'});
  req.session.user={name:process.env.ADMIN_NAME||'مربی',role:'coach',phone};
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

app.use(express.static(__dirname));
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'index.html')));
app.listen(PORT,()=>console.log(`Academy running on http://localhost:${PORT}`));
