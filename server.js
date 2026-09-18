const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const XLSX = require("xlsx");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_LOGIN = process.env.ADMIN_LOGIN || "LearnifyEdu";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "LearnifyEducation2026";
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "leads.json");
const VACANCY_FILE = path.join(DATA_DIR, "vacancies.json");
const CONTENT_FILE = path.join(__dirname, "content.json");
const UPLOAD_DIR = path.join(__dirname, "uploads");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "[]", "utf8");
if (!fs.existsSync(VACANCY_FILE)) fs.writeFileSync(VACANCY_FILE, "[]", "utf8");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(UPLOAD_DIR));
app.use(express.static(path.join(__dirname, "public")));

const sessions = new Map();

function readLeads() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); }
  catch { return []; }
}
function writeLeads(leads) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(leads, null, 2), "utf8");
}
function readVacancies() {
  try { return JSON.parse(fs.readFileSync(VACANCY_FILE, "utf8")); }
  catch { return []; }
}
function writeVacancies(items) {
  fs.writeFileSync(VACANCY_FILE, JSON.stringify(items, null, 2), "utf8");
}

function readContent() {
  try { return JSON.parse(fs.readFileSync(CONTENT_FILE, "utf8")); }
  catch { return {uz:{},ru:{},en:{}}; }
}
function writeContent(content) {
  fs.writeFileSync(CONTENT_FILE, JSON.stringify(content, null, 2), "utf8");
}
function protectMarkup(text) {
  const tags=[];
  const safe=String(text ?? "").replace(/<[^>]+>/g, tag => { const key=`__LEARNIFY_TAG_${tags.length}__`; tags.push([key,tag]); return key; });
  return {safe,tags};
}
function restoreMarkup(text,tags) {
  let out=String(text ?? "");
  for (const [key,tag] of tags) out=out.split(key).join(tag);
  return out;
}async function translateText(text, target) {
  const source = String(text ?? "");

  if (!source.trim() || target === "uz") {
    return source;
  }

  const { safe, tags } = protectMarkup(source);

  // 1-usul: Google Translate
  try {
    const googleUrl =
      "https://translate.googleapis.com/translate_a/single" +
      "?client=gtx&sl=uz&tl=" +
      encodeURIComponent(target) +
      "&dt=t&q=" +
      encodeURIComponent(safe);

    const r = await fetch(googleUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    if (r.ok) {
      const data = await r.json();

      const translated = Array.isArray(data?.[0])
        ? data[0]
            .map(item => item?.[0] || "")
            .join("")
        : "";

      if (translated.trim()) {
        return restoreMarkup(translated, tags);
      }
    }
  } catch (e) {
    console.log("Google Translate xatosi:", e.message);
  }

  // 2-usul: MyMemory
  try {
    const url =
      "https://api.mymemory.translated.net/get" +
      "?q=" +
      encodeURIComponent(safe) +
      "&langpair=uz|" +
      encodeURIComponent(target);

    const r = await fetch(url, {
      headers: {
        "User-Agent": "Learnify-Education/1.0"
      }
    });

    if (r.ok) {
      const j = await r.json();
      const translated = j?.responseData?.translatedText;

      if (translated && translated.trim()) {
        return restoreMarkup(translated, tags);
      }
    }
  } catch (e) {
    console.log("MyMemory xatosi:", e.message);
  }

  throw new Error(
    `Auto tarjima ${target.toUpperCase()} uchun ishlamadi`
  );
}

async function translateText(text, target) {
  const source = String(text ?? "");

  if (!source.trim() || target === "uz") {
    return source;
  }

  const { safe, tags } = protectMarkup(source);

  try {
    const url =
      `https://api.mymemory.translated.net/get` +
      `?q=${encodeURIComponent(safe)}` +
      `&langpair=uz|${target}`;

    const r = await fetch(url, {
      headers: {
        "User-Agent": "Learnify-Education/1.0"
      }
    });

    if (!r.ok) {
      throw new Error(`Translation service ${r.status}`);
    }

    const j = await r.json();
    const translated = j?.responseData?.translatedText;

    if (!translated) {
      throw new Error("Empty translation");
    }

    return restoreMarkup(translated, tags);

  } catch (e) {
    throw new Error(
      `Auto tarjima ${target.toUpperCase()} uchun ishlamadi: ${e.message}`
    );
  }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(5).toString("hex")}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = [".pdf", ".doc", ".docx"].includes(path.extname(file.originalname).toLowerCase());
    cb(ok ? null : new Error("Faqat PDF, DOC yoki DOCX fayl yuklash mumkin"), ok);
  }
});
function auth(req,res,next){
  const token = req.headers.authorization?.replace(/^Bearer\s+/i,"") || req.cookies?.learnify_admin;
  if (token && sessions.has(token)) return next();
  return res.status(401).json({error:"Unauthorized"});
}
function makeId(){ return crypto.randomBytes(8).toString("hex"); }

app.post("/api/leads", (req,res)=>{
  const {name, phone, course, comment} = req.body || {};
  if (!name || !phone) return res.status(400).json({error:"Ism va telefon majburiy"});
  const leads = readLeads();
  const lead = {
    id: makeId(),
    name: String(name).trim(),
    phone: String(phone).trim(),
    course: String(course || "Kurs tanlanmagan").trim(),
    comment: String(comment || "").trim(),
    createdAt: new Date().toISOString()
  };
  leads.unshift(lead);
  writeLeads(leads);
  res.json({ok:true, lead:{id:lead.id}});
});

app.post("/api/vacancies", (req,res) => {
  upload.single("resume")(req,res,(err)=>{
    if (err) return res.status(400).json({error: err.code === "LIMIT_FILE_SIZE" ? "Fayl hajmi 5 MB dan oshmasin" : err.message});
    const b=req.body||{};
    if(!b.firstName || !b.lastName || !b.phone || !b.position || !req.file) return res.status(400).json({error:"Ism, familiya, telefon, vakansiya va rezyume majburiy"});
    const items=readVacancies();
    const item={id:makeId(),firstName:String(b.firstName).trim(),lastName:String(b.lastName).trim(),phone:String(b.phone).trim(),position:String(b.position).trim(),course:String(b.course||"").trim(),experience:String(b.experience||"").trim(),workplace:String(b.workplace||"").trim(),comment:String(b.comment||"").trim(),resumeOriginal:req.file.originalname,resumeFile:req.file.filename,resumeUrl:`/uploads/${req.file.filename}`,createdAt:new Date().toISOString()};
    items.unshift(item); writeVacancies(items); res.json({ok:true,id:item.id});
  });
});

app.get("/api/content",(req,res)=>{
  const c=readContent();
  res.json(c);
});

app.post("/api/admin/content",auth,async(req,res)=>{
  const incoming=req.body?.uz;
  if(!incoming || typeof incoming !== "object") return res.status(400).json({error:"O‘zbekcha matnlar yuborilmadi"});
  const current=readContent();
  current.uz=current.uz||{}; current.ru=current.ru||{}; current.en=current.en||{};
  const changed=Object.keys(incoming).filter(k=>String(incoming[k]??"") !== String(current.uz[k]??""));
  const errors=[];
  for(const key of changed){
    const value=String(incoming[key]??"");
    current.uz[key]=value;
    for(const lang of ["ru","en"]){
      try { current[lang][key]=await translateText(value,lang); }
      catch(err){ errors.push({key,lang,error:err.message}); }
    }
  }
  writeContent(current);
  res.json({ok:true,changed,errors,content:current});
});

app.post("/api/admin/login",(req,res)=>{
  const {login,password}=req.body||{};
  if(login===ADMIN_LOGIN && password===ADMIN_PASSWORD){
    const token=crypto.randomBytes(24).toString("hex");
    sessions.set(token,{createdAt:Date.now()});
    return res.json({ok:true,token});
  }
  res.status(401).json({error:"Login yoki parol noto‘g‘ri"});
});

app.get("/api/admin/leads",auth,(req,res)=>res.json({leads:readLeads()}));

app.delete("/api/admin/leads/:id",auth,(req,res)=>{
  const leads=readLeads();
  const next=leads.filter(x=>x.id!==req.params.id);
  writeLeads(next);
  res.json({ok:true});
});

app.get("/api/admin/vacancies",auth,(req,res)=>res.json({vacancies:readVacancies()}));
app.delete("/api/admin/vacancies/:id",auth,(req,res)=>{
  const items=readVacancies(); const item=items.find(x=>x.id===req.params.id);
  if(item?.resumeFile){const fp=path.join(UPLOAD_DIR,item.resumeFile);if(fs.existsSync(fp))fs.unlinkSync(fp);}
  writeVacancies(items.filter(x=>x.id!==req.params.id)); res.json({ok:true});
});

app.get("/api/admin/export.xlsx",auth,(req,res)=>{
  const leads=readLeads();
  const rows=leads.map((x,i)=>({
    "#":i+1,
    "Ism":x.name,
    "Telefon":x.phone,
    "Kurs":x.course,
    "Izoh":x.comment,
    "Sana":new Date(x.createdAt).toLocaleString("uz-UZ")
  }));
  const wb=XLSX.utils.book_new();
  const ws=XLSX.utils.json_to_sheet(rows);
  ws["!cols"]=[{wch:5},{wch:24},{wch:20},{wch:28},{wch:45},{wch:22}];
  XLSX.utils.book_append_sheet(wb,ws,"Mijozlar");
  const buf=XLSX.write(wb,{type:"buffer",bookType:"xlsx"});
  res.setHeader("Content-Type","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition",'attachment; filename="learnify-leads.xlsx"');
  res.send(buf);
});

app.get("/api/admin/export-vacancies.xlsx",auth,(req,res)=>{
  const items=readVacancies();
  const rows=items.map((x,i)=>({"#":i+1,"Ism":x.firstName,"Familiya":x.lastName,"Telefon":x.phone,"Vakansiya":x.position,"Yo‘nalish":x.course,"Tajriba":x.experience,"Avvalgi ish joyi":x.workplace,"Izoh":x.comment,"Rezyume":x.resumeUrl,"Sana":new Date(x.createdAt).toLocaleString("uz-UZ")}));
  const wb=XLSX.utils.book_new(); const ws=XLSX.utils.json_to_sheet(rows); XLSX.utils.book_append_sheet(wb,ws,"Vakansiyalar");
  const buf=XLSX.write(wb,{type:"buffer",bookType:"xlsx"}); res.setHeader("Content-Type","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"); res.setHeader("Content-Disposition",'attachment; filename="learnify-vacancies.xlsx"'); res.send(buf);
});

app.get("/admin",(req,res)=>res.sendFile(path.join(__dirname,"public","admin.html")));
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));

app.listen(PORT,()=>console.log(`Learnify: http://localhost:${PORT}`));
