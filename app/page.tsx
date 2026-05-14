"use client"
import { useState, useEffect, useCallback, ReactNode } from "react";
import {
  LayoutDashboard, Users, Bot, Mail, Settings, LogOut,
  CheckCircle, AlertCircle, Bell, ChevronRight,
  Plus, Eye, Phone, Calendar, Zap, Shield, ArrowUpRight, ArrowDownRight,
  BarChart2, Inbox, Target, X, Menu,
  Send, Trash2, Database, Webhook, Play, Pause,
  Clock, RefreshCw, Bug, Terminal, Copy,
  Star, TrendingUp, Tag, Search
} from "lucide-react";

// ─── TYPES ───────────────────────────────────────────────────────────────────
interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  status: "hot" | "warm" | "cold";
  score: number;
  score_reason: string;
  ai_summary: string;
  draft_email: string;
  created_at: string;
  stage?: string;
  value?: number;
}

interface Followup {
  id: string;
  lead_id: string;
  lead_name: string;
  lead_email: string;
  step_label: string;
  step_day: number;
  subject: string;
  body: string;
  scheduled_at: string;
  status: "pending" | "sent" | "skipped";
  created_at: string;
}

interface Campaign {
  id: number;
  name: string;
  status: "active" | "paused" | "draft";
  sent: number;
  opened: number;
  replied: number;
  type: string;
}

interface Toast { id: number; msg: string; type: "success" | "error" | "info"; }
interface Notif  { icon: ReactNode; color: string; text: string; time: string; }
interface User   { name: string; email: string; role: string; }
type StatusKey = "hot" | "warm" | "cold";

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://tkqpztfbtvngvdghcyqj.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrcXB6dGZidHZuZ3ZkZ2hjeXFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2ODcyMTQsImV4cCI6MjA5NDI2MzIxNH0.z2-CGdmo7wyfj8SebmHRSaoWgGxovVHHuk7CgvuAlEw";
const N8N_WEBHOOK  = "https://thoai00.app.n8n.cloud/webhook/lead-intake";
const ADMIN = { email: "admin@agency.com", password: "admin123", name: "Alex Rivera", role: "Admin" };

const PIPELINE_STAGES = ["New Lead", "Contacted", "Demo", "Proposal", "Negotiation", "Won", "Lost"];

const STAGE_COLORS: Record<string, string> = {
  "New Lead":"#6366f1","Contacted":"#3b82f6","Demo":"#f59e0b",
  "Proposal":"#8b5cf6","Negotiation":"#f97316","Won":"#16a34a","Lost":"#dc2626"
};

// ─── SUPABASE HELPERS ────────────────────────────────────────────────────────
const H: Record<string, string> = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

const dbLoad = async (): Promise<Lead[]> => {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/leads?select=*&order=created_at.desc`, { headers: H });
    return r.ok ? r.json() : [];
  } catch { return []; }
};

const dbInsert = async (row: Omit<Lead, "id">): Promise<{ data: Lead[] | null; error: string | null }> => {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/leads`, { method: "POST", headers: H, body: JSON.stringify(row) });
    if (!r.ok) { const e = await r.text(); return { data: null, error: `HTTP ${r.status}: ${e}` }; }
    return { data: await r.json(), error: null };
  } catch (e: any) { return { data: null, error: e.message }; }
};

const dbDelete = async (id: string) => {
  try { await fetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${id}`, { method: "DELETE", headers: H }); } catch {}
};

const dbPatch = async (id: string, patch: Partial<Lead>): Promise<boolean> => {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${id}`, {
      method: "PATCH", headers: H, body: JSON.stringify(patch)
    });
    return r.ok;
  } catch { return false; }
};

const dbLoadFollowups = async (): Promise<Followup[]> => {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/followups?select=*&order=scheduled_at.asc`, { headers: H });
    return r.ok ? r.json() : [];
  } catch { return []; }
};

const dbInsertFollowup = async (row: Omit<Followup, "id">): Promise<Followup[] | null> => {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/followups`, { method: "POST", headers: H, body: JSON.stringify(row) });
    return r.ok ? r.json() : null;
  } catch { return null; }
};

const dbPatchFollowup = async (id: string, patch: Partial<Followup>) => {
  try { await fetch(`${SUPABASE_URL}/rest/v1/followups?id=eq.${id}`, { method: "PATCH", headers: H, body: JSON.stringify(patch) }); } catch {}
};

// ─── SEED DATA ────────────────────────────────────────────────────────────────
const SEEDS: Omit<Lead, "id">[] = [
  { name:"Sarah Mitchell", email:"sarah@techcorp.io", phone:"+1 (555) 201-4892", message:"Need a full website redesign for our SaaS product. Budget around $8k.", score:9, score_reason:"High budget, clear need, Q1 deadline", ai_summary:"SaaS redesign · $8k budget · urgent Q1", status:"hot", draft_email:"Hi Sarah,\n\nThanks for reaching out! A SaaS redesign with a Q1 deadline is exactly our sweet spot.\n\nAre you free Thursday for a quick 20-min call?\n\nBest,\nAlex", created_at: new Date().toISOString(), stage:"Proposal", value:8000 },
  { name:"James Okafor",   email:"james@growthlab.co", phone:"+1 (555) 318-7741", message:"Looking for someone to manage our Facebook and Instagram ads.", score:7, score_reason:"Established company, recurring revenue potential", ai_summary:"Social ads management · ongoing retainer", status:"warm", draft_email:"Hi James,\n\nWe drive consistent ROAS for similar businesses. I'd love to audit your accounts for free.\n\nBest,\nAlex", created_at: new Date().toISOString(), stage:"Contacted", value:3000 },
  { name:"Priya Sharma",   email:"priya@innova.in", phone:"+91 98765 43210", message:"Interested in automation solutions for our customer onboarding.", score:8, score_reason:"Tech-forward company, automation budget available", ai_summary:"Onboarding automation · mid-high budget", status:"hot", draft_email:"Hi Priya,\n\nWe've helped SaaS companies cut onboarding time-to-value by 60%.\n\nWant a quick 15-min demo?\n\nBest,\nAlex", created_at: new Date().toISOString(), stage:"Demo", value:6500 },
  { name:"Carlos Mendez",  email:"carlos@startup.mx", phone:"+52 55 1234 5678", message:"Need a landing page and basic SEO setup. Small budget.", score:4, score_reason:"Small budget, early-stage startup", ai_summary:"Landing page + SEO · limited budget", status:"cold", draft_email:"Hi Carlos,\n\nWe have starter packages that cover landing pages + SEO.\n\nBest,\nAlex", created_at: new Date().toISOString(), stage:"New Lead", value:800 },
  { name:"Nina Petrova",   email:"nina@ecomstore.eu", phone:"+44 20 7123 4567", message:"Want to set up n8n automations for our ecommerce store workflows.", score:8, score_reason:"E-commerce recurring automation needs", ai_summary:"E-commerce automation · Shopify integrations", status:"warm", draft_email:"Hi Nina,\n\nE-commerce automation is our specialty.\n\nWhat platform are you on?\n\nBest,\nAlex", created_at: new Date().toISOString(), stage:"Contacted", value:4200 },
];

const FOLLOWUP_SEQUENCE = [
  { day:0,  label:"Initial Contact", subject:(n:string)=>`Quick question, ${n.split(" ")[0]}`,             body:(l:Lead)=>l.draft_email },
  { day:2,  label:"Follow-up #1",    subject:(n:string)=>`Still thinking it over, ${n.split(" ")[0]}?`,   body:(l:Lead)=>`Hi ${l.name.split(" ")[0]},\n\nJust checking in — did you get a chance to review my previous message?\n\nWould tomorrow work for a quick call?\n\nBest,\nAlex` },
  { day:5,  label:"Value Email",     subject:(n:string)=>`Case study for ${n.split(" ")[0]}`,              body:(l:Lead)=>`Hi ${l.name.split(" ")[0]},\n\nI wanted to share a quick win — we recently helped a similar client achieve measurable results.\n\nWorth 20 minutes to explore?\n\nBest,\nAlex` },
  { day:10, label:"Break-up Email",  subject:(n:string)=>`Should I close your file, ${n.split(" ")[0]}?`, body:(l:Lead)=>`Hi ${l.name.split(" ")[0]},\n\nI've reached out a few times but haven't heard back.\n\nI'll close your file for now, but if timing changes, my door is open.\n\nAlex` },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const scoreColor  = (s:number) => s>=7?"#16a34a":s>=4?"#d97706":"#dc2626";
const scoreBg     = (s:number) => s>=7?"#f0fdf4":s>=4?"#fffbeb":"#fef2f2";
const scoreBorder = (s:number) => s>=7?"#bbf7d0":s>=4?"#fde68a":"#fecaca";
const SC: Record<StatusKey,{label:string;bg:string;color:string;border:string}> = {
  hot:  {label:"Hot",  bg:"#fef2f2",color:"#dc2626",border:"#fecaca"},
  warm: {label:"Warm", bg:"#fffbeb",color:"#d97706",border:"#fde68a"},
  cold: {label:"Cold", bg:"#eff6ff",color:"#2563eb",border:"#bfdbfe"},
};
const SCORE_LABELS: Record<number,string> = {
  10:"Exceptional fit",9:"Very high intent",8:"Strong requirements",
  7:"Clear scope",6:"Moderate interest",5:"Needs qualification",
  4:"Limited details",3:"Vague request",2:"Low priority",1:"Minimal info"
};
const fmt     = (d:string) => new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});
const fmtDay  = (d:string) => new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
const addDays = (d:string,n:number) => { const r=new Date(d); r.setDate(r.getDate()+n); return r.toISOString(); };
const fmtVal  = (v?:number) => v?`$${v.toLocaleString()}`:"—";

// ─── SHARED STYLES ────────────────────────────────────────────────────────────
const LST:React.CSSProperties = {color:"#6b7280",fontSize:11,fontWeight:600,letterSpacing:.4,display:"block",marginBottom:5,textTransform:"uppercase" as const};
const INP:React.CSSProperties = {width:"100%",background:"#fff",border:"1.5px solid #e5e7eb",borderRadius:8,padding:"10px 13px",color:"#111827",fontSize:13,outline:"none",boxSizing:"border-box" as const};
const BTNP:React.CSSProperties = {background:"linear-gradient(135deg,#6366f1,#4f46e5)",border:"none",borderRadius:8,padding:"10px 16px",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",display:"flex" as const,alignItems:"center" as const,gap:6};
const BTNS:React.CSSProperties = {background:"#fff",border:"1.5px solid #e5e7eb",borderRadius:8,padding:"10px 16px",color:"#374151",fontSize:13,fontWeight:500,cursor:"pointer"};

// ─── TOAST ────────────────────────────────────────────────────────────────────
function useToast() {
  const [toasts, set] = useState<Toast[]>([]);
  const add = useCallback((msg:string, type:Toast["type"]="info") => {
    const id = Date.now()+Math.random();
    set(p=>[...p,{id,msg,type}]);
    setTimeout(()=>set(p=>p.filter(t=>t.id!==id)),4500);
  },[]);
  return { toasts, add, remove:(id:number)=>set(p=>p.filter(t=>t.id!==id)) };
}

function ToastStack({toasts,remove}:{toasts:Toast[];remove:(id:number)=>void}) {
  return (
    <div style={{position:"fixed",top:20,right:20,zIndex:9999,display:"flex",flexDirection:"column",gap:8,pointerEvents:"none"}}>
      {toasts.map(t=>(
        <div key={t.id} style={{background:"#fff",border:`1.5px solid ${t.type==="success"?"#bbf7d0":t.type==="error"?"#fecaca":"#bfdbfe"}`,borderRadius:10,padding:"12px 16px",display:"flex",alignItems:"center",gap:10,fontSize:13,fontWeight:500,minWidth:300,boxShadow:"0 4px 20px rgba(0,0,0,.1)",pointerEvents:"all"}}>
          {t.type==="success"?<CheckCircle size={15} color="#16a34a"/>:t.type==="error"?<AlertCircle size={15} color="#dc2626"/>:<Bell size={15} color="#2563eb"/>}
          <span style={{flex:1,color:"#111827"}}>{t.msg}</span>
          <button onClick={()=>remove(t.id)} style={{background:"none",border:"none",color:"#9ca3af",cursor:"pointer"}}><X size={13}/></button>
        </div>
      ))}
    </div>
  );
}

// ─── MODAL ────────────────────────────────────────────────────────────────────
function Modal({title,sub,onClose,children,wide}:{title:string;sub?:string;onClose:()=>void;children:ReactNode;wide?:boolean}) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.35)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)"}}>
      <div style={{background:"#fff",border:"1.5px solid #e5e7eb",borderRadius:16,padding:28,width:wide?580:460,maxHeight:"92vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,.15)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
          <div>
            <h2 style={{color:"#111827",fontWeight:700,fontSize:17}}>{title}</h2>
            {sub&&<p style={{color:"#6b7280",fontSize:12,marginTop:3}}>{sub}</p>}
          </div>
          <button onClick={onClose} style={{background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:7,padding:"4px 7px",color:"#6b7280",cursor:"pointer"}}><X size={14}/></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── ADD LEAD MODAL ───────────────────────────────────────────────────────────
function AddLeadModal({onClose,onAdd,toast}:{onClose:()=>void;onAdd:(l:Lead)=>void;toast:(m:string,t?:Toast["type"])=>void}) {
  const [f,setF] = useState({name:"",email:"",phone:"",message:"",status:"warm" as StatusKey,stage:"New Lead",value:""});
  const [busy,setBusy] = useState(false);
  const [log,setLog]   = useState<string[]>([]);
  const [showLog,setShowLog] = useState(false);
  const addLog = (m:string) => setLog(p=>[...p,`${new Date().toLocaleTimeString()} — ${m}`]);
  const up = (k:keyof typeof f,v:string) => setF(p=>({...p,[k]:v}));

  const localScore = (msg:string,status:string) => {
    const m=msg.toLowerCase(); let s=5;
    if(m.includes("budget")||m.includes("$")) s+=2;
    if(m.includes("urgent")||m.includes("asap")) s+=1;
    if(msg.length>80) s+=1;
    if(/redesign|automat|crm|saas|ecomm|website/.test(m)) s+=1;
    if(/8k|10k|5k|\$[5-9]/.test(m)) s+=1;
    if(status==="hot") s+=1;
    if(status==="cold") s-=2;
    return Math.min(10,Math.max(1,s));
  };

  const submit = async () => {
    if(!f.name.trim()||!f.email.trim()){toast("Name and email required","error");return;}
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)){toast("Invalid email","error");return;}
    setBusy(true); setLog([]); setShowLog(true);
    addLog("Sending to n8n webhook...");
    try {
      const res = await fetch(N8N_WEBHOOK,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...f,source:"crm_form"})});
      addLog(`n8n: HTTP ${res.status}`);
      if(res.ok){addLog("✅ n8n accepted — AI scoring in ~10s");toast("✅ Sent to n8n! Lead appears in ~10s","success");setBusy(false);setTimeout(onClose,1200);return;}
      addLog("⚠️ n8n error — fallback to direct insert");
    } catch(e:any){addLog(`⚠️ n8n offline: ${e.message}`);}
    addLog("Direct Supabase insert...");
    const score = localScore(f.message,f.status);
    const row:Omit<Lead,"id"> = {
      ...f, score, value:f.value?parseInt(f.value):undefined,
      score_reason:SCORE_LABELS[score]||"Standard qualification",
      ai_summary:f.message.substring(0,60),
      draft_email:`Hi ${f.name.split(" ")[0]},\n\nThanks for reaching out! I'd love to learn more.\n\nAre you free for a quick 15-min call?\n\nBest,\nAlex`,
      created_at:new Date().toISOString(),
    };
    const {data:saved,error} = await dbInsert(row);
    if(error){addLog(`❌ Supabase error: ${error}`);toast(`❌ DB error: ${error}`,"error");onAdd({id:`local-${Date.now()}`,...row});}
    else{addLog(`✅ Saved! id=${saved?.[0]?.id}`);onAdd(saved?.[0]||{id:`local-${Date.now()}`,...row});toast(`✅ Lead saved · Score ${score}/10`,"success");}
    setBusy(false);setTimeout(onClose,1500);
  };

  return (
    <Modal title="Add New Lead" sub="Via n8n → AI scoring → Supabase" onClose={onClose} wide>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
        <div><label style={LST}>Full Name</label><input value={f.name} onChange={e=>up("name",e.target.value)} placeholder="John Smith" style={INP}/></div>
        <div><label style={LST}>Email</label><input type="email" value={f.email} onChange={e=>up("email",e.target.value)} placeholder="john@company.com" style={INP}/></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
        <div><label style={LST}>Phone</label><input value={f.phone} onChange={e=>up("phone",e.target.value)} placeholder="+1 (555) 000-0000" style={INP}/></div>
        <div><label style={LST}>Deal Value ($)</label><input type="number" value={f.value} onChange={e=>up("value",e.target.value)} placeholder="5000" style={INP}/></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
        <div>
          <label style={LST}>Status</label>
          <div style={{display:"flex",gap:6}}>
            {(["hot","warm","cold"] as StatusKey[]).map(s=>(
              <button key={s} onClick={()=>up("status",s)} style={{flex:1,padding:"8px 4px",borderRadius:7,border:`1.5px solid ${f.status===s?SC[s].border:"#e5e7eb"}`,background:f.status===s?SC[s].bg:"#fff",color:f.status===s?SC[s].color:"#6b7280",fontSize:12,fontWeight:600,cursor:"pointer"}}>
                {s==="hot"?"🔥":s==="warm"?"🌤":"❄️"} {s[0].toUpperCase()+s.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label style={LST}>Pipeline Stage</label>
          <select value={f.stage} onChange={e=>up("stage",e.target.value)} style={INP}>
            {PIPELINE_STAGES.map(s=><option key={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div style={{marginBottom:16}}>
        <label style={LST}>Message / Inquiry</label>
        <textarea value={f.message} onChange={e=>up("message",e.target.value)} placeholder="What are they looking for? Budget? Timeline?" rows={3} style={{...INP,resize:"vertical" as const,fontFamily:"inherit",lineHeight:1.6}}/>
      </div>
      <div style={{marginBottom:14,padding:"10px 13px",background:"#f0fdf4",border:"1.5px solid #bbf7d0",borderRadius:8,display:"flex",alignItems:"center",gap:8}}>
        <Webhook size={13} color="#16a34a"/>
        <span style={{color:"#166534",fontSize:12,fontWeight:500}}>n8n Webhook → AI Scoring → Supabase → Auto Email</span>
        <CheckCircle size={13} color="#16a34a" style={{marginLeft:"auto"}}/>
      </div>
      {showLog&&log.length>0&&(
        <div style={{marginBottom:12,background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:8,padding:"10px 12px",maxHeight:100,overflowY:"auto"}}>
          <div style={{color:"#6b7280",fontSize:10,fontWeight:700,marginBottom:5,display:"flex",alignItems:"center",gap:5}}><Terminal size={11}/>DEBUG</div>
          {log.map((l,i)=><div key={i} style={{color:l.includes("❌")?"#dc2626":l.includes("✅")?"#16a34a":l.includes("⚠️")?"#d97706":"#6b7280",fontSize:11,fontFamily:"monospace",lineHeight:1.7}}>{l}</div>)}
        </div>
      )}
      <div style={{display:"flex",gap:10}}>
        <button onClick={onClose} style={{flex:1,...BTNS}}>Cancel</button>
        <button onClick={submit} disabled={busy} style={{flex:2,...BTNP,justifyContent:"center",opacity:busy?.6:1}}>
          <Plus size={14}/>{busy?"Processing…":"Add Lead"}
        </button>
      </div>
    </Modal>
  );
}

// ─── SEND EMAIL MODAL ─────────────────────────────────────────────────────────
function SendEmailModal({lead,onClose,toast,onFollowupScheduled}:{lead:Lead;onClose:()=>void;toast:(m:string,t?:Toast["type"])=>void;onFollowupScheduled?:()=>void}) {
  const [subj,setSubj] = useState(`Following up — let's connect, ${lead.name.split(" ")[0]}`);
  const [body,setBody] = useState(lead.draft_email||"");
  const [seq,setSeq]   = useState(true);
  const [busy,setBusy] = useState(false);
  const send = async () => {
    setBusy(true); await new Promise(r=>setTimeout(r,700));
    if(seq){
      const now=new Date().toISOString();
      for(const step of FOLLOWUP_SEQUENCE.slice(1)) await dbInsertFollowup({lead_id:lead.id,lead_name:lead.name,lead_email:lead.email,step_label:step.label,step_day:step.day,subject:step.subject(lead.name),body:step.body(lead),scheduled_at:addDays(now,step.day),status:"pending",created_at:now});
      onFollowupScheduled?.();
      toast(`Email sent + ${FOLLOWUP_SEQUENCE.length-1} follow-ups scheduled ✅`,"success");
    } else {toast(`Email sent to ${lead.email}`,"success");}
    setBusy(false);onClose();
  };
  return (
    <Modal title="Send Email" sub={`To: ${lead.name} · ${lead.email}`} onClose={onClose} wide>
      <div style={{marginBottom:12}}><label style={LST}>Subject</label><input value={subj} onChange={e=>setSubj(e.target.value)} style={INP}/></div>
      <div style={{marginBottom:14}}><label style={LST}>Message</label><textarea value={body} onChange={e=>setBody(e.target.value)} rows={8} style={{...INP,resize:"vertical" as const,fontFamily:"inherit",lineHeight:1.7}}/></div>
      <div style={{marginBottom:16,background:"#f0f9ff",border:"1.5px solid #bae6fd",borderRadius:10,padding:"14px 16px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:seq?12:0}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}><Clock size={14} color="#0369a1"/><span style={{color:"#0c4a6e",fontSize:13,fontWeight:600}}>GHL-style Auto Follow-up Sequence</span></div>
          <button onClick={()=>setSeq(!seq)} style={{width:38,height:20,borderRadius:10,background:seq?"#6366f1":"#d1d5db",border:"none",cursor:"pointer",position:"relative",transition:"background .2s"}}>
            <div style={{position:"absolute",top:2,left:seq?18:2,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left .2s"}}/>
          </button>
        </div>
        {seq&&(
          <div style={{display:"flex",flexDirection:"column",gap:5}}>
            {FOLLOWUP_SEQUENCE.slice(1).map((s,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 10px",background:"#fff",borderRadius:6,border:"1px solid #e0f2fe"}}>
                <div style={{width:20,height:20,borderRadius:"50%",background:"#dbeafe",display:"flex",alignItems:"center",justifyContent:"center",color:"#1d4ed8",fontSize:10,fontWeight:700}}>{i+2}</div>
                <span style={{color:"#6b7280",fontSize:12}}>Day {s.day}</span>
                <span style={{color:"#374151",fontSize:12,fontWeight:500}}>{s.label}</span>
                <span style={{marginLeft:"auto",color:"#9ca3af",fontSize:11}}>Auto-send</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{display:"flex",gap:10}}>
        <button onClick={onClose} style={{flex:1,...BTNS}}>Cancel</button>
        <button onClick={send} disabled={busy} style={{flex:2,...BTNP,justifyContent:"center",opacity:busy?.6:1}}><Send size={14}/>{busy?"Sending…":"Send + Schedule Sequence"}</button>
      </div>
    </Modal>
  );
}

// ─── DIAGNOSTICS ─────────────────────────────────────────────────────────────
function DiagPanel({toast,onClose}:{toast:(m:string,t?:Toast["type"])=>void;onClose:()=>void}) {
  const [results,setResults] = useState<{label:string;status:"ok"|"err"|"pending";detail:string}[]>([]);
  const [running,setRunning] = useState(false);
  const push = (label:string,status:"ok"|"err"|"pending",detail:string) =>
    setResults(p=>{const x=p.findIndex(r=>r.label===label);if(x>=0){const n=[...p];n[x]={label,status,detail};return n;}return [...p,{label,status,detail}];});

  const run = async () => {
    setRunning(true);setResults([]);
    push("Supabase Connection","pending","Testing...");
    try{const r=await fetch(`${SUPABASE_URL}/rest/v1/leads?select=count&limit=1`,{headers:H});r.ok?push("Supabase Connection","ok",`HTTP ${r.status} ✅`):push("Supabase Connection","err",`HTTP ${r.status}`);}catch(e:any){push("Supabase Connection","err",e.message);}
    push("leads Table","pending","Checking...");
    try{const r=await fetch(`${SUPABASE_URL}/rest/v1/leads?select=id&limit=1`,{headers:H});if(r.ok){const d=await r.json();push("leads Table","ok",`Exists · ${Array.isArray(d)?d.length:0} rows`);}else{const t=await r.text();push("leads Table","err",`${r.status}: ${t}`);}}catch(e:any){push("leads Table","err",e.message);}
    push("stage/value columns","pending","Checking...");
    try{const r=await fetch(`${SUPABASE_URL}/rest/v1/leads?select=stage,value&limit=1`,{headers:H});r.ok?push("stage/value columns","ok","Columns exist ✅"):push("stage/value columns","err","Run the ALTER TABLE SQL from Settings!");}catch(e:any){push("stage/value columns","err",e.message);}
    push("n8n Webhook","pending","Pinging...");
    try{const r=await fetch(N8N_WEBHOOK,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:"__ping__",email:"ping@test.com",phone:"",message:"test",source:"diag"})});r.ok?push("n8n Webhook","ok",`HTTP ${r.status} ✅`):push("n8n Webhook","err",`${r.status} — activate workflow`);}catch(e:any){push("n8n Webhook","err",`Unreachable: ${e.message}`);}
    setRunning(false);toast("Diagnostics complete","info");
  };

  return (
    <Modal title="🔬 System Diagnostics" sub="Tests all connections + columns" onClose={onClose} wide>
      {results.length>0&&(
        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
          {results.map(r=>{
            const C=r.status==="ok"?["#f0fdf4","#16a34a","#bbf7d0"]:r.status==="err"?["#fef2f2","#dc2626","#fecaca"]:["#fffbeb","#d97706","#fde68a"];
            return (
              <div key={r.label} style={{background:C[0],border:`1.5px solid ${C[2]}`,borderRadius:9,padding:"10px 14px"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                  {r.status==="ok"&&<CheckCircle size={13} color="#16a34a"/>}
                  {r.status==="err"&&<AlertCircle size={13} color="#dc2626"/>}
                  {r.status==="pending"&&<RefreshCw size={13} color="#d97706" style={{animation:"spin .7s linear infinite"}}/>}
                  <span style={{color:C[1],fontSize:12,fontWeight:600}}>{r.label}</span>
                </div>
                <pre style={{color:C[1],fontSize:11,whiteSpace:"pre-wrap",margin:0,fontFamily:"monospace",lineHeight:1.5,opacity:.85}}>{r.detail}</pre>
              </div>
            );
          })}
        </div>
      )}
      {results.length===0&&!running&&<div style={{padding:"28px 0",textAlign:"center",color:"#9ca3af",fontSize:13}}>Click "Run Diagnostics" to test all connections</div>}
      <div style={{display:"flex",gap:10}}>
        <button onClick={onClose} style={{flex:1,...BTNS}}>Close</button>
        <button onClick={run} disabled={running} style={{flex:2,...BTNP,justifyContent:"center",opacity:running?.6:1}}><Bug size={14}/>{running?"Running…":"Run Diagnostics"}</button>
      </div>
    </Modal>
  );
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function LoginPage({onLogin}:{onLogin:(u:User)=>void}) {
  const [email,setEmail] = useState(ADMIN.email);
  const [pass,setPass]   = useState(ADMIN.password);
  const [busy,setBusy]   = useState(false);
  const [err,setErr]     = useState("");
  const go = async () => {
    setBusy(true);setErr("");
    await new Promise(r=>setTimeout(r,500));
    if(email.trim()===ADMIN.email&&pass===ADMIN.password) onLogin({name:ADMIN.name,email,role:ADMIN.role});
    else setErr("Wrong credentials. Use the pre-filled values.");
    setBusy(false);
  };
  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#f8faff 0%,#eef2ff 50%,#faf5ff 100%)",display:"flex",fontFamily:"'DM Sans',sans-serif",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",width:500,height:500,borderRadius:"50%",background:"radial-gradient(circle,rgba(99,102,241,.12) 0%,transparent 70%)",top:-150,left:-100}}/>
      <div style={{position:"absolute",width:400,height:400,borderRadius:"50%",background:"radial-gradient(circle,rgba(16,185,129,.08) 0%,transparent 70%)",bottom:-80,right:100}}/>
      <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",padding:"60px 80px",zIndex:1}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:48}}>
          <div style={{width:42,height:42,borderRadius:12,background:"linear-gradient(135deg,#6366f1,#4f46e5)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 15px rgba(99,102,241,.35)"}}><Bot size={22} color="#fff"/></div>
          <span style={{color:"#111827",fontSize:20,fontWeight:800}}>Agency<span style={{color:"#6366f1"}}>OS</span></span>
        </div>
        <h1 style={{color:"#111827",fontSize:44,fontWeight:800,lineHeight:1.15,marginBottom:14}}>
          Close more deals,<br/><span style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>automatically.</span>
        </h1>
        <p style={{color:"#6b7280",fontSize:15,lineHeight:1.75,marginBottom:36}}>AI-powered CRM with GHL-style automation.<br/>Every lead scored, every follow-up handled.</p>
        {[
          {icon:<Zap size={14}/>,color:"#f59e0b",text:"AI Lead Scoring 1–10 via OpenRouter"},
          {icon:<Shield size={14}/>,color:"#6366f1",text:"n8n Validation + Automation Pipeline"},
          {icon:<Clock size={14}/>,color:"#10b981",text:"GHL-style 4-Step Follow-up Sequences"},
          {icon:<TrendingUp size={14}/>,color:"#8b5cf6",text:"Pipeline Stages + Deal Value Tracking"},
        ].map((feat,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
            <div style={{width:28,height:28,borderRadius:8,background:`${feat.color}18`,display:"flex",alignItems:"center",justifyContent:"center",color:feat.color}}>{feat.icon}</div>
            <span style={{color:"#374151",fontSize:13,fontWeight:500}}>{feat.text}</span>
          </div>
        ))}
      </div>
      <div style={{width:460,display:"flex",alignItems:"center",justifyContent:"center",padding:40,zIndex:1}}>
        <div style={{width:"100%",maxWidth:400,background:"#fff",border:"1.5px solid #e5e7eb",borderRadius:20,padding:36,boxShadow:"0 20px 60px rgba(0,0,0,.08)"}}>
          <h2 style={{color:"#111827",fontSize:22,fontWeight:700,marginBottom:4}}>Sign in</h2>
          <p style={{color:"#9ca3af",fontSize:13,marginBottom:22}}>Your dashboard is ready</p>
          <div style={{background:"#f0fdf4",border:"1.5px solid #bbf7d0",borderRadius:8,padding:"10px 13px",display:"flex",alignItems:"center",gap:9,marginBottom:20}}>
            <CheckCircle size={14} color="#16a34a"/>
            <div><div style={{color:"#166534",fontSize:11,fontWeight:600}}>Pre-filled — just click Sign In</div><div style={{color:"#6b7280",fontSize:11,marginTop:1}}>admin@agency.com / admin123</div></div>
          </div>
          <div style={{marginBottom:12}}><label style={LST}>Email</label><input value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()} style={INP}/></div>
          <div style={{marginBottom:20}}><label style={LST}>Password</label><input type="password" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()} style={INP}/></div>
          {err&&<div style={{background:"#fef2f2",border:"1.5px solid #fecaca",borderRadius:8,padding:"10px 13px",color:"#dc2626",fontSize:12,marginBottom:16,display:"flex",gap:7,alignItems:"center"}}><AlertCircle size={13}/>{err}</div>}
          <button onClick={go} disabled={busy} style={{width:"100%",...BTNP,justifyContent:"center",padding:"13px",fontSize:14,opacity:busy?.7:1}}>{busy?"Signing in…":"Sign In →"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
const NAV = [
  {id:"dashboard",label:"Dashboard",  icon:LayoutDashboard},
  {id:"pipeline", label:"Pipeline",   icon:TrendingUp},
  {id:"leads",    label:"All Leads",  icon:Users},
  {id:"followups",label:"Follow-ups", icon:Clock},
  {id:"inbox",    label:"Inbox",      icon:Inbox},
  {id:"campaigns",label:"Campaigns",  icon:Mail},
  {id:"analytics",label:"Analytics",  icon:BarChart2},
  {id:"settings", label:"Settings",   icon:Settings},
];

function Sidebar({active,setActive,user,onLogout,col,setCol,followupCount,onDiag}:
  {active:string;setActive:(id:string)=>void;user:User;onLogout:()=>void;col:boolean;setCol:(v:boolean)=>void;followupCount:number;onDiag:()=>void}) {
  return (
    <div style={{width:col?64:230,minHeight:"100vh",background:"#fff",borderRight:"1.5px solid #f3f4f6",display:"flex",flexDirection:"column",transition:"width .2s",overflow:"hidden",flexShrink:0,boxShadow:"2px 0 8px rgba(0,0,0,.04)"}}>
      <div style={{padding:"18px 14px",display:"flex",alignItems:"center",gap:10,borderBottom:"1.5px solid #f3f4f6"}}>
        <div style={{width:32,height:32,borderRadius:9,background:"linear-gradient(135deg,#6366f1,#4f46e5)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:"0 2px 8px rgba(99,102,241,.3)"}}><Bot size={17} color="#fff"/></div>
        {!col&&<span style={{color:"#111827",fontWeight:800,fontSize:15}}>Agency<span style={{color:"#6366f1"}}>OS</span></span>}
        <button onClick={()=>setCol(!col)} style={{marginLeft:"auto",background:"none",border:"none",color:"#9ca3af",cursor:"pointer",flexShrink:0}}><Menu size={16}/></button>
      </div>
      <nav style={{flex:1,padding:"10px 8px"}}>
        {NAV.map(({id,label,icon:Icon})=>{
          const on=active===id;
          return (
            <button key={id} onClick={()=>setActive(id)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 10px",borderRadius:9,background:on?"#eef2ff":"transparent",border:"none",color:on?"#4f46e5":"#6b7280",cursor:"pointer",marginBottom:2,textAlign:"left",transition:"all .12s",fontWeight:on?600:500}}>
              <Icon size={16} style={{flexShrink:0}}/>
              {!col&&<span style={{fontSize:13,flex:1,whiteSpace:"nowrap"}}>{label}</span>}
              {!col&&id==="followups"&&followupCount>0&&<span style={{background:"#f59e0b",color:"#fff",fontSize:9,fontWeight:700,padding:"1px 5px",borderRadius:9}}>{followupCount}</span>}
              {!col&&on&&<ChevronRight size={12} style={{opacity:.4}}/>}
            </button>
          );
        })}
      </nav>
      <div style={{padding:"0 8px 8px"}}>
        <button onClick={onDiag} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderRadius:9,background:"#fef2f2",border:"none",color:"#dc2626",cursor:"pointer",fontWeight:500}}>
          <Bug size={15} style={{flexShrink:0}}/>{!col&&<span style={{fontSize:12}}>Diagnostics</span>}
        </button>
      </div>
      <div style={{padding:"10px 8px",borderTop:"1.5px solid #f3f4f6"}}>
        <div style={{display:"flex",alignItems:"center",gap:9,padding:"8px 10px",borderRadius:9,background:"#f9fafb"}}>
          <div style={{width:28,height:28,borderRadius:"50%",background:"linear-gradient(135deg,#6366f1,#4f46e5)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:10,fontWeight:700,flexShrink:0}}>{user.name.split(" ").map((n:string)=>n[0]).join("")}</div>
          {!col&&<><div style={{flex:1,overflow:"hidden"}}><div style={{color:"#111827",fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.name}</div><div style={{color:"#9ca3af",fontSize:10}}>{user.role}</div></div><button onClick={onLogout} style={{background:"none",border:"none",color:"#9ca3af",cursor:"pointer"}}><LogOut size={13}/></button></>}
        </div>
      </div>
    </div>
  );
}

// ─── TOPBAR ───────────────────────────────────────────────────────────────────
function Topbar({title,subtitle,nc,onBell,onRefresh,refreshing,onAdd}:
  {title:string;subtitle?:string;nc:number;onBell:()=>void;onRefresh:()=>void;refreshing:boolean;onAdd:()=>void}) {
  return (
    <div style={{height:60,background:"#fff",borderBottom:"1.5px solid #f3f4f6",display:"flex",alignItems:"center",padding:"0 24px",gap:12,flexShrink:0}}>
      <div style={{flex:1}}>
        <div style={{color:"#111827",fontWeight:700,fontSize:16}}>{title}</div>
        {subtitle&&<div style={{color:"#9ca3af",fontSize:11,marginTop:1}}>{subtitle}</div>}
      </div>
      <div style={{display:"flex",alignItems:"center",background:"#f9fafb",border:"1.5px solid #f3f4f6",borderRadius:9,padding:"7px 12px",gap:7,width:220}}>
        <Search size={13} color="#9ca3af"/><input placeholder="Search leads…" style={{background:"none",border:"none",color:"#374151",fontSize:13,outline:"none",width:"100%"}}/>
      </div>
      <button onClick={onAdd} style={{...BTNP,padding:"8px 14px",fontSize:12}}><Plus size={13}/>Add Lead</button>
      <button onClick={onRefresh} style={{background:"#f9fafb",border:"1.5px solid #f3f4f6",borderRadius:8,width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"#6b7280"}}>
        <RefreshCw size={13} style={{animation:refreshing?"spin .7s linear infinite":"none"}}/>
      </button>
      <button onClick={onBell} style={{position:"relative",background:"#f9fafb",border:"1.5px solid #f3f4f6",borderRadius:8,width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"#6b7280"}}>
        <Bell size={13}/>{nc>0&&<div style={{position:"absolute",top:5,right:5,width:14,height:14,background:"#ef4444",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:7,color:"#fff",fontWeight:700}}>{nc>9?"9+":nc}</div>}
      </button>
    </div>
  );
}

// ─── NOTIF PANEL ──────────────────────────────────────────────────────────────
function NotifPanel({notifs,onClose,onClear}:{notifs:Notif[];onClose:()=>void;onClear:()=>void}) {
  return (
    <div style={{position:"fixed",top:68,right:18,width:320,background:"#fff",border:"1.5px solid #e5e7eb",borderRadius:14,boxShadow:"0 10px 40px rgba(0,0,0,.1)",zIndex:600,overflow:"hidden"}}>
      <div style={{padding:"12px 16px",borderBottom:"1.5px solid #f3f4f6",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{color:"#111827",fontWeight:600,fontSize:13}}>Notifications</span>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onClear} style={{background:"none",border:"none",color:"#6366f1",fontSize:11,cursor:"pointer",fontWeight:600}}>Clear all</button>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#9ca3af",cursor:"pointer"}}><X size={14}/></button>
        </div>
      </div>
      <div style={{maxHeight:320,overflowY:"auto"}}>
        {notifs.length===0?<div style={{padding:28,textAlign:"center",color:"#9ca3af",fontSize:13}}>All caught up 🎉</div>
          :notifs.map((n,i)=>(
            <div key={i} style={{padding:"10px 16px",borderBottom:"1px solid #f9fafb",display:"flex",gap:10,alignItems:"flex-start"}}>
              <div style={{width:26,height:26,borderRadius:"50%",background:`${n.color}18`,display:"flex",alignItems:"center",justifyContent:"center",color:n.color,flexShrink:0}}>{n.icon}</div>
              <div><div style={{color:"#374151",fontSize:12}}>{n.text}</div><div style={{color:"#9ca3af",fontSize:10,marginTop:2}}>{n.time}</div></div>
            </div>
          ))}
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function DashboardPage({leads,followups,onDiag}:{leads:Lead[];followups:Followup[];onDiag:()=>void}) {
  const hot  = leads.filter(l=>l.status==="hot").length;
  const avg  = leads.length?(leads.reduce((a,b)=>a+b.score,0)/leads.length).toFixed(1):"—";
  const pend = followups.filter(f=>f.status==="pending").length;
  const rev  = leads.reduce((a,l)=>a+(l.value||0),0);
  const won  = leads.filter(l=>l.stage==="Won").length;

  return (
    <div style={{padding:24,overflowY:"auto",flex:1,background:"#f9fafb"}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:14,marginBottom:22}}>
        {[
          {label:"Total Leads",    val:leads.length,           sub:"+12% this month",  icon:Users,      color:"#6366f1",bg:"#eef2ff"},
          {label:"Hot Leads",      val:hot,                    sub:"Ready to close",   icon:Zap,        color:"#f59e0b",bg:"#fffbeb"},
          {label:"Pipeline Value", val:`$${(rev/1000).toFixed(1)}k`,sub:"Total deal value",icon:TrendingUp,color:"#16a34a",bg:"#f0fdf4"},
          {label:"Avg AI Score",   val:`${avg}/10`,            sub:"Lead quality",     icon:Target,     color:"#8b5cf6",bg:"#faf5ff"},
          {label:"Follow-ups Due", val:pend,                   sub:"Need action",      icon:Clock,      color:"#dc2626",bg:"#fef2f2"},
        ].map((s,i)=>(
          <div key={i} style={{background:"#fff",border:"1.5px solid #f3f4f6",borderRadius:12,padding:"16px 18px",boxShadow:"0 1px 4px rgba(0,0,0,.04)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <span style={{color:"#6b7280",fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:.4}}>{s.label}</span>
              <div style={{width:30,height:30,borderRadius:8,background:s.bg,display:"flex",alignItems:"center",justifyContent:"center"}}><s.icon size={14} color={s.color}/></div>
            </div>
            <div style={{color:"#111827",fontSize:24,fontWeight:800,marginBottom:4}}>{s.val}</div>
            <div style={{color:"#9ca3af",fontSize:11}}>{s.sub}</div>
          </div>
        ))}
      </div>
      <div style={{background:"#fff",border:"1.5px solid #fde68a",borderRadius:10,padding:"11px 16px",marginBottom:18,display:"flex",alignItems:"center",gap:12}}>
        <Bug size={14} color="#d97706"/>
        <span style={{color:"#92400e",fontSize:13}}>Having issues with leads not saving or n8n errors?</span>
        <button onClick={onDiag} style={{marginLeft:"auto",padding:"5px 12px",background:"#fffbeb",border:"1.5px solid #fde68a",borderRadius:7,color:"#d97706",fontSize:12,fontWeight:600,cursor:"pointer"}}>Run Diagnostics</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 320px",gap:18}}>
        <div style={{background:"#fff",border:"1.5px solid #f3f4f6",borderRadius:12,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,.04)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <h3 style={{color:"#111827",fontWeight:700,fontSize:14}}>Recent Leads</h3>
            <span style={{background:"#f3f4f6",color:"#6b7280",fontSize:11,padding:"2px 8px",borderRadius:9}}>{leads.length} total</span>
          </div>
          {leads.slice(0,7).map(l=>(
            <div key={l.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid #f9fafb"}}>
              <div style={{width:34,height:34,borderRadius:"50%",background:`${scoreColor(l.score)}18`,display:"flex",alignItems:"center",justifyContent:"center",color:scoreColor(l.score),fontSize:11,fontWeight:700,flexShrink:0}}>{l.name.split(" ").map((n:string)=>n[0]).join("")}</div>
              <div style={{flex:1}}>
                <div style={{color:"#111827",fontSize:13,fontWeight:600}}>{l.name}</div>
                <div style={{color:"#9ca3af",fontSize:11,marginTop:1}}>{(l.ai_summary||"").substring(0,50)}</div>
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3}}>
                <span style={{background:scoreBg(l.score),color:scoreColor(l.score),border:`1px solid ${scoreBorder(l.score)}`,fontSize:11,fontWeight:700,padding:"2px 7px",borderRadius:5}}>{l.score}/10</span>
                {l.value&&<span style={{color:"#6b7280",fontSize:10}}>{fmtVal(l.value)}</span>}
              </div>
            </div>
          ))}
        </div>
        <div style={{background:"#fff",border:"1.5px solid #f3f4f6",borderRadius:12,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,.04)"}}>
          <h3 style={{color:"#111827",fontWeight:700,fontSize:14,marginBottom:16}}>Recent Activity</h3>
          {[
            {icon:<Zap size={12}/>,color:"#f59e0b",text:"Sarah Mitchell scored 9/10",time:"2m ago"},
            {icon:<Mail size={12}/>,color:"#6366f1",text:"Email sent: Priya Sharma",time:"5m ago"},
            {icon:<CheckCircle size={12}/>,color:"#16a34a",text:"Lead saved: Nina Petrova",time:"12m ago"},
            {icon:<Clock size={12}/>,color:"#8b5cf6",text:"Follow-up queued ×3",time:"18m ago"},
            {icon:<Bot size={12}/>,color:"#6366f1",text:"n8n workflow triggered",time:"25m ago"},
            {icon:<Star size={12}/>,color:"#f59e0b",text:"Hot alert: Priya Sharma",time:"30m ago"},
          ].map((a,i)=>(
            <div key={i} style={{display:"flex",gap:10,marginBottom:12}}>
              <div style={{width:26,height:26,borderRadius:"50%",background:`${a.color}15`,display:"flex",alignItems:"center",justifyContent:"center",color:a.color,flexShrink:0}}>{a.icon}</div>
              <div><div style={{color:"#374151",fontSize:12}}>{a.text}</div><div style={{color:"#9ca3af",fontSize:10,marginTop:1}}>{a.time}</div></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── PIPELINE (GHL KANBAN — saves to Supabase) ───────────────────────────────
function PipelinePage({leads,setLeads,toast}:{leads:Lead[];setLeads:React.Dispatch<React.SetStateAction<Lead[]>>;toast:(m:string,t?:Toast["type"])=>void}) {
  const [moving,setMoving] = useState<string|null>(null);

  const moveStage = async (id:string, stage:string) => {
    setMoving(id);
    // Optimistic update first
    setLeads(p=>p.map(l=>l.id===id?{...l,stage}:l));
    // Save to Supabase
    const ok = await dbPatch(id,{stage});
    if(ok) {
      toast(`Moved to ${stage} ✅`,"success");
    } else {
      // Revert on failure
      toast("❌ Failed to save — check Supabase connection","error");
      const rows = await dbLoad();
      if(rows.length>0) setLeads(rows);
    }
    setMoving(null);
  };

  const stageLeads = (s:string) => leads.filter(l=>(l.stage||"New Lead")===s);
  const stageValue = (s:string) => stageLeads(s).reduce((a,l)=>a+(l.value||0),0);

  return (
    <div style={{padding:24,overflowX:"auto",overflowY:"auto",flex:1,background:"#f9fafb"}}>
      <div style={{marginBottom:16,padding:"10px 16px",background:"#fff",border:"1.5px solid #f3f4f6",borderRadius:10,display:"flex",alignItems:"center",gap:10}}>
        <CheckCircle size={14} color="#16a34a"/>
        <span style={{color:"#374151",fontSize:13}}>Pipeline stages are saved permanently to Supabase. Changes persist across page refreshes.</span>
        <span style={{marginLeft:"auto",color:"#9ca3af",fontSize:12}}>Total: {fmtVal(leads.reduce((a,l)=>a+(l.value||0),0))}</span>
      </div>
      <div style={{display:"flex",gap:14,minWidth:"max-content"}}>
        {PIPELINE_STAGES.map(stage=>(
          <div key={stage} style={{width:230,background:"#fff",borderRadius:12,border:"1.5px solid #f3f4f6",overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,.04)"}}>
            <div style={{padding:"12px 14px",borderBottom:"1.5px solid #f3f4f6",background:`${STAGE_COLORS[stage]}08`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{color:STAGE_COLORS[stage],fontSize:12,fontWeight:700}}>{stage}</span>
                <span style={{background:`${STAGE_COLORS[stage]}18`,color:STAGE_COLORS[stage],fontSize:10,fontWeight:700,padding:"1px 6px",borderRadius:9}}>{stageLeads(stage).length}</span>
              </div>
              <div style={{color:"#9ca3af",fontSize:11,marginTop:3}}>{stageValue(stage)>0?fmtVal(stageValue(stage)):"No value set"}</div>
            </div>
            <div style={{padding:8,minHeight:120,display:"flex",flexDirection:"column",gap:7}}>
              {stageLeads(stage).map(l=>(
                <div key={l.id} style={{background:"#fff",border:`1.5px solid ${scoreBorder(l.score)}`,borderRadius:9,padding:"10px 12px",boxShadow:"0 1px 3px rgba(0,0,0,.05)",opacity:moving===l.id?.6:1,transition:"opacity .2s"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:5}}>
                    <span style={{color:"#111827",fontSize:12,fontWeight:600}}>{l.name}</span>
                    <span style={{background:scoreBg(l.score),color:scoreColor(l.score),fontSize:10,fontWeight:700,padding:"1px 5px",borderRadius:4,border:`1px solid ${scoreBorder(l.score)}`}}>{l.score}</span>
                  </div>
                  <div style={{color:"#9ca3af",fontSize:11,marginBottom:l.value?5:7}}>{(l.ai_summary||"").substring(0,38)}{(l.ai_summary||"").length>38?"…":""}</div>
                  {l.value&&<div style={{color:"#16a34a",fontSize:11,fontWeight:600,marginBottom:7}}>{fmtVal(l.value)}</div>}
                  <div style={{display:"flex",gap:4}}>
                    {PIPELINE_STAGES.indexOf(stage)>0&&(
                      <button disabled={moving===l.id} onClick={()=>moveStage(l.id,PIPELINE_STAGES[PIPELINE_STAGES.indexOf(stage)-1])} style={{flex:1,padding:"4px 0",background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:5,color:"#6b7280",fontSize:10,cursor:"pointer",opacity:moving===l.id?.5:1}}>← Back</button>
                    )}
                    {PIPELINE_STAGES.indexOf(stage)<PIPELINE_STAGES.length-1&&(
                      <button disabled={moving===l.id} onClick={()=>moveStage(l.id,PIPELINE_STAGES[PIPELINE_STAGES.indexOf(stage)+1])} style={{flex:1,padding:"4px 0",background:STAGE_COLORS[stage],border:"none",borderRadius:5,color:"#fff",fontSize:10,cursor:"pointer",fontWeight:600,opacity:moving===l.id?.5:1}}>Next →</button>
                    )}
                  </div>
                </div>
              ))}
              {stageLeads(stage).length===0&&<div style={{padding:"20px 0",textAlign:"center",color:"#d1d5db",fontSize:12}}>Empty</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── LEADS PAGE ───────────────────────────────────────────────────────────────
function LeadsPage({leads,setLeads,onAdd,toast}:{leads:Lead[];setLeads:React.Dispatch<React.SetStateAction<Lead[]>>;onAdd:()=>void;toast:(m:string,t?:Toast["type"])=>void}) {
  const [sel,setSel]         = useState<Lead|null>(null);
  const [filter,setFilter]   = useState<"all"|StatusKey>("all");
  const [emailFor,setEmailFor] = useState<Lead|null>(null);
  const vis = filter==="all"?leads:leads.filter(l=>l.status===filter);

  const deleteLead = async (id:string) => {
    if(!window.confirm("Delete this lead?")) return;
    await dbDelete(id);
    setLeads(p=>p.filter(l=>l.id!==id));
    if(sel?.id===id) setSel(null);
    toast("Lead deleted","info");
  };

  const chStatus = async (id:string,status:StatusKey) => {
    await dbPatch(id,{status});
    setLeads(p=>p.map(l=>l.id===id?{...l,status}:l));
    if(sel?.id===id) setSel(p=>p?{...p,status}:p);
    toast(`Status → ${status}`,"success");
  };

  return (
    <div style={{display:"flex",flex:1,overflow:"hidden",background:"#f9fafb"}}>
      {emailFor&&<SendEmailModal lead={emailFor} onClose={()=>setEmailFor(null)} toast={toast}/>}
      <div style={{flex:1,padding:22,overflowY:"auto"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16,flexWrap:"wrap"}}>
          {(["all","hot","warm","cold"] as const).map(f=>(
            <button key={f} onClick={()=>setFilter(f)} style={{padding:"6px 14px",borderRadius:8,border:`1.5px solid ${filter===f?"#6366f1":"#e5e7eb"}`,background:filter===f?"#eef2ff":"#fff",color:filter===f?"#4f46e5":"#6b7280",fontSize:12,fontWeight:600,cursor:"pointer"}}>
              {f==="all"?`All (${leads.length})`:`${f[0].toUpperCase()+f.slice(1)} (${leads.filter(l=>l.status===f).length})`}
            </button>
          ))}
          <button onClick={onAdd} style={{marginLeft:"auto",...BTNP,padding:"7px 14px",fontSize:12}}><Plus size={12}/>Add Lead</button>
        </div>
        <div style={{background:"#fff",border:"1.5px solid #f3f4f6",borderRadius:12,overflow:"auto",boxShadow:"0 1px 4px rgba(0,0,0,.04)"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr style={{borderBottom:"1.5px solid #f3f4f6",background:"#f9fafb"}}>
                {["Lead","Contact","AI Summary","Score","Value","Stage","Status","Date","Actions"].map(h=>(
                  <th key={h} style={{padding:"10px 14px",textAlign:"left",color:"#9ca3af",fontSize:10,fontWeight:700,letterSpacing:.5,whiteSpace:"nowrap"}}>{h.toUpperCase()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vis.map(lead=>(
                <tr key={lead.id} style={{borderBottom:"1px solid #f9fafb",background:sel?.id===lead.id?"#f5f3ff":"#fff"}}>
                  <td style={{padding:"12px 14px"}} onClick={()=>setSel(lead)}>
                    <div style={{display:"flex",alignItems:"center",gap:9,cursor:"pointer"}}>
                      <div style={{width:30,height:30,borderRadius:"50%",background:`${scoreColor(lead.score)}18`,display:"flex",alignItems:"center",justifyContent:"center",color:scoreColor(lead.score),fontSize:10,fontWeight:700,flexShrink:0}}>{lead.name.split(" ").map((n:string)=>n[0]).join("")}</div>
                      <span style={{color:"#111827",fontSize:13,fontWeight:600}}>{lead.name}</span>
                    </div>
                  </td>
                  <td style={{padding:"12px 14px",cursor:"pointer"}} onClick={()=>setSel(lead)}>
                    <div style={{color:"#374151",fontSize:12}}>{lead.email}</div>
                    <div style={{color:"#9ca3af",fontSize:11,marginTop:1}}>{lead.phone}</div>
                  </td>
                  <td style={{padding:"12px 14px",maxWidth:160,cursor:"pointer"}} onClick={()=>setSel(lead)}>
                    <div style={{color:"#6b7280",fontSize:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{lead.ai_summary}</div>
                  </td>
                  <td style={{padding:"12px 14px",cursor:"pointer"}} onClick={()=>setSel(lead)}>
                    <span style={{background:scoreBg(lead.score),color:scoreColor(lead.score),border:`1px solid ${scoreBorder(lead.score)}`,fontSize:12,fontWeight:700,padding:"2px 8px",borderRadius:6}}>{lead.score}/10</span>
                  </td>
                  <td style={{padding:"12px 14px",color:"#374151",fontSize:12,fontWeight:500}}>{fmtVal(lead.value)}</td>
                  <td style={{padding:"12px 14px"}}>
                    <span style={{background:`${STAGE_COLORS[lead.stage||"New Lead"]}18`,color:STAGE_COLORS[lead.stage||"New Lead"],fontSize:11,padding:"2px 8px",borderRadius:6,fontWeight:500}}>{lead.stage||"New Lead"}</span>
                  </td>
                  <td style={{padding:"12px 14px"}}>
                    <select value={lead.status} onChange={e=>chStatus(lead.id,e.target.value as StatusKey)} style={{background:SC[lead.status].bg,color:SC[lead.status].color,border:`1px solid ${SC[lead.status].border}`,borderRadius:6,padding:"3px 7px",fontSize:11,fontWeight:600,cursor:"pointer",outline:"none"}}>
                      <option value="hot">🔥 Hot</option>
                      <option value="warm">🌤 Warm</option>
                      <option value="cold">❄️ Cold</option>
                    </select>
                  </td>
                  <td style={{padding:"12px 14px",color:"#9ca3af",fontSize:11}}>{fmt(lead.created_at)}</td>
                  <td style={{padding:"12px 14px"}}>
                    <div style={{display:"flex",gap:4}}>
                      <button onClick={()=>setEmailFor(lead)} title="Email" style={{background:"#eef2ff",border:"1px solid #c7d2fe",borderRadius:6,padding:"5px 7px",color:"#4f46e5",cursor:"pointer"}}><Send size={11}/></button>
                      <button onClick={()=>setSel(lead)} title="View" style={{background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:6,padding:"5px 7px",color:"#6b7280",cursor:"pointer"}}><Eye size={11}/></button>
                      <button onClick={()=>deleteLead(lead.id)} title="Delete" style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:6,padding:"5px 7px",color:"#dc2626",cursor:"pointer"}}><Trash2 size={11}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {vis.length===0&&(
            <div style={{padding:40,textAlign:"center"}}>
              <Users size={36} color="#e5e7eb" strokeWidth={1} style={{display:"block",margin:"0 auto 12px"}}/>
              <div style={{color:"#9ca3af",fontSize:14}}>No leads yet — add your first one!</div>
            </div>
          )}
        </div>
      </div>
      {sel&&(
        <div style={{width:340,background:"#fff",borderLeft:"1.5px solid #f3f4f6",padding:20,overflowY:"auto",flexShrink:0}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}>
            <h3 style={{color:"#111827",fontWeight:700,fontSize:14}}>Lead Detail</h3>
            <button onClick={()=>setSel(null)} style={{background:"none",border:"none",color:"#9ca3af",cursor:"pointer"}}><X size={15}/></button>
          </div>
          <div style={{textAlign:"center",marginBottom:16}}>
            <div style={{width:52,height:52,borderRadius:"50%",background:`${scoreColor(sel.score)}18`,display:"flex",alignItems:"center",justifyContent:"center",color:scoreColor(sel.score),fontSize:16,fontWeight:800,margin:"0 auto 10px",border:`2px solid ${scoreBorder(sel.score)}`}}>{sel.name.split(" ").map((n:string)=>n[0]).join("")}</div>
            <div style={{color:"#111827",fontWeight:700,fontSize:15}}>{sel.name}</div>
            {sel.value&&<div style={{color:"#16a34a",fontWeight:700,fontSize:14,marginTop:3}}>{fmtVal(sel.value)}</div>}
            <div style={{display:"flex",justifyContent:"center",gap:8,marginTop:8}}>
              <span style={{background:scoreBg(sel.score),color:scoreColor(sel.score),border:`1px solid ${scoreBorder(sel.score)}`,fontSize:12,fontWeight:700,padding:"2px 10px",borderRadius:6}}>{sel.score}/10</span>
              <span style={{background:SC[sel.status].bg,color:SC[sel.status].color,border:`1px solid ${SC[sel.status].border}`,fontSize:11,padding:"2px 8px",borderRadius:5}}>{SC[sel.status].label}</span>
            </div>
          </div>
          {([{icon:<Mail size={12}/>,l:"Email",v:sel.email},{icon:<Phone size={12}/>,l:"Phone",v:sel.phone||"—"},{icon:<Tag size={12}/>,l:"Stage",v:sel.stage||"New Lead"},{icon:<Calendar size={12}/>,l:"Received",v:fmt(sel.created_at)}]).map((r,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:7,padding:"8px 10px",background:"#f9fafb",borderRadius:8,border:"1px solid #f3f4f6"}}>
              <span style={{color:"#6366f1"}}>{r.icon}</span>
              <div><div style={{color:"#9ca3af",fontSize:9,fontWeight:700,textTransform:"uppercase"}}>{r.l}</div><div style={{color:"#374151",fontSize:12}}>{r.v}</div></div>
            </div>
          ))}
          {([
            {tag:"MESSAGE",    v:sel.message,      bg:"#f9fafb",col:"#374151",bdr:"#f3f4f6"},
            {tag:"AI SUMMARY", v:sel.ai_summary,   bg:"#eef2ff", col:"#4f46e5",bdr:"#c7d2fe"},
            {tag:"SCORE NOTE", v:sel.score_reason, bg:scoreBg(sel.score),col:scoreColor(sel.score),bdr:scoreBorder(sel.score)},
            {tag:"AI DRAFT",   v:sel.draft_email,  bg:"#f9fafb", col:"#6b7280",bdr:"#f3f4f6"},
          ]).map((b,i)=>(
            <div key={i} style={{marginBottom:9}}>
              <div style={{color:"#9ca3af",fontSize:9,fontWeight:700,letterSpacing:.4,marginBottom:4,textTransform:"uppercase"}}>{b.tag}</div>
              <div style={{background:b.bg,border:`1px solid ${b.bdr}`,borderRadius:8,padding:"10px 11px",color:b.col,fontSize:12,lineHeight:1.6,whiteSpace:"pre-line"}}>{b.v}</div>
            </div>
          ))}
          <div style={{display:"flex",gap:8,marginTop:10}}>
            <button onClick={()=>setEmailFor(sel)} style={{flex:1,...BTNP,justifyContent:"center",padding:"9px"}}><Mail size={12}/>Email</button>
            <button onClick={()=>deleteLead(sel.id)} style={{flex:1,background:"#fef2f2",border:"1.5px solid #fecaca",borderRadius:8,padding:"9px",color:"#dc2626",fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}><Trash2 size={12}/>Delete</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── FOLLOW-UPS ───────────────────────────────────────────────────────────────
function FollowupsPage({followups,setFollowups,toast}:{followups:Followup[];setFollowups:React.Dispatch<React.SetStateAction<Followup[]>>;toast:(m:string,t?:Toast["type"])=>void}) {
  const markSent = async (fu:Followup) => { await dbPatchFollowup(fu.id,{status:"sent"}); setFollowups(p=>p.map(f=>f.id===fu.id?{...f,status:"sent"}:f)); toast(`Sent for ${fu.lead_name}`,"success"); };
  const markSkip = async (fu:Followup) => { await dbPatchFollowup(fu.id,{status:"skipped"}); setFollowups(p=>p.map(f=>f.id===fu.id?{...f,status:"skipped"}:f)); toast("Skipped","info"); };
  const pending = followups.filter(f=>f.status==="pending");
  const sent    = followups.filter(f=>f.status==="sent");

  const card = (fu:Followup) => {
    const past=new Date(fu.scheduled_at)<new Date();
    return (
      <div key={fu.id} style={{background:"#fff",border:`1.5px solid ${past&&fu.status==="pending"?"#fde68a":"#f3f4f6"}`,borderRadius:10,padding:"13px 16px",marginBottom:9,boxShadow:"0 1px 3px rgba(0,0,0,.04)"}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:7}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
              {past&&fu.status==="pending"&&<span style={{background:"#fffbeb",color:"#d97706",border:"1px solid #fde68a",fontSize:9,fontWeight:700,padding:"1px 6px",borderRadius:4}}>⚠ DUE</span>}
              <span style={{color:"#111827",fontSize:13,fontWeight:600}}>{fu.lead_name}</span>
              <span style={{color:"#9ca3af",fontSize:11}}>·</span>
              <span style={{color:"#6366f1",fontSize:11,fontWeight:500}}>{fu.step_label}</span>
            </div>
            <div style={{color:"#9ca3af",fontSize:11}}>📅 {fmtDay(fu.scheduled_at)} · {fu.lead_email}</div>
          </div>
          {fu.status==="pending"&&(
            <div style={{display:"flex",gap:6}}>
              <button onClick={()=>markSent(fu)} style={{background:"#f0fdf4",border:"1.5px solid #bbf7d0",borderRadius:7,padding:"5px 9px",color:"#16a34a",fontSize:11,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:4}}><Send size={10}/>Send</button>
              <button onClick={()=>markSkip(fu)} style={{background:"#f9fafb",border:"1.5px solid #e5e7eb",borderRadius:7,padding:"5px 9px",color:"#6b7280",fontSize:11,cursor:"pointer"}}>Skip</button>
            </div>
          )}
          {fu.status==="sent"&&<span style={{background:"#f0fdf4",color:"#16a34a",border:"1px solid #bbf7d0",fontSize:11,padding:"2px 9px",borderRadius:5,fontWeight:600}}>✓ Sent</span>}
          {fu.status==="skipped"&&<span style={{background:"#f9fafb",color:"#9ca3af",fontSize:11,padding:"2px 9px",borderRadius:5}}>Skipped</span>}
        </div>
        <div style={{color:"#9ca3af",fontSize:11,fontStyle:"italic"}}>"{fu.subject}"</div>
      </div>
    );
  };

  return (
    <div style={{padding:24,overflowY:"auto",flex:1,background:"#f9fafb"}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:22}}>
        {[{l:"Pending",v:pending.length,c:"#f59e0b"},{l:"Sent",v:sent.length,c:"#16a34a"},{l:"Skipped",v:followups.filter(f=>f.status==="skipped").length,c:"#6b7280"}].map(s=>(
          <div key={s.l} style={{background:"#fff",border:"1.5px solid #f3f4f6",borderRadius:10,padding:"16px 20px",display:"flex",alignItems:"center",gap:14,boxShadow:"0 1px 3px rgba(0,0,0,.04)"}}>
            <div style={{fontSize:28,fontWeight:800,color:s.c}}>{s.v}</div>
            <div style={{color:"#6b7280",fontSize:13}}>{s.l} Follow-ups</div>
          </div>
        ))}
      </div>
      {pending.length>0&&<div style={{marginBottom:20}}><div style={{color:"#374151",fontSize:12,fontWeight:700,letterSpacing:.4,marginBottom:10,textTransform:"uppercase"}}>Pending / Due</div>{pending.map(card)}</div>}
      {sent.length>0&&<div><div style={{color:"#9ca3af",fontSize:12,fontWeight:700,letterSpacing:.4,marginBottom:10,textTransform:"uppercase"}}>Sent</div>{sent.map(card)}</div>}
      {pending.length===0&&sent.length===0&&(
        <div style={{textAlign:"center",marginTop:60}}>
          <Clock size={44} color="#e5e7eb" strokeWidth={1} style={{display:"block",margin:"0 auto 12px"}}/>
          <div style={{color:"#9ca3af",fontSize:14}}>No follow-ups yet</div>
          <div style={{color:"#d1d5db",fontSize:12,marginTop:5}}>Send an email from All Leads to start a sequence</div>
        </div>
      )}
    </div>
  );
}

// ─── INBOX ────────────────────────────────────────────────────────────────────
function InboxPage({leads,toast}:{leads:Lead[];toast:(m:string,t?:Toast["type"])=>void}) {
  const [active,setActive]   = useState<Lead|null>(null);
  const [emailFor,setEmailFor] = useState<Lead|null>(null);
  return (
    <div style={{display:"flex",flex:1,overflow:"hidden"}}>
      {emailFor&&<SendEmailModal lead={emailFor} onClose={()=>setEmailFor(null)} toast={toast}/>}
      <div style={{width:260,borderRight:"1.5px solid #f3f4f6",overflowY:"auto",background:"#fff"}}>
        <div style={{padding:"12px 16px",borderBottom:"1.5px solid #f3f4f6",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{color:"#111827",fontWeight:700,fontSize:13}}>AI Drafts</span>
          <span style={{background:"#f3f4f6",color:"#6b7280",fontSize:10,padding:"2px 7px",borderRadius:9}}>{leads.length}</span>
        </div>
        {leads.map(l=>(
          <div key={l.id} onClick={()=>setActive(l)} style={{padding:"11px 16px",borderBottom:"1px solid #f9fafb",cursor:"pointer",background:active?.id===l.id?"#f5f3ff":"#fff"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
              <span style={{color:"#111827",fontSize:13,fontWeight:600}}>{l.name}</span>
              <span style={{background:scoreBg(l.score),color:scoreColor(l.score),border:`1px solid ${scoreBorder(l.score)}`,fontSize:10,padding:"1px 5px",borderRadius:4,fontWeight:700}}>{l.score}/10</span>
            </div>
            <div style={{color:"#9ca3af",fontSize:11,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{(l.draft_email||"").substring(0,44)}…</div>
          </div>
        ))}
      </div>
      <div style={{flex:1,padding:28,overflowY:"auto",background:"#f9fafb"}}>
        {active?(
          <div style={{maxWidth:560}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
              <div><h2 style={{color:"#111827",fontWeight:800,fontSize:17}}>Draft for {active.name}</h2><p style={{color:"#9ca3af",fontSize:12,marginTop:2}}>To: {active.email}</p></div>
              <button onClick={()=>setEmailFor(active)} style={{...BTNP,padding:"9px 16px"}}><Send size={13}/>Send + Sequence</button>
            </div>
            <div style={{background:"#fff",border:"1.5px solid #e5e7eb",borderRadius:12,padding:22,marginBottom:14}}>
              <div style={{color:"#6366f1",fontSize:10,fontWeight:700,letterSpacing:.5,marginBottom:14,textTransform:"uppercase"}}>AI Generated Draft</div>
              <div style={{color:"#374151",fontSize:14,lineHeight:1.8,whiteSpace:"pre-line"}}>{active.draft_email}</div>
            </div>
            <div style={{padding:14,background:"#eef2ff",border:"1.5px solid #c7d2fe",borderRadius:10}}>
              <div style={{color:"#4f46e5",fontSize:11,fontWeight:600,marginBottom:4}}>🧠 AI Context</div>
              <div style={{color:"#6b7280",fontSize:12}}>{active.ai_summary}</div>
            </div>
          </div>
        ):(
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",flexDirection:"column",gap:10}}>
            <Inbox size={44} color="#e5e7eb" strokeWidth={1}/>
            <div style={{color:"#9ca3af",fontSize:14}}>Select a draft to preview</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ANALYTICS (real data from leads) ────────────────────────────────────────
function AnalyticsPage({leads,followups}:{leads:Lead[];followups:Followup[]}) {
  const bins = Array(10).fill(0) as number[];
  leads.forEach(l=>{if(l.score>=1&&l.score<=10) bins[l.score-1]++;});
  const mx = Math.max(...bins,1);
  const ct:Record<StatusKey,number> = {hot:leads.filter(l=>l.status==="hot").length,warm:leads.filter(l=>l.status==="warm").length,cold:leads.filter(l=>l.status==="cold").length};
  const avg = leads.length?(leads.reduce((a,x)=>a+x.score,0)/leads.length).toFixed(1):"—";
  const totalVal = leads.reduce((a,l)=>a+(l.value||0),0);
  const wonVal   = leads.filter(l=>l.stage==="Won").reduce((a,l)=>a+(l.value||0),0);
  const wonCount = leads.filter(l=>l.stage==="Won").length;
  const convRate = leads.length?Math.round(wonCount/leads.length*100):0;
  const avgVal   = leads.filter(l=>l.value).length?(totalVal/leads.filter(l=>l.value).length).toFixed(0):"0";
  const sentFu   = followups.filter(f=>f.status==="sent").length;
  const totalFu  = followups.length;
  const fuRate   = totalFu?Math.round(sentFu/totalFu*100):0;

  // Score over time (last 7 leads)
  const recent = [...leads].slice(0,7).reverse();

  return (
    <div style={{padding:24,overflowY:"auto",flex:1,background:"#f9fafb"}}>
      {/* KPI row */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
        {[
          {l:"Total Pipeline",  v:`$${(totalVal/1000).toFixed(1)}k`, sub:`${leads.filter(l=>l.value).length} deals with value`, c:"#16a34a"},
          {l:"Won Revenue",     v:`$${(wonVal/1000).toFixed(1)}k`,   sub:`${wonCount} deals closed`,                           c:"#6366f1"},
          {l:"Conversion Rate", v:`${convRate}%`,                    sub:`${wonCount} of ${leads.length} leads`,               c:"#f59e0b"},
          {l:"Avg Deal Size",   v:`$${parseInt(avgVal).toLocaleString()}`, sub:"Per valued lead",                              c:"#8b5cf6"},
        ].map(s=>(
          <div key={s.l} style={{background:"#fff",border:"1.5px solid #f3f4f6",borderRadius:12,padding:"18px 20px",boxShadow:"0 1px 4px rgba(0,0,0,.04)"}}>
            <div style={{color:"#9ca3af",fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:.4,marginBottom:8}}>{s.l}</div>
            <div style={{color:s.c,fontSize:28,fontWeight:800,marginBottom:3}}>{s.v}</div>
            <div style={{color:"#9ca3af",fontSize:11}}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18,marginBottom:18}}>
        {/* Score distribution */}
        <div style={{background:"#fff",border:"1.5px solid #f3f4f6",borderRadius:12,padding:22,boxShadow:"0 1px 4px rgba(0,0,0,.04)"}}>
          <h3 style={{color:"#111827",fontWeight:700,fontSize:14,marginBottom:18}}>AI Score Distribution</h3>
          <div style={{display:"flex",alignItems:"flex-end",gap:7,height:120,marginBottom:8}}>
            {bins.map((c,i)=>(
              <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4,height:"100%"}}>
                <div style={{flex:1,display:"flex",alignItems:"flex-end",width:"100%"}}>
                  <div title={`Score ${i+1}: ${c} leads`} style={{width:"100%",background:c>0?(i>=6?"#16a34a":i>=3?"#f59e0b":"#dc2626"):"#f3f4f6",borderRadius:"4px 4px 0 0",height:`${(c/mx)*100}%`,minHeight:c>0?4:0,transition:"height .3s"}}/>
                </div>
                <span style={{color:"#9ca3af",fontSize:9}}>{i+1}</span>
                {c>0&&<span style={{color:"#6b7280",fontSize:8,fontWeight:700}}>{c}</span>}
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:12,marginTop:8}}>
            {[{l:"High (7-10)",c:"#16a34a"},{l:"Mid (4-6)",c:"#f59e0b"},{l:"Low (1-3)",c:"#dc2626"}].map(x=>(
              <div key={x.l} style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:8,height:8,borderRadius:2,background:x.c}}/><span style={{color:"#6b7280",fontSize:11}}>{x.l}</span></div>
            ))}
          </div>
        </div>

        {/* Status breakdown */}
        <div style={{background:"#fff",border:"1.5px solid #f3f4f6",borderRadius:12,padding:22,boxShadow:"0 1px 4px rgba(0,0,0,.04)"}}>
          <h3 style={{color:"#111827",fontWeight:700,fontSize:14,marginBottom:18}}>Lead Status Breakdown</h3>
          {(Object.entries(ct) as [StatusKey,number][]).map(([s,c])=>(
            <div key={s} style={{marginBottom:16}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                <div style={{display:"flex",alignItems:"center",gap:7}}>
                  <span style={{fontSize:14}}>{s==="hot"?"🔥":s==="warm"?"🌤":"❄️"}</span>
                  <span style={{color:SC[s].color,fontSize:13,fontWeight:600,textTransform:"capitalize"}}>{s}</span>
                </div>
                <span style={{color:"#6b7280",fontSize:12}}>{c} leads · {leads.length?Math.round(c/leads.length*100):0}%</span>
              </div>
              <div style={{height:9,background:"#f3f4f6",borderRadius:4,overflow:"hidden"}}>
                <div style={{height:"100%",background:SC[s].color,borderRadius:4,width:leads.length?`${(c/leads.length)*100}%`:"0%",transition:"width .4s"}}/>
              </div>
            </div>
          ))}
          <div style={{marginTop:8,padding:14,background:"#f9fafb",borderRadius:9,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{color:"#6b7280",fontSize:12}}>Average AI Score</div>
            <div style={{color:"#111827",fontSize:22,fontWeight:800}}>{avg}<span style={{color:"#9ca3af",fontSize:13}}>/10</span></div>
          </div>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18}}>
        {/* Pipeline stage breakdown */}
        <div style={{background:"#fff",border:"1.5px solid #f3f4f6",borderRadius:12,padding:22,boxShadow:"0 1px 4px rgba(0,0,0,.04)"}}>
          <h3 style={{color:"#111827",fontWeight:700,fontSize:14,marginBottom:18}}>Pipeline Stage Breakdown</h3>
          {PIPELINE_STAGES.map(stage=>{
            const count = leads.filter(l=>(l.stage||"New Lead")===stage).length;
            const val   = leads.filter(l=>(l.stage||"New Lead")===stage).reduce((a,l)=>a+(l.value||0),0);
            return (
              <div key={stage} style={{display:"flex",alignItems:"center",gap:12,marginBottom:12,padding:"8px 10px",background:"#f9fafb",borderRadius:8}}>
                <div style={{width:10,height:10,borderRadius:"50%",background:STAGE_COLORS[stage],flexShrink:0}}/>
                <span style={{color:"#374151",fontSize:12,flex:1}}>{stage}</span>
                <span style={{background:`${STAGE_COLORS[stage]}18`,color:STAGE_COLORS[stage],fontSize:11,fontWeight:700,padding:"1px 7px",borderRadius:5}}>{count}</span>
                <span style={{color:"#6b7280",fontSize:11,minWidth:60,textAlign:"right"}}>{val>0?fmtVal(val):"—"}</span>
              </div>
            );
          })}
        </div>

        {/* Follow-up stats */}
        <div style={{background:"#fff",border:"1.5px solid #f3f4f6",borderRadius:12,padding:22,boxShadow:"0 1px 4px rgba(0,0,0,.04)"}}>
          <h3 style={{color:"#111827",fontWeight:700,fontSize:14,marginBottom:18}}>Follow-up Performance</h3>
          {[
            {l:"Total Sequences",  v:totalFu,   c:"#6b7280"},
            {l:"Sent",             v:sentFu,    c:"#16a34a"},
            {l:"Pending",          v:followups.filter(f=>f.status==="pending").length, c:"#f59e0b"},
            {l:"Skipped",          v:followups.filter(f=>f.status==="skipped").length, c:"#dc2626"},
          ].map(s=>(
            <div key={s.l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,padding:"10px 12px",background:"#f9fafb",borderRadius:8}}>
              <span style={{color:"#374151",fontSize:13}}>{s.l}</span>
              <span style={{color:s.c,fontSize:18,fontWeight:800}}>{s.v}</span>
            </div>
          ))}
          <div style={{marginTop:4,padding:"12px 14px",background:"#eef2ff",border:"1.5px solid #c7d2fe",borderRadius:9,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{color:"#4f46e5",fontSize:13,fontWeight:600}}>Send Rate</span>
            <span style={{color:"#4f46e5",fontSize:20,fontWeight:800}}>{fuRate}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CAMPAIGNS (workable) ─────────────────────────────────────────────────────
function CampaignsPage({leads,toast}:{leads:Lead[];toast:(m:string,t?:Toast["type"])=>void}) {
  const [cps,setCps] = useState<Campaign[]>([
    {id:1,name:"Cold Outreach — Q2",  status:"active",sent:42,opened:28,replied:9, type:"cold"},
    {id:2,name:"Follow-up Sequence",  status:"active",sent:24,opened:18,replied:6, type:"followup"},
    {id:3,name:"Hot Lead Fast-Track", status:"paused",sent:15,opened:14,replied:7, type:"hot"},
    {id:4,name:"Re-engagement Wave",  status:"draft", sent:0, opened:0, replied:0, type:"reengagement"},
  ]);
  const [newName,setNewName]   = useState("");
  const [showNew,setShowNew]   = useState(false);
  const [selCp,setSelCp]       = useState<Campaign|null>(null);

  const sclr:Record<string,{bg:string;color:string;border:string}> = {
    active:{bg:"#f0fdf4",color:"#16a34a",border:"#bbf7d0"},
    paused:{bg:"#fffbeb",color:"#d97706",border:"#fde68a"},
    draft: {bg:"#f0f9ff",color:"#0369a1",border:"#bae6fd"},
  };

  const toggle = (id:number) => {
    setCps(p=>p.map(c=>{
      if(c.id!==id) return c;
      const next = c.status==="active"?"paused" as const:c.status==="paused"?"active" as const:c.status;
      toast(`Campaign ${next==="active"?"resumed":"paused"}`,"success");
      return {...c,status:next};
    }));
  };

  const launch = (id:number) => {
    setCps(p=>p.map(c=>c.id===id?{...c,status:"active" as const}:c));
    toast("🚀 Campaign launched!","success");
  };

  const addCampaign = () => {
    if(!newName.trim()){toast("Enter a campaign name","error");return;}
    setCps(p=>[...p,{id:Date.now(),name:newName,status:"draft",sent:0,opened:0,replied:0,type:"custom"}]);
    toast(`Campaign "${newName}" created`,"success");
    setNewName(""); setShowNew(false);
  };

  const simulate = (id:number) => {
    setCps(p=>p.map(c=>{
      if(c.id!==id||c.status!=="active") return c;
      const add = Math.floor(Math.random()*5)+1;
      return {...c,sent:c.sent+add,opened:c.opened+Math.floor(add*.6),replied:c.replied+Math.floor(add*.2)};
    }));
    toast("Simulated send +1 batch","info");
  };

  const hotLeads = leads.filter(l=>l.status==="hot").length;

  return (
    <div style={{padding:24,overflowY:"auto",flex:1,background:"#f9fafb"}}>
      {/* Summary row */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
        {[
          {l:"Active Campaigns",v:cps.filter(c=>c.status==="active").length,c:"#16a34a"},
          {l:"Total Emails Sent",v:cps.reduce((a,c)=>a+c.sent,0),c:"#6366f1"},
          {l:"Total Opens",v:cps.reduce((a,c)=>a+c.opened,0),c:"#f59e0b"},
          {l:"Total Replies",v:cps.reduce((a,c)=>a+c.replied,0),c:"#8b5cf6"},
        ].map(s=>(
          <div key={s.l} style={{background:"#fff",border:"1.5px solid #f3f4f6",borderRadius:12,padding:"16px 18px",boxShadow:"0 1px 4px rgba(0,0,0,.04)"}}>
            <div style={{color:"#9ca3af",fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:.4,marginBottom:8}}>{s.l}</div>
            <div style={{color:s.c,fontSize:26,fontWeight:800}}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Hot leads alert */}
      {hotLeads>0&&(
        <div style={{background:"#fef2f2",border:"1.5px solid #fecaca",borderRadius:10,padding:"12px 16px",marginBottom:18,display:"flex",alignItems:"center",gap:12}}>
          <Zap size={16} color="#dc2626"/>
          <span style={{color:"#991b1b",fontSize:13,fontWeight:500}}><strong>{hotLeads} hot lead{hotLeads>1?"s":""}</strong> ready for Fast-Track campaign!</span>
          <button onClick={()=>launch(3)} style={{marginLeft:"auto",padding:"6px 14px",background:"#dc2626",border:"none",borderRadius:7,color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>Launch Fast-Track</button>
        </div>
      )}

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <h2 style={{color:"#111827",fontWeight:700,fontSize:17}}>Email Campaigns</h2>
        <button onClick={()=>setShowNew(!showNew)} style={{...BTNP,padding:"9px 16px"}}><Plus size={14}/>{showNew?"Cancel":"New Campaign"}</button>
      </div>

      {showNew&&(
        <div style={{background:"#fff",border:"1.5px solid #e5e7eb",borderRadius:12,padding:20,marginBottom:16,boxShadow:"0 1px 4px rgba(0,0,0,.04)"}}>
          <h3 style={{color:"#111827",fontWeight:600,fontSize:14,marginBottom:12}}>Create New Campaign</h3>
          <div style={{display:"flex",gap:10}}>
            <input value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addCampaign()} placeholder="Campaign name e.g. Summer Outreach 2026" style={{...INP,flex:1}}/>
            <button onClick={addCampaign} style={{...BTNP,padding:"10px 20px",whiteSpace:"nowrap"}}>Create</button>
          </div>
        </div>
      )}

      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {cps.map(c=>{
          const openRate  = c.sent?Math.round(c.opened/c.sent*100):0;
          const replyRate = c.sent?Math.round(c.replied/c.sent*100):0;
          return (
            <div key={c.id} style={{background:"#fff",border:"1.5px solid #f3f4f6",borderRadius:12,padding:"18px 22px",boxShadow:"0 1px 4px rgba(0,0,0,.04)",cursor:selCp?.id===c.id?"default":"pointer"}} onClick={()=>setSelCp(selCp?.id===c.id?null:c)}>
              <div style={{display:"flex",alignItems:"center",gap:16}}>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:3}}>
                    <span style={{color:"#111827",fontWeight:700,fontSize:14}}>{c.name}</span>
                    <span style={{background:sclr[c.status].bg,color:sclr[c.status].color,border:`1px solid ${sclr[c.status].border}`,fontSize:10,padding:"2px 7px",borderRadius:9,fontWeight:600}}>{c.status}</span>
                  </div>
                  {c.sent>0&&(
                    <div style={{display:"flex",gap:16,marginTop:6}}>
                      <div style={{display:"flex",flex:1,height:5,background:"#f3f4f6",borderRadius:3,overflow:"hidden",alignItems:"center"}}>
                        <div style={{width:`${openRate}%`,height:"100%",background:"#6366f1",borderRadius:3}}/>
                      </div>
                      <span style={{color:"#9ca3af",fontSize:11,whiteSpace:"nowrap"}}>Open {openRate}% · Reply {replyRate}%</span>
                    </div>
                  )}
                </div>
                {([["Sent",c.sent,"#6b7280"],["Opened",c.opened,"#6366f1"],["Replied",c.replied,"#16a34a"]] as [string,number,string][]).map(([l,v,col])=>(
                  <div key={l} style={{textAlign:"center",minWidth:56}}>
                    <div style={{color:col,fontSize:20,fontWeight:800}}>{v}</div>
                    <div style={{color:"#9ca3af",fontSize:10,marginTop:1}}>{l}</div>
                  </div>
                ))}
                <div style={{display:"flex",gap:7}} onClick={e=>e.stopPropagation()}>
                  {c.status==="draft"&&<button onClick={()=>launch(c.id)} style={{padding:"7px 12px",background:"#eef2ff",border:"1.5px solid #c7d2fe",borderRadius:8,color:"#4f46e5",fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}><Play size={11}/>Launch</button>}
                  {c.status==="active"&&<button onClick={()=>toggle(c.id)} style={{padding:"7px 12px",background:"#fef2f2",border:"1.5px solid #fecaca",borderRadius:8,color:"#dc2626",fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}><Pause size={11}/>Pause</button>}
                  {c.status==="paused"&&<button onClick={()=>toggle(c.id)} style={{padding:"7px 12px",background:"#f0fdf4",border:"1.5px solid #bbf7d0",borderRadius:8,color:"#16a34a",fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}><Play size={11}/>Resume</button>}
                  {c.status==="active"&&<button onClick={()=>simulate(c.id)} title="Simulate send" style={{padding:"7px 10px",background:"#f9fafb",border:"1.5px solid #e5e7eb",borderRadius:8,color:"#6b7280",fontSize:11,cursor:"pointer"}}>+Send</button>}
                </div>
              </div>
              {selCp?.id===c.id&&(
                <div style={{marginTop:16,paddingTop:16,borderTop:"1px solid #f3f4f6"}}>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
                    {[["Open Rate",`${openRate}%`,"#6366f1"],["Reply Rate",`${replyRate}%`,"#16a34a"],["Bounces","0","#dc2626"]].map(([l,v,c])=>(
                      <div key={l as string} style={{background:"#f9fafb",borderRadius:8,padding:"12px 14px",textAlign:"center"}}>
                        <div style={{color:c as string,fontSize:22,fontWeight:800}}>{v}</div>
                        <div style={{color:"#9ca3af",fontSize:11,marginTop:2}}>{l}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{marginTop:12,padding:"10px 14px",background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,color:"#166534",fontSize:12}}>
                    💡 Connect your SMTP in n8n to send real emails. This panel tracks campaign performance.
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
function SettingsPage({toast}:{toast:(m:string,t?:Toast["type"])=>void}) {
  const [testing,setTesting] = useState(false);
  const copy = (t:string) => {navigator.clipboard.writeText(t);toast("Copied!","success");};

  const testDB = async () => {
    setTesting(true);
    try{const r=await fetch(`${SUPABASE_URL}/rest/v1/leads?select=count&limit=1`,{headers:H});toast(r.ok?"✅ Supabase connected!":"❌ DB failed",r.ok?"success":"error");}
    catch{toast("❌ Network error","error");}
    setTesting(false);
  };

  const SQL_ALTER = `-- Run this in Supabase SQL Editor to add stage + value columns
-- (skip if already done)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS stage TEXT DEFAULT 'New Lead';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS value INTEGER;

-- Update policies to allow updates (for pipeline stage moves)
DROP POLICY IF EXISTS "Allow update" ON leads;
CREATE POLICY "Allow update" ON leads FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow delete" ON leads;
CREATE POLICY "Allow delete" ON leads FOR DELETE USING (true);`;

  const SQL_FOLLOWUPS = `CREATE TABLE IF NOT EXISTS followups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id TEXT,
  lead_name TEXT,
  lead_email TEXT,
  step_label TEXT,
  step_day INTEGER,
  subject TEXT,
  body TEXT,
  scheduled_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE followups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON followups USING (true) WITH CHECK (true);`;

  const N8N_CODE = `const raw = $input.first().json;
const data = raw.body || raw;
const email = (data.email || '').trim();
const phone = data.phone || '';
const emailValid = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email);
const phoneValid = !phone || phone.replace(/\\D/g,'').length >= 8;
return [{ json: { ...data, _validation_passed: emailValid && phoneValid } }];`;

  const N8N_PARSE = `const response = $input.first().json;
const text = response.choices[0].message.content;
const clean = text.replace(/\`\`\`json|\`\`\`/g,'').trim();
let parsed;
try { parsed = JSON.parse(clean); }
catch(e) { parsed = { score:5, score_reason:"Parse error", ai_summary:"Review needed", draft_email:"Hi,\\n\\nThanks for reaching out!\\n\\nBest,\\nAlex" }; }
const lead = $('Code in JavaScript').first().json;
return [{ json: { name:lead.name, email:lead.email, phone:lead.phone||'', message:lead.message||'', status:lead.status||'warm', stage:'New Lead', score:parsed.score, score_reason:parsed.score_reason, ai_summary:parsed.ai_summary, draft_email:parsed.draft_email, created_at:new Date().toISOString() } }];`;

  return (
    <div style={{padding:24,overflowY:"auto",flex:1,background:"#f9fafb",maxWidth:740}}>
      {/* Most important: ALTER TABLE */}
      <div style={{background:"#fff",border:"1.5px solid #fde68a",borderRadius:12,padding:22,marginBottom:16,boxShadow:"0 1px 4px rgba(0,0,0,.04)"}}>
        <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:14}}>
          <Database size={16} color="#d97706"/>
          <h3 style={{color:"#111827",fontWeight:700,fontSize:14}}>⚠️ Run This SQL First (adds stage + value + update policy)</h3>
          <button onClick={()=>copy(SQL_ALTER)} style={{...BTNS,padding:"5px 10px",fontSize:11,marginLeft:"auto",display:"flex",alignItems:"center",gap:5}}><Copy size={11}/>Copy</button>
        </div>
        <pre style={{background:"#fffbeb",border:"1.5px solid #fde68a",borderRadius:8,padding:14,color:"#374151",fontSize:11,lineHeight:1.7,overflowX:"auto",margin:0,whiteSpace:"pre-wrap"}}>{SQL_ALTER}</pre>
        <div style={{marginTop:10,color:"#92400e",fontSize:12,display:"flex",alignItems:"center",gap:6}}>
          <AlertCircle size={12}/>
          Without this, pipeline stage moves won't save permanently. Copy → paste in Supabase → SQL Editor → Run.
        </div>
      </div>

      {/* Followups table */}
      <div style={{background:"#fff",border:"1.5px solid #f3f4f6",borderRadius:12,padding:22,marginBottom:16,boxShadow:"0 1px 4px rgba(0,0,0,.04)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <h3 style={{color:"#111827",fontWeight:700,fontSize:13}}>SQL — followups table</h3>
          <button onClick={()=>copy(SQL_FOLLOWUPS)} style={{...BTNS,padding:"5px 10px",fontSize:11,display:"flex",alignItems:"center",gap:5}}><Copy size={11}/>Copy</button>
        </div>
        <pre style={{background:"#f9fafb",border:"1.5px solid #f3f4f6",borderRadius:8,padding:14,color:"#374151",fontSize:11,lineHeight:1.7,overflowX:"auto",margin:0,whiteSpace:"pre-wrap"}}>{SQL_FOLLOWUPS}</pre>
      </div>

      {/* n8n code snippets */}
      {[{title:"n8n Node 2 — Validation Code",code:N8N_CODE},{title:"n8n Node 4 — Parse AI Response",code:N8N_PARSE}].map(({title,code})=>(
        <div key={title} style={{background:"#fff",border:"1.5px solid #f3f4f6",borderRadius:12,padding:22,marginBottom:16,boxShadow:"0 1px 4px rgba(0,0,0,.04)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <h3 style={{color:"#111827",fontWeight:700,fontSize:13}}>{title}</h3>
            <button onClick={()=>copy(code)} style={{...BTNS,padding:"5px 10px",fontSize:11,display:"flex",alignItems:"center",gap:5}}><Copy size={11}/>Copy</button>
          </div>
          <pre style={{background:"#f9fafb",border:"1.5px solid #f3f4f6",borderRadius:8,padding:14,color:"#374151",fontSize:11,lineHeight:1.7,overflowX:"auto",margin:0,whiteSpace:"pre-wrap"}}>{code}</pre>
        </div>
      ))}

      {/* Supabase connection */}
      <div style={{background:"#fff",border:"1.5px solid #f3f4f6",borderRadius:12,padding:22,boxShadow:"0 1px 4px rgba(0,0,0,.04)"}}>
        <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:14}}>
          <Database size={15} color="#6366f1"/>
          <h3 style={{color:"#111827",fontWeight:700,fontSize:14}}>Supabase Connection</h3>
          <span style={{background:"#f0fdf4",color:"#16a34a",border:"1px solid #bbf7d0",fontSize:10,padding:"2px 8px",borderRadius:9,marginLeft:"auto"}}>✓ Active</span>
        </div>
        <div style={{padding:"10px 13px",background:"#f9fafb",border:"1.5px solid #f3f4f6",borderRadius:8,marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><div style={{color:"#9ca3af",fontSize:9,marginBottom:2,textTransform:"uppercase",fontWeight:600}}>Project URL</div><div style={{color:"#4f46e5",fontSize:11,fontFamily:"monospace"}}>{SUPABASE_URL}</div></div>
          <button onClick={()=>copy(SUPABASE_URL)} style={{background:"none",border:"none",color:"#9ca3af",cursor:"pointer"}}><Copy size={12}/></button>
        </div>
        <button onClick={testDB} disabled={testing} style={{...BTNP,padding:"9px 18px",fontSize:12,opacity:testing?.7:1}}>{testing?"Testing…":"Test Connection"}</button>
      </div>
    </div>
  );
}

// ─── APP ROOT ──────────────────────────────────────────────────────────────────
export default function App() {
  const [user,      setUser]      = useState<User|null>(null);
  const [page,      setPage]      = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [leads,     setLeads]     = useState<Lead[]>([]);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [refreshing,setRefreshing]= useState(false);
  const [showAdd,   setShowAdd]   = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [showDiag,  setShowDiag]  = useState(false);
  const [notifs,    setNotifs]    = useState<Notif[]>([
    {icon:<Zap size={12}/>,color:"#f59e0b",text:"Hot lead: Sarah Mitchell — 9/10",time:"2m ago"},
    {icon:<Mail size={12}/>,color:"#6366f1",text:"Draft sent: Priya Sharma",time:"5m ago"},
    {icon:<CheckCircle size={12}/>,color:"#16a34a",text:"Lead saved: Nina Petrova",time:"12m ago"},
  ]);
  const {toasts,add:toast,remove:removeToast} = useToast();

  useEffect(()=>{
    if(!user) return;
    (async()=>{
      setLoading(true);
      const [rows,fus] = await Promise.all([dbLoad(),dbLoadFollowups()]);
      if(rows&&rows.length>0){setLeads(rows);toast(`Loaded ${rows.length} leads ✅`,"success");}
      else {
        toast("Seeding demo leads…","info");
        const ins:Lead[]=[];
        for(const s of SEEDS){const {data:r}=await dbInsert(s);if(r?.[0])ins.push(r[0]);}
        setLeads(ins.length>0?ins:SEEDS.map((s,i)=>({...s,id:`local-${i}`})));
        if(ins.length>0)toast(`${ins.length} demo leads seeded ✅`,"success");
        else toast("⚠️ Supabase unavailable — using local data. Check Settings.","error");
      }
      if(fus)setFollowups(fus);
      setLoading(false);
    })();
  },[user]);

  useEffect(()=>{
    if(!user) return;
    const iv=setInterval(async()=>{
      const rows=await dbLoad();
      if(!rows) return;
      setLeads(prev=>{
        const known=new Set(prev.map(l=>String(l.id)));
        const fresh=rows.filter(r=>!known.has(String(r.id)));
        if(fresh.length){
          fresh.forEach(l=>{setNotifs(p=>[{icon:<Zap size={12}/>,color:"#f59e0b",text:`New lead: ${l.name} · Score ${l.score}/10`,time:"just now"},...p]);toast(`🔥 New lead: ${l.name} scored ${l.score}/10`,"success");});
          return [...fresh,...prev];
        }
        return rows;
      });
    },10000);
    return ()=>clearInterval(iv);
  },[user]);

  const refresh = async()=>{
    setRefreshing(true);
    const [rows,fus]=await Promise.all([dbLoad(),dbLoadFollowups()]);
    if(rows){setLeads(rows);toast(`Refreshed — ${rows.length} leads`,"success");}
    if(fus)setFollowups(fus);
    setRefreshing(false);
  };

  const addLead=(lead:Lead)=>{setLeads(p=>[lead,...p]);setNotifs(p=>[{icon:<Plus size={12}/>,color:"#16a34a",text:`Added: ${lead.name} · ${lead.score}/10`,time:"just now"},...p]);};

  const META:Record<string,{title:string;subtitle:string}> = {
    dashboard:{title:"Dashboard",   subtitle:"Real-time overview · n8n polling every 10s"},
    pipeline: {title:"Pipeline",    subtitle:"GHL-style Kanban · stages saved to Supabase"},
    leads:    {title:"All Leads",   subtitle:"AI-scored leads from n8n automation"},
    followups:{title:"Follow-ups",  subtitle:"4-step automated sequences"},
    inbox:    {title:"Inbox",       subtitle:"AI-drafted emails ready to send"},
    campaigns:{title:"Campaigns",   subtitle:"Email sequences and outreach flows"},
    analytics:{title:"Analytics",   subtitle:"Live metrics from your lead database"},
    settings: {title:"Settings",    subtitle:"SQL schemas · n8n guide · Supabase"},
  };

  const pendingFU=followups.filter(f=>f.status==="pending").length;

  if(!user) return <LoginPage onLogin={setUser}/>;

  return (
    <div style={{display:"flex",height:"100vh",background:"#f9fafb",fontFamily:"'DM Sans',system-ui,sans-serif",overflow:"hidden"}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        input:focus,textarea:focus,select:focus{border-color:#6366f1!important;box-shadow:0 0 0 3px rgba(99,102,241,.1);}
        select option{background:#fff;color:#111827;}
        ::-webkit-scrollbar{width:5px;height:5px;}
        ::-webkit-scrollbar-track{background:#f9fafb;}
        ::-webkit-scrollbar-thumb{background:#e5e7eb;border-radius:3px;}
        ::-webkit-scrollbar-thumb:hover{background:#d1d5db;}
        @keyframes spin{to{transform:rotate(360deg)}}
        tbody tr:hover td{background:#fafafa!important;}
        button:hover{filter:brightness(.97);}
      `}</style>

      <ToastStack toasts={toasts} remove={removeToast}/>
      {showAdd  &&<AddLeadModal  onClose={()=>setShowAdd(false)}  onAdd={addLead} toast={toast}/>}
      {showDiag &&<DiagPanel     onClose={()=>setShowDiag(false)} toast={toast}/>}
      {showNotif&&<NotifPanel    notifs={notifs} onClose={()=>setShowNotif(false)} onClear={()=>{setNotifs([]);setShowNotif(false);}}/>}

      <Sidebar active={page} setActive={setPage} user={user} onLogout={()=>setUser(null)} col={collapsed} setCol={setCollapsed} followupCount={pendingFU} onDiag={()=>setShowDiag(true)}/>

      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <Topbar title={META[page]?.title} subtitle={META[page]?.subtitle} nc={notifs.length} onBell={()=>setShowNotif(!showNotif)} onRefresh={refresh} refreshing={refreshing} onAdd={()=>setShowAdd(true)}/>
        {loading?(
          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:14,background:"#f9fafb"}}>
            <div style={{width:40,height:40,borderRadius:"50%",border:"3px solid #e5e7eb",borderTop:"3px solid #6366f1",animation:"spin .8s linear infinite"}}/>
            <div style={{color:"#9ca3af",fontSize:13}}>Connecting to Supabase…</div>
          </div>
        ):(
          <div style={{flex:1,display:"flex",overflow:"hidden"}}>
            {page==="dashboard" &&<DashboardPage leads={leads} followups={followups} onDiag={()=>setShowDiag(true)}/>}
            {page==="pipeline"  &&<PipelinePage  leads={leads} setLeads={setLeads} toast={toast}/>}
            {page==="leads"     &&<LeadsPage     leads={leads} setLeads={setLeads} onAdd={()=>setShowAdd(true)} toast={toast}/>}
            {page==="followups" &&<FollowupsPage followups={followups} setFollowups={setFollowups} toast={toast}/>}
            {page==="inbox"     &&<InboxPage     leads={leads} toast={toast}/>}
            {page==="campaigns" &&<CampaignsPage leads={leads} toast={toast}/>}
            {page==="analytics" &&<AnalyticsPage leads={leads} followups={followups}/>}
            {page==="settings"  &&<SettingsPage  toast={toast}/>}
          </div>
        )}
      </div>
    </div>
  );
}