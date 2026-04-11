import { initializeApp }   from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, onValue, set, update, remove, push }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const fbApp = initializeApp({
  apiKey:"AIzaSyAKFVZJxVc2Gw2DilEiD3WaYzwEF2qeWgU",
  authDomain:"mt-benchmark.firebaseapp.com",
  databaseURL:"https://mt-benchmark-default-rtdb.firebaseio.com",
  projectId:"mt-benchmark",
  storageBucket:"mt-benchmark.firebasestorage.app",
  messagingSenderId:"723193525268",
  appId:"1:723193525268:web:2128f6ecf0f7da77c3a301"
});
const db = getDatabase(fbApp);

/* ── DEFAULT WODs (Firebase에 없을 때만 사용) ── */
const DEFAULT_WODS = [
  {id:1, group:"STRENGTH", type:"weight", name:"BSQ 5RM",        detail:"Back Squat"},
  {id:2, group:"STRENGTH", type:"weight", name:"FSQ 5RM",        detail:"Front Squat"},
  {id:3, group:"STRENGTH", type:"weight", name:"BENCH PRESS 5RM",detail:""},
  {id:4, group:"STRENGTH", type:"weight", name:"DL 5RM",         detail:"Deadlift"},
  {id:5, group:"STRENGTH", type:"weight", name:"OHP 5RM",        detail:"Overhead Press"},
  {id:6, group:"HYROX",   type:"time",   name:"1K RUN",         detail:""},
  {id:7, group:"HYROX",   type:"time",   name:"3K RUN",         detail:""},
  {id:8, group:"HYROX",   type:"time",   name:"5K RUN",         detail:""},
  {id:9, group:"HYROX",   type:"time",   name:"1K ROW",         detail:""},
  {id:10,group:"HYROX",   type:"time",   name:"3K ROW",         detail:""},
  {id:11,group:"HYROX",   type:"time",   name:"5K ROW",         detail:""},
  {id:12,group:"WOD",      type:"rounds", name:"AMRAP 20'",     detail:"5 Pull Up · 10 Push Up · 15 Air Squat"},
  {id:13,group:"WOD",      type:"time",   name:"50-40-30-20-10", detail:"Double Under + Sit Up"},
  {id:14,group:"WOD",      type:"time",   name:"1-10 TTB",       detail:"Toes To Bar + BP Bar Touch"},
  {id:15,group:"WOD",      type:"time",   name:"5R 400M RUN",    detail:"30 Box Jump + 30 WBS"},
  {id:16,group:"WOD",      type:"time",   name:"150 WBS",        detail:"20 / 14 lb"},
  {id:17,group:"WOD",      type:"time",   name:"100 KBSN",       detail:"24 / 16 kg"},
  {id:18,group:"WOD",      type:"time",   name:"5R 400M RUN",    detail:"15 OHS (40/30)"},
  {id:19,group:"WOD",      type:"time",   name:"21-15-9",        detail:"Pull Up + Thruster (40/30)"},
  {id:20,group:"WOD",      type:"time",   name:"30 SNATCH",      detail:"60 / 40 kg"},
  {id:21,group:"WOD",      type:"time",   name:"30 CLEAN & JERK",detail:"60 / 40 kg"},
  {id:22,group:"WOD",      type:"time",   name:"21-15-9 DL",     detail:"DL (100/75) + HSPU"}
];

const PIN = "1234";
const today = () => { const d=new Date(); return `${d.getMonth()+1}/${d.getDate()}`; };

/* ── State ── */
let members = [];
let WODS = [...DEFAULT_WODS];
let coachMessage = "";
let S = {
  view:"login", activeMemberId:null, memberTab:"my",
  profileModal:false, profileNewName:"", profileNameErr:"", profileGender:"",
  allMembersModal:false,
  viewingMemberId:null,
  bdRecordModal:false,
  coachTab:"members", coachSection:"menu", coachSheetView:"list", panelId:null, coachMemberSearch:"", bdWodId:undefined, bdNote:undefined,
  search:"", pin:"", pinErr:false,
  editing:null, editVal:{value:"",scale:""},
  addingMember:false, newName:"",
  editingMember:null, confirmDelete:null,
  pinModal:false,
  newMemberName:"",
  timeVal:{min:"",sec:""},
  // WOD manager
  showWodForm:false,
  wodFormVal:{name:"",detail:"",group:"WOD",type:"time",youtube:""},
  editingWod:null,  // {id,name,detail,group,type}
  // avatar picker
  avatarModal:false,  // memberId being picked for
  // new member register
  registerModal:false,
  registerName:"",
  registerErr:"",
  registerStep:1,      // 1=이름입력 2=캐릭터선택
  registerAvatar:null, // 선택한 캐릭터 인덱스
  // history view mode per wod: { [memberId_wodId]: "list"|"graph" }
  histView:{},
};

/* ── 초기 세션 복원 ── */
try {
  if (localStorage.getItem("mt_coach_logged")==="1") {
    S.view="coach"; S.coachSection="menu";
  }
} catch(e) {}

/* ── Firebase sync ── */
onValue(ref(db,"coachMessage"), snap => { coachMessage = snap.val()||""; render(); });

let todayWod = null;
let passes   = {};
let classes  = {};
const todayKey = () => { const d=new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };
onValue(ref(db,"benchmarkDay"), snap => { todayWod = snap.val()||null; render(); });
onValue(ref(db,"passes"),  snap => { passes  = snap.val()||{}; render(); });
onValue(ref(db,"classes"), snap => { classes = snap.val()||{}; render(); });
onValue(ref(db,"wods"), snap => {
  const raw = snap.val();
  if (raw) {
    const GOM = {STRENGTH:0, HYROX:1, WOD:2};
    WODS = Object.entries(raw)
      .map(([k,v]) => ({id:parseInt(k), name:v.name, detail:v.detail||"", group:v.group||"WOD", type:v.type||"time", youtube:v.youtube||""}))
      .sort((a,b) => {
        const ga=GOM[a.group]??9, gb=GOM[b.group]??9;
        return ga!==gb ? ga-gb : a.id-b.id;
      });
  } else {
    DEFAULT_WODS.forEach(w => set(ref(db,`wods/${w.id}`), {name:w.name, detail:w.detail, group:w.group||"WOD", type:w.type||"time", youtube:""}));
  }
  render();
});
onValue(ref(db,"members"), snap => {
  const raw = snap.val()||{};
  members = Object.entries(raw)
    .map(([id,m]) => ({id, name:m.name, records:m.records||{}, avatar:m.avatar??null, gender:m.gender||"", dormant:!!m.dormant}))
    .sort((a,b) => a.name.localeCompare(b.name,"ko"));
  // Auto-login: restore last member from localStorage
  if (S.view==="login" && !S.activeMemberId) {
    try {
      const saved = localStorage.getItem("mt_last_member");
      if (!saved || !members.find(m=>m.id===saved)) {
        S.profileModal = true;
      }
    } catch(e) {
      S.profileModal = true;
    }
  }
  render();
});

/* ── DB helpers ── */
const fbSet    = (path,val) => set(ref(db,path),val);
const fbUpdate = (path,val) => update(ref(db,path),val);
const fbRemove = (path)     => remove(ref(db,path));
const fbPush   = (path,val) => push(ref(db,path),val);

/* ── Icons ── */
const ico = {
  chevL: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1A1A2E" stroke-width="2.2" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>`,
  chevR: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B0B8C1" stroke-width="2" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>`,
  search:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B0B8C1" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>`,
  close: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8B95A1" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>`,
  edit:  `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8B95A1" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>`,
  trash: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F04452" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>`,
  plus:  `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`,
  drag:  `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B0B8C1" stroke-width="2" stroke-linecap="round"><path d="M9 5h6M9 12h6M9 19h6"/></svg>`,
};

const getMemberAvatar = (m) => m?.avatar != null ? AVATARS[m.avatar] : null;
const av = (name,size=38,active=false,avatarIdx=null) => {
  const src = avatarIdx != null ? AVATARS[avatarIdx] : null;
  if (src) return `<div class="avatar" style="width:${size}px;height:${size}px;background:#fff;border:2px solid ${active?"#3182F6":"#E8EBED"};overflow:hidden;padding:0"><img src="${src}" style="width:100%;height:100%;object-fit:cover"/></div>`;
  return `<div class="avatar" style="width:${size}px;height:${size}px;font-size:${Math.round(size*.38)}px;background:${active?"#3182F6":"#EBF3FE"};color:${active?"#fff":"#3182F6"}">${name[0]}</div>`;
};

function parseRecordVal(value, type) {
  if (!value) return -Infinity;
  if (type === "time") {
    const m = value.match(/(\d+)'(\d+)/);
    return m ? parseInt(m[1])*60 + parseInt(m[2]) : Infinity;
  }
  return parseFloat(value) || 0;
}

const SCALE_ORDER = {"RXD":0, "":0, "A":1, "B":2};

const lb = (wid, gender) => {
  const wod = WODS.find(w => w.id === wid);
  const type = wod?.type || "time";
  let pool = members.filter(m => !m.dormant);
  if (gender) pool = pool.filter(m => m.gender === gender);
  // All members in pool, those without record get score 100
  return pool.map(m => {
    const rec = m.records[wid];
    return {
      id: m.id,
      name: m.name,
      avatar: m.avatar,
      gender: m.gender,
      value: rec?.value || null,
      scale: rec?.scale || "",
      date: rec?.date || "",
      history: rec?.history || [],
    };
  }).sort((a, b) => {
    // No record = last
    if (!a.value && !b.value) return 0;
    if (!a.value) return 1;
    if (!b.value) return -1;
    // Scale order first: RXD > A > B
    const sa = SCALE_ORDER[a.scale] ?? 0;
    const sb = SCALE_ORDER[b.scale] ?? 0;
    if (sa !== sb) return sa - sb;
    // Same scale: sort by value
    const va = parseRecordVal(a.value, type);
    const vb = parseRecordVal(b.value, type);
    if (type === "time") return va - vb;
    return vb - va;
  });
};

// Calculate points for a ranked board
const calcPoints = (board) => {
  // board is already sorted
  const points = [];
  let i = 0;
  while (i < board.length) {
    if (!board[i].value) {
      // No record = 100 points
      points.push(100);
      i++;
      continue;
    }
    // Find all tied members at this position
    let j = i + 1;
    while (j < board.length && board[j].value &&
      board[j].scale === board[i].scale &&
      parseRecordVal(board[j].value, "x") === parseRecordVal(board[i].value, "x") &&
      board[j].value === board[i].value) {
      j++;
    }
    // Point = number of people ahead + 1
    const pt = i + 1;
    for (let k = i; k < j; k++) points.push(pt);
    i = j;
  }
  return points;
};


/* ── localStorage 최근 방문자 ── */
const LS_LAST = "mt_last_member";
function saveLastMember(id) { try { localStorage.setItem(LS_LAST, id); } catch {} }
function loadLastMember() { try { return localStorage.getItem(LS_LAST); } catch { return null; } }
function clearLastMember() { try { localStorage.removeItem(LS_LAST); } catch {} }

/* ── YOUTUBE ── */
function getYoutubeId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}
function renderYoutubeCard(url) {
  const id = getYoutubeId(url);
  if (!id) return "";
  const thumb = "https://img.youtube.com/vi/"+id+"/mqdefault.jpg";
  const link  = "https://youtu.be/"+id;
  return '<a href="'+link+'" target="_blank" rel="noopener" style="display:block;margin-top:10px;border-radius:12px;overflow:hidden;text-decoration:none;position:relative">'
    +'<img src="'+thumb+'" style="width:100%;display:block;border-radius:12px"/>'
    +'<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">'
    +'<div style="width:44px;height:44px;background:rgba(0,0,0,.65);border-radius:50%;display:flex;align-items:center;justify-content:center">'
    +'<svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><polygon points="5,3 19,12 5,21"/></svg>'
    +'</div></div></a>';
}

/* ══ RENDER ══ */
function render() {
  const root = document.getElementById("app");
  if      (S.view==="member")  root.innerHTML = renderMember();
  else if (S.view==="coach")   root.innerHTML = renderCoach();
  else if (S.view==="rank")    root.innerHTML = renderRank();
  else if (S.viewingMemberId)  root.innerHTML = renderMemberView();
  else                         root.innerHTML = renderLogin();
  bind();
}

/* ── Avatar grid helpers (separate fns to avoid nested template literals) ── */
function renderPickAvatarGrid(currentAvatar) {
  return AVATARS.map(function(src, i) {
    var border = currentAvatar === i ? "#3182F6" : "transparent";
    return '<button data-pick-avatar="' + i + '" style="position:relative;width:100%;aspect-ratio:1;border:3px solid ' + border + ';border-radius:14px;padding:0;cursor:pointer;overflow:hidden;background:#F2F4F6;box-sizing:border-box"><img src="' + src + '" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block"/></button>';
  }).join("");
}

function renderRegisterAvatarGrid() {
  return AVATARS.map(function(src, i) {
    var border = S.registerAvatar === i ? "#3182F6" : "transparent";
    return '<button data-reg-avatar="' + i + '" style="position:relative;width:100%;aspect-ratio:1;border:3px solid ' + border + ';border-radius:14px;padding:0;cursor:pointer;overflow:hidden;background:#F2F4F6;box-sizing:border-box"><img src="' + src + '" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block"/></button>';
  }).join("");
}

/* ── LOGIN ── */
function renderLogin() {
  const fil    = members.filter(m => m.name.includes(S.search));
  const hasAny = WODS.some(w => members.some(m => m.records[w.id]?.value));
  const rows = fil.length===0
    ? `<div class="empty-search">"${S.search}" 검색 결과가 없어요</div>`
    : `<div class="member-grid">${fil.map(m => {
        const hasDone = Object.keys(m.records).length > 0;
        const src = getMemberAvatar(m);
        return `<button class="member-cell" data-login="${m.id}">
          <div class="member-cell-av">
            ${src ? `<img src="${src}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>` : m.name[0]}
            ${hasDone?`<div class="member-cell-dot"></div>`:""}
          </div>
          <span class="member-cell-name">${m.name}</span></button>`;
      }).join("")}</div>`;
  return `
  <div class="login-page"><div class="login-scroll">

    <!-- ① 헤더 영역 : 로고 + 저장회원 + 인사말 + 코치한마디 -->
    <div style="padding:28px 20px 24px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
        <div class="login-logo">
          <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABCGlDQ1BJQ0MgUHJvZmlsZQAAeJxjYGA8wQAELAYMDLl5JUVB7k4KEZFRCuwPGBiBEAwSk4sLGHADoKpv1yBqL+viUYcLcKakFicD6Q9ArFIEtBxopAiQLZIOYWuA2EkQtg2IXV5SUAJkB4DYRSFBzkB2CpCtkY7ETkJiJxcUgdT3ANk2uTmlyQh3M/Ck5oUGA2kOIJZhKGYIYnBncAL5H6IkfxEDg8VXBgbmCQixpJkMDNtbGRgkbiHEVBYwMPC3MDBsO48QQ4RJQWJRIliIBYiZ0tIYGD4tZ2DgjWRgEL7AwMAVDQsIHG5TALvNnSEfCNMZchhSgSKeDHkMyQx6QJYRgwGDIYMZAKbWPz9HbOBQAAAQtklEQVR4nO2beXhcZb3HP+85Z5ZMtpkszdI0a5Nma2ja0hbsckEpKrWPggLaK+JVBGWrQIuIXBFaqoDYsqgooqKyXLwXkUXApYVCebrQJaRNkyZpkmZPk8kkM5PZznnvH2cyTZu0pNHnyR/29zznj5n3Pe/7O9/zW77v7zcjyq94SfJvLMp0KzDdcg6A6VZguuUcANOtwHTLOQCmW4HplnMATLcC0y3nAJhuBaZbzgEw3QpMt5wDYLoVmG75twdAO5vJQoAQYvyABENOva6iCAETLWtIJKAoEwxOUaSUjFV10gAIAeGwQShijBvTVAWbVWEqGAgh8AcjGIZECIEcs4jNoqKqAq8/bM495d7RmWLMZ3HK2Oj46GebRUXTREzXSQEgBEQikqx0BzkzHBjyxCaqEPQNBmjt9J608GREEYJASKei0InDrmEYEkURCCEQQEuXF68/zOLKdHO/U9YWY55WRj/LKAoKIGNPboKrKIKWTi/9niCaIpCTBUBRBL5AmG9dWcqVl+SPGz/W42fVLX8jHNFRhGAyGGiqYGAoxOoVuWxZtwhNFSe/QuDy27dizYzn+R+uGDc2Vbnmnu109vmxOCxIQ04uCOq6JNGhUVnkGvcWdEMyK8PBsvkZ+EYik/JXVRF4RyKUFzjZdNN81NF7xtwaDBnUNrlZviBz3NjZipTmNeAJ0tA2hM2ixlztIy1ACEEwpFMwM4GinESEgKZjw7yxo4OsdAerl+cgheCKj+fx6jvHxr19IaJBLiqGhLBu4LBrbFm/iKQECwB/39XF0Q4vFk1BUwVtPT4iuqSl08tzbx4lFDIQCghOxAnDkCAEisJ4p0eg6wZxNpXPXZSLzarS0DZMnzuAw6bFgvZHAqAICIV1SvKSsVlNg3nhrRY2PX2A9JQ4ygqdlOUncUFVOhVFTupbPMRFNxACQmGDQEhHIBACEuMt+EYiPH7nEkrzkwHY9kE3137/XYZ9YRTFjCMJDo1Eh4XfvtLIL/9Pj73JUSxH5wD4R3RkFIFRC1UVwZA/zEULM/lC1G1rjgwQDOnEx2lgLjmJGCBMM68scsY2OHR0kOwZ8QSCOq9tb6csvxy7VeXTS3M40DCAI05DkQLfSIRrVs1mxYIMwhGDxrZh7n1yH7d+qZzVK2YB0Nbt49sP78KVZOWx9YtxJtlQFcGPf38QtyfIE3ctiZqwmb4URaAbkvg4jZ+/WM+Bhn6evHsh8Q6NcMQwA6I0g144YlAwM4FRD6tr9pguejZpUBpgtahUznYBMDAU5GCTm7JCF75AhJe3tXLTVaXYrAqXLc3hyT/WE4lIVFWgqYL39vew/isVOOwaK5dAVlocn/rYTKSUhMKS2x/ZTXuPn1/fu5RVy3Ni+9756B4+viiLixZmTqjX7oP9bN/bzfmVaVy2bOZHvkfdkBxu8WC1nJyuzxgEhTD9Nc1po3hWEgAtHV5au3ysXJzJNZcVse/wANv2dCOA/OwEPjYvA9+ImbftNpW6o4PcuGknEV2i65LPXWz6oxCCB56u4fV327nz2rmsWp5DOGJgGJIDDW7ae3xUFLrwB3T6PUF0XZrjUtLa5ePGH76PPxihosiFYZhjvpEIg8Mhhnxh8/KG8XjDjAR1GlqH6Oj1YdXUk0jbGS1ACEEoFKGgJIUZKXbANH9dNygvdDK3OIWUZCvP/qWJSy/IRgi4/OI8/vJeu4m6LklNtvPXnR1sefYQt3+5gkBIx25VeebVJp74nzq+fFkRt36pDMOQRHTJ1+/bwcEmNwlxFn724mF+/LtaLr1wJhu+VY0wzOyw9qGd9LkDxMdZmFfiQlEE4Yjkuvt30NQ+TJxNiwVKCaiKeV9El5xKZD8CAAhHJGUFybEbd9Uex5VkIzcrgdRkKysWZLJtTzcNbUOU5CWxtHoGxblJtHR6sVlVJBJFCBLjzWg/ur/NoqLrkuLcJCyaaYj3/+IAb73fgSvJZmaCbi8zUuK44YoSDGmSpI1P1VDT6KasyEVjq4eyAicAXcf9HGgYIBQ2UJTgBKTJdMlT5cw8QIJQoLo0FTAjem3TILmZ8WSlxQFwxcV5eHxhXnn7GAKIs6lcsiSbkWAEq0VhwBNkzaeL+MblJRiGxGZVMQzJVZfmc8PnS3ng6Rr2N7h55Z1j/PbVRtJT7KjRQGfRFJ74zhJyMuJRhOCPf2/lsRfqWPeVKhLjNFKTbczKjDcts9mDbySCw65i0RSslpMvizYxkTgjALohSXRYKIumq/YePy2dw1TOdhFnU5ESPrE4m9L8ZF7e1oZvJALA6hWzcCXZGBwOsqAsjXuuq8KQEkPCs28cRWLm8O99vYrzSlK47r732PhUDYkOi3kmUMDjDfPdr1WxsNwE/2DzILc8uJOvfbaYq1fmsbeun7nFKcTZVAD21/cT0c1kOEp8Tr3OCgAhBKGwQVaag5wMBwCHWzwMDIViFhGOGCQ4NFYtm0Vtk5t39/UCUJqfzLw5KShCYcu6RTjsGooQ/OJ/G7h+ww5eeKsFRRHEx2lsvmMR7qEgHm8ITROoisDtCXHVynyu/cxspJR4vGG+cd8O8rIS2HTTAhpahzg+GOD8irSYvodbPFjO8ixyRgBGCdCcvCQcdjNU7G8YwKopzCtxxeZJ4HMX5xJn03hpa2vs+ysvKeDBtQvJz04ATKb3o9/UkJ+dwIanDlB31ANAVbGLu/7rPLz+CBZNYdgfYW6xix/cUB0lU4J1P9lNe6+fJ+++AJtVYfu+HlRFxLjJgCdEU/sw1jEU958GYJQAVZWkxL46UD9ARoqdwpxEAKwW8/aKQidLqzP4x+4u2nv9SOAzy3O4/OJcwCQ7tz+ym1Snnd/ev5yczASu37iDkaCOYUi+9tnZfHppDr0DAZITrPzkjkUkOEyrefT5Op5/8yi3fLGMqmIT+AMNbtJdJ/Q42jlM70DgX2sB0gCbVY1tOugN0dDmobTASWqyDTBjQiikIwR84ZJ8uo+P8OdtZjAMRwx0XTIS1Fn70C46+/xsunkB8+e4eOjWhbR0+rj/Fwdi1HfDjdVkpsVxz3VVzMkzOcffd3Wx+Q+HSHfZOb88DSlh2B+h7uggpQXJpLtMPWobBxkJ6lMqnEwIwCgBSkmyUTjTNOGmY8N09PqZX5Yam7f52UO0dHqRwCcWZVGcl8SftrYSChsIIVBVwaana/jrzk7uvHYul16QjQRSEq1kpcXxzGuNvLq9HSEg3WXntUc/wWcvMq3mWLeP7z6+F1UROBOt5GcnIAQcaRuircvLvJLU2CGrttFt0t0pFGROA4AZAAtmJpDuMgnQ/voBgmGdqiglDoZ03tnbzdbdJgt0JVlZvTyXPXX9vF/Ti6YKnn/zKI8+V8dVKwtYu6Ycw5AEgzq3PrSTvoERnIlW7nrsA5o7vEgJmalmag1HDG57ZDd97gBCQG5WAtkzzLGDTW4CYYPqUtM1IxGD+lYPFsvUKlKntYBQWGfubFfMrGqOuEmKt1ISNc/mDi/HBwO8sv0YgZCOlHDZshxURfD6ux0cavZw9xN7mVvs4ke3LECJVmTufXI/uw72kZxoYySgk5sZT1K8JRa8BOa8nIx4kCb3qCxyoqmmqvsOD5AUb4kRoLYev0m6LOqU6pITxwBpnuErCs1NgiGDmiNuCmcmxIjHh0fc6AY0tA6x51A/QkD1nBSWz8/gjR0dXL9xBwCPf2cJqU4bQsBzbxzlD683k+a0EwhGomlwMWlOG4oi2Lqnm5GgWVT5/jfOIy87gUBIZ1FlOoY0zxKHmk0iljPDTM31LR483vCELG/KAOiGJMGhUVowSoB8NHecIEBgPrgAIrrBy9vaAFBVweUX5+EeCtLS6eWBmxZwXjSI7j08wA+e3E9SggVDSvwBnQduXkBxrhnJt+/r4ervvM2f32lHAM5EK/d/sxrdkHx4xI0iBJ19fhqPDZl62E09DjYNohvGlCtG4wAY9f/sdEcshx9u8eAZPkGApIS6o4MoCjjsGv/Y1UXX8REk8MkLZ2KzqlyzajZXrcxHSkm/J8htP95FRDewWlT6B4Pc8IU5rFqWgwRau8w0qSqCB3/zYSwmLK2ewa1fLOfh39VS2zhIV/8Ive4A80f1wCxyWLSp+f+EAMQIUH7ySQRIUwUVUb/rHRjhyLEhrBYVTVXoGQjwt52dCCDVaeMH36zmzmsrzZIVgvWb99DcPkxSgpUBT4D/WJjJumvM8UjE4PZHdtM7EGD9V6sY8oW556f7YnT5ji9XUFHo5M5H9/D6ux3YrWqMAA0OjRIg5awJ0GkBGCVAc2efIEAfHnGTleageEwA7PcEsagKhpRYLQp/fvsYevRc/qVPFpj0VxFsea6ON3d0kOq04fWHmTkjnofXno+qmMHuh7+u5Y0d7axdU8HaL5by1dXFvLytlV+9dARFEdhtKlvWLaa+dYgX3mqmcGZiLBA3tY8SoH+hBUgJFk2lNN/cpM8d4GDzIKX5yTEC9OERN8FokdIwJA67xr7D/RxsGowdbTVV8Ob7nWx59iCuZFus2PHwbeeTlR6HEPDS1jYe+X0tV64s4KarSolEDG65upQlVTPY+KsDHGhwAzC/LIWbry6jp3+Ekrxk0pxmaq5v9RAITq4SPSkAzPO/WQGak2cGwLYuH33uAJXFrlhNoLbJfVIlVkSt5rHn63j9vQ5ee7edF//Wyn//dB9WTUFVBIPDIdZ9ZS4XVplNjsMtHtZv3kNlkYsHb10Ys4jEeAsbb5xPKGzwvSf2EgiZdPmbn59DVXEKWWlxMT1qjrgnbtWdhZxUEDFL4BHmzUkhM3re333oOD3HR2J+F4iWl8bW1oxokXLbnm7efL/DLF0jibdrxNk1+geDrF6Ry/VXlCClpL3Xz5q732EkGOHR9WYalBIiusQiBIsr0/j2mgru++V+fvZiPd9eU45VEWy6eQEebwiAUMSgttFt6jG+WzdVAMwWWGmeWQEyDMn80lR+fveFLJ+fAcCxHh/tvb5xxENKsFvVWJo0F4Rhf5g5+clsuHG+WdURgiFvmDWfKuL88tQYo9tZ28fDzxzkDxuXYdEUbrq6lLf3dvPwM7Usq85gYXkqF0StB6Dn+AjtPf5/KgDCaYLgedEToJSwqDKN6z9fQrrLjgTqW4YY8oVPdHPGiCElumFehpSEwgZWTWHzHYtISbLGXKaiyMlt/1nOsvkZZsdmKMQ9P93H1t1dbH62DkURxNlUNnyrGlUR3PXYB3j9ZgM1FDaQRFOzN4SqKlM5AkwMgK5LkuItsRK4qp54MClNrvFhoxvDYFLEQ9clG25cQOVsZ6ymFwMr2vqO6AZ3P/4B9S0eZmXG89SfGni/pg+AeXNS+N518/ig7jgPPVOLogg0zWyc1jS6iejGuCLn2YoY+4cJKc3oXTQrCVUBwzjRiRHC7Oy0dfsY8oZQlTM3QaU06wVlBU5CYT0WL8SYvoSmCvwBnfpWD3aLWUANRyTJCRbysxNjpl3XPIhuSMoKR88EZml8MnqcFQBgKhcM6qdd1GpRYq3ljxIpYSQYOX2klqAoZv9gLEC6LgmGor0rAXE2DSHAH9Bj/W+rdfJ6nEnGlcUFJr09nYmf+guLM4kQkOCwnHnSKb8ukdI8U8SP3idPuGB8nDZm3uT1OJNM2BcwpJxScWHCtYyzX2i0F/ivWOuj5N/+R1LnAJhuBaZbzgEw3QpMt5wDYLoVmG45B8B0KzDdcg6A6VZguuX/AUNNhdtn0huEAAAAAElFTkSuQmCC" width="28" height="28" style="border-radius:6px;flex-shrink:0"/>
          MoveTogther
        </div>
        ${(() => {
          try {
            // 코치 로그인 상태면 코치 배지 표시
            if (localStorage.getItem("mt_coach_logged")==="1") {
              return '<button id="btn-open-coach-from-header" style="display:flex;align-items:center;gap:6px;background:#1A1A2E;border:none;border-radius:99px;padding:7px 14px;height:36px;cursor:pointer;font-size:13px;font-weight:700;color:#fff">🏋️ 코치</button>';
            }
            const saved = localStorage.getItem("mt_last_member");
            const savedMember = saved && members.find(m=>m.id===saved);
            if (!savedMember) return '<button id="btn-show-profile-modal" style="display:flex;align-items:center;gap:6px;background:#F2F4F6;border:none;border-radius:99px;padding:7px 14px;height:36px;cursor:pointer;font-size:13px;font-weight:600;color:#8B95A1">프로필 설정</button>';
            const src = getMemberAvatar(savedMember);
            const avHtml = src
              ? '<img src="'+src+'" style="width:28px;height:28px;border-radius:50%;object-fit:cover"/>'
              : '<div style="width:28px;height:28px;border-radius:50%;background:#F2F4F6;color:#3182F6;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center">'+savedMember.name[0]+'</div>';
            return '<button id="btn-header-profile" data-login="'+savedMember.id+'" style="display:flex;align-items:center;gap:7px;background:#F2F4F6;border:none;border-radius:99px;padding:5px 12px 5px 5px;height:38px;cursor:pointer">'
              +avHtml+'<span style="font-size:14px;font-weight:700;color:#1A1A2E">'+savedMember.name+'</span></button>';
          } catch(e) { return ""; }
        })()}
      </div>
      <div class="login-greeting"><span>무브투게더</span> 회원님의<br>오늘의 기록은?</div>
      ${coachMessage ? `<p style="font-size:14px;color:#8B95A1;margin-top:8px;line-height:1.6">${coachMessage}</p>` : ""}
    </div>

    <!-- ② 벤치마크 Day 카드 -->
    ${(() => {
      const tKey = todayKey();
      const td = todayWod && todayWod[tKey];
      const bdWod = td ? WODS.find(w=>w.id===parseInt(td.wodId)) : null;
      if (!bdWod) return "";
      let hasSaved=false;
      try{const sv=localStorage.getItem("mt_last_member");hasSaved=!!(sv&&members.find(function(m){return m.id===sv;}));}catch(e){}
      const bdActionText=hasSaved?"탭해서 기록하기 →":"프로필 설정 후 기록하기 →";
      return '<div style="margin-bottom:24px">'
        +'<div style="background:linear-gradient(135deg,#3182F6,#60A5FA);padding:20px;cursor:pointer" id="btn-login-bmday">'
        +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">'
        +'<span style="font-size:12px;font-weight:800;color:rgba(255,255,255,.8);letter-spacing:.6px">🎯 벤치마크 Day</span>'
        +'</div>'
        +'<p style="font-size:18px;font-weight:800;color:#fff;letter-spacing:-.4px">'+(bdWod.name)+'</p>'
        +(bdWod.detail?'<p style="font-size:14px;color:rgba(255,255,255,.8);margin-top:4px">'+(bdWod.detail)+'</p>':'')
        +(td.note?'<p style="font-size:13px;color:rgba(255,255,255,.75);margin-top:10px;background:rgba(0,0,0,.12);border-radius:8px;padding:8px 12px">'+(td.note)+'</p>':'')
        +'</div></div>';
    })()}

    <!-- ③ 전체 회원 보기 버튼 -->
    <div style="padding:0 20px 8px">
      <button id="btn-all-members" style="width:100%;height:52px;background:#F2F4F6;border:none;border-radius:14px;font-size:16px;font-weight:700;color:#1A1A2E;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        전체 회원 보기
      </button>
    </div>

    <!-- ④ 액션 카드 (순위 / MVP) -->
    <div class="login-actions" style="padding:8px 20px 24px">
      ${hasAny ? `<button class="action-card" id="btn-rank">
        <div class="action-card-icon">🏆</div>
        <div class="action-card-title">순위 보기</div>
        <div class="action-card-sub">세션별 1등 기록</div></button>` : `<div></div>`}
      ${(() => {
        const now = new Date();
        const day = now.getDay();
        const mondayOffset = day === 0 ? -6 : 1 - day;
        const monday = new Date(now);
        monday.setHours(0,0,0,0);
        monday.setDate(now.getDate() + mondayOffset);
        const mondayTs = monday.getTime();
        const scores = members.map(m => {
          const count = Object.values(m.records).filter(r => {
            if (!r.date) return false;
            const [mo, dd] = r.date.split('/').map(Number);
            const d = new Date(now.getFullYear(), mo-1, dd);
            return d.getTime() >= mondayTs;
          }).length;
          return { name: m.name, count };
        }).filter(x => x.count > 0).sort((a,b) => b.count - a.count);
        const mvp = scores[0];
        if (!mvp) return '<div class="action-card" style="cursor:default">'
          +'<div class="action-card-icon">🌟</div>'
          +'<div class="action-card-title">이번 주 MVP</div>'
          +'<div class="action-card-sub">아직 기록이 없어요</div>'
          +'</div>';
        return '<div class="action-card" style="cursor:default;position:relative;overflow:hidden">'
          +'<div style="position:absolute;top:10px;right:12px;background:#EBF3FE;color:#3182F6;font-size:12px;font-weight:700;padding:3px 9px;border-radius:99px">MVP</div>'
          +'<div class="action-card-icon">👑</div>'
          +'<div class="action-card-title">'+mvp.name+'</div>'
          +'<div class="action-card-sub">이번 주 <strong style="color:#3182F6">'+mvp.count+'개</strong> 기록</div>'
          +'</div>';
      })()}
    </div>

    <!-- ⑤ 코치 로그인 -->
    <div style="padding:0 20px 40px">
      <button id="btn-open-pin" style="width:100%;height:48px;background:none;border:1.5px solid #E8EBED;border-radius:14px;font-size:14px;font-weight:600;color:#B0B8C1;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;line-height:1">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        코치 로그인
      </button>
    </div>

  </div></div>
  ${S.profileModal ? renderProfileModal() : ""}
  ${S.allMembersModal ? renderAllMembersModal() : ""}
  ${S.bdRecordModal ? renderBdRecordModal() : ""}
  ${S.registerModal ? `
  <div class="modal-overlay" id="mo-register">
    <div class="modal-box" onclick="event.stopPropagation()" style="padding:22px 18px 18px;width:calc(100% - 40px);max-width:340px">
      ${S.registerStep===1 ? `
        <!-- Step 1: 이름 입력 -->
        <div class="modal-title" style="margin-bottom:6px">처음 오셨나요? 👋</div>
        <div style="font-size:13px;color:#8B95A1;margin-bottom:16px">이름을 입력해주세요</div>
        <input class="modal-input" id="inp-register-name" placeholder="이름 입력" value="${S.registerName}" autocomplete="off"/>
        ${S.registerErr ? `<div class="err-msg" style="text-align:left;margin-top:6px">${S.registerErr}</div>` : ""}
        <div style="display:flex;gap:8px;margin-top:14px">
          <button class="modal-btn-cancel" id="btn-register-cancel" style="flex:1;height:48px">취소</button>
          <button class="modal-btn-save" id="btn-register-next" style="flex:2;height:48px">다음 →</button>
        </div>
      ` : `
        <!-- Step 2: 캐릭터 선택 -->
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
          <button id="btn-register-back" style="background:none;border:none;cursor:pointer;font-size:18px;padding:0;line-height:1">←</button>
          <div class="modal-title" style="margin:0">캐릭터 선택</div>
          <div style="font-size:12px;color:#8B95A1;margin-left:auto">선택 안 해도 됩니다</div>
        </div>
        <div style="overflow-y:auto;max-height:340px">
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">
            ${renderRegisterAvatarGrid()}
          </div>
        </div>
        <button class="modal-btn-save" id="btn-register-save" style="width:100%;height:48px;margin-top:14px;border-radius:12px">
          ${S.registerName} 으로 시작하기 🎉
        </button>
      `}
    </div>
  </div>` : ""}
  ${S.pinModal ? `<div class="pin-modal-overlay" id="pin-overlay">
    <div class="pin-modal-box" onclick="event.stopPropagation()">
      <div class="pin-modal-title">코치 로그인</div>
      <div class="pin-modal-sub">PIN 번호를 입력해주세요</div>
      <input id="inp-pin" type="password" inputmode="numeric" pattern="[0-9]*" class="pin-input${S.pinErr?" err":""}"
        placeholder="••••" maxlength="4" value="${S.pin}" autocomplete="off"/>
      ${S.pinErr ? `<div class="err-msg">PIN이 올바르지 않아요</div>` : ""}
      <button class="pin-confirm-btn" id="btn-pin">확인</button>
    </div></div>` : ""}
  </div>`;
}


/* ── ALL MEMBERS MODAL ── */
function renderAllMembersModal() {
  const rows = members.map(function(m) {
    const src = getMemberAvatar(m);
    const done = Object.keys(m.records).length;
    const pct  = Math.round(done / WODS.length * 100);
    const avHtml = src
      ? '<img src="'+src+'" style="width:44px;height:44px;border-radius:50%;object-fit:cover"/>'
      : '<div style="width:44px;height:44px;border-radius:50%;background:#F2F4F6;color:#3182F6;font-size:17px;font-weight:800;display:flex;align-items:center;justify-content:center">'+m.name[0]+'</div>';
    return '<button data-view-member="'+m.id+'" style="display:flex;align-items:center;gap:12px;width:100%;background:none;border:none;border-bottom:1px solid #F2F4F6;padding:14px 0;cursor:pointer;-webkit-tap-highlight-color:transparent">'
      +'<div style="flex-shrink:0">'+avHtml+'</div>'
      +'<div style="flex:1;min-width:0;text-align:left">'
      +'<p style="font-size:16px;font-weight:700;color:#1A1A2E">'+m.name+'</p>'
      +'<p style="font-size:12px;color:#8B95A1;margin-top:2px">'+done+'/'+WODS.length+' 완료 · '+pct+'%</p>'
      +'</div>'
      +'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B0B8C1" stroke-width="2" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>'
      +'</button>';
  }).join('');

  return '<div style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:100;display:flex;align-items:flex-end;justify-content:center" id="all-members-overlay">'
    +'<div style="background:#fff;border-radius:20px 20px 0 0;width:100%;max-width:480px;max-height:80vh;display:flex;flex-direction:column;padding-bottom:env(safe-area-inset-bottom)">'
    +'<div style="display:flex;align-items:center;justify-content:space-between;padding:20px 20px 12px;flex-shrink:0">'
    +'<p style="font-size:18px;font-weight:800;color:#1A1A2E">전체 회원</p>'
    +'<button id="btn-all-members-close" style="background:none;border:none;cursor:pointer;padding:6px;color:#8B95A1">'+ico.close+'</button>'
    +'</div>'
    +'<div style="overflow-y:auto;padding:0 20px 20px">'+rows+'</div>'
    +'</div></div>';
}

/* ── MEMBER VIEW (read-only) ── */
function renderMemberView() {
  const m = members.find(function(x){return x.id===S.viewingMemberId;});
  if (!m) { S.viewingMemberId=null; S.view="login"; render(); return ""; }
  const done = Object.keys(m.records).length;
  const pct  = Math.round(done/WODS.length*100);
  let lastGroup = null;

  const wodRows = WODS.map(function(wod) {
    const g = wod.group||"WOD";
    const GL = {STRENGTH:"💪 STRENGTH", HYROX:"🏃 HYROX", WOD:"🔥 WOD"};
    let gh = "";
    if (g !== lastGroup) {
      gh = '<div style="padding:16px 16px 8px;font-size:12px;font-weight:800;color:#8B95A1;letter-spacing:.8px;background:#F2F4F6">'+(GL[g]||g)+'</div>';
      lastGroup = g;
    }
    const rec = m.records[wod.id];
    const recHtml = rec
      ? '<span style="font-size:18px;font-weight:800;color:#1A1A2E;display:block;margin-top:8px">'+rec.value+'</span>'
        +(rec.scale?'<span style="font-size:12px;color:#8B95A1;margin-top:4px;display:block">'+rec.scale+'</span>':'')
        +'<span style="font-size:12px;color:#B0B8C1;margin-top:2px;display:block">'+rec.date+'</span>'
      : '<span style="font-size:13px;color:#B0B8C1;margin-top:8px;display:block">기록 없음</span>';

    return gh+'<div class="wod-row'+(rec?" done":"")+'">'
      +'<div class="wod-badge'+(rec?" done":"")+'">'+wod.id+'</div>'
      +'<div class="wod-content">'
      +'<p class="wod-name">'+wod.name+'</p>'
      +(wod.detail?'<p class="wod-detail">'+wod.detail+'</p>':'')
      +recHtml+'</div></div>';
  }).join('');

  return '<div class="screen">'
    +'<div class="nav">'
    +'<button class="nav-back icon-btn" id="btn-member-view-back">'+ico.chevL+'</button>'
    +'<div style="display:flex;align-items:center;gap:8px;flex:1">'
    +(getMemberAvatar(m)?'<img src="'+getMemberAvatar(m)+'" style="width:28px;height:28px;border-radius:50%;object-fit:cover"/>':'')
    +'<span style="font-size:18px;font-weight:800;color:#1A1A2E">'+m.name+'</span>'
    +'</div>'
    +'<span style="font-size:14px;font-weight:700;color:#3182F6;background:#EBF3FE;padding:4px 12px;border-radius:99px">'+pct+'%</span>'
    +'</div>'
    +'<div style="padding:10px 16px;background:#fff;border-bottom:1px solid #E8EBED;display:flex;align-items:center;gap:10px;flex-shrink:0">'
    +'<div class="progress-track" style="flex:1"><div class="progress-fill" style="width:'+pct+'%;background:#3182F6"></div></div>'
    +'<span style="font-size:12px;color:#8B95A1;font-weight:600">'+done+'/'+WODS.length+'</span>'
    +'</div>'
    +'<div class="scroll">'+wodRows+'<div style="height:24px"></div></div>'
    +'</div>';
}


/* ── BENCHMARK DAY RECORD MODAL ── */
function renderBdRecordModal() {
  const tKey = todayKey();
  const td = todayWod && todayWod[tKey];
  const wid = td ? parseInt(td.wodId) : null;
  const wod = wid ? WODS.find(w=>w.id===wid) : null;
  if (!wod) return "";

  const mid = S.activeMemberId;
  const m = members.find(x=>x.id===mid);
  if (!m) return "";
  const rec = m.records[wid]||{};
  const wtype = wod.type||"time";

  let inputHtml = "";
  if (wtype==="time") {
    inputHtml = '<div class="time-input-row">'
      +'<div class="time-field-wrap"><input class="time-field" id="inp-bd-min" type="text" inputmode="numeric" pattern="[0-9]*" placeholder="0" value="'+S.timeVal.min+'"/><span class="time-field-label">분</span></div>'
      +'<span class="time-sep">:</span>'
      +'<div class="time-field-wrap"><input class="time-field" id="inp-bd-sec" type="text" inputmode="numeric" pattern="[0-9]*" placeholder="00" value="'+S.timeVal.sec+'"/><span class="time-field-label">초</span></div>'
      +'</div>';
  } else if (wtype==="weight") {
    const prev = S.editVal.value ? parseFloat(S.editVal.value)||"" : "";
    inputHtml = '<div class="time-input-row"><div class="time-field-wrap" style="flex:2"><input class="time-field" id="inp-bd-weight" type="text" inputmode="decimal" pattern="[0-9.]*" placeholder="0" value="'+prev+'"/><span class="time-field-label">kg</span></div></div>';
  } else if (wtype==="rounds") {
    const rMatchBd = S.editVal.value ? S.editVal.value.match(/^(\d+)R\+(\d+)$/) : null;
    const rValBd = rMatchBd ? rMatchBd[1] : (S.editVal.value ? S.editVal.value.replace(/R.*/,"") : "");
    const repValBd = rMatchBd ? rMatchBd[2] : "";
    inputHtml = '<div class="time-input-row">'
      +'<div class="time-field-wrap"><input class="time-field" id="inp-bd-rounds" type="text" inputmode="numeric" pattern="[0-9]*" placeholder="0" value="'+rValBd+'"/><span class="time-field-label">라운드</span></div>'
      +'<span class="time-sep">+</span>'
      +'<div class="time-field-wrap"><input class="time-field" id="inp-bd-reps-extra" type="text" inputmode="numeric" pattern="[0-9]*" placeholder="0" value="'+repValBd+'"/><span class="time-field-label">렙</span></div>'
      +'</div>';
  } else {
    const prev = S.editVal.value ? parseFloat(S.editVal.value)||"" : "";
    inputHtml = '<div class="time-input-row"><div class="time-field-wrap" style="flex:2"><input class="time-field" id="inp-bd-reps" type="text" inputmode="numeric" pattern="[0-9]*" placeholder="0" value="'+prev+'"/><span class="time-field-label">횟수</span></div></div>';
  }

  return '<div style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:200;display:flex;align-items:flex-end;justify-content:center" id="bd-record-overlay">'
    +'<div style="background:#fff;border-radius:20px 20px 0 0;width:100%;max-width:480px;padding:24px 20px calc(24px + env(safe-area-inset-bottom))">'
    +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">'
    +'<div>'
    +'<p style="font-size:12px;font-weight:700;color:#3182F6;letter-spacing:.4px;margin-bottom:4px">🎯 벤치마크 Day</p>'
    +'<p style="font-size:20px;font-weight:800;color:#1A1A2E;letter-spacing:-.4px">'+wod.name+'</p>'
    +(wod.detail?'<p style="font-size:13px;color:#8B95A1;margin-top:3px">'+wod.detail+'</p>':'')
    +'</div>'
    +'<button id="btn-bd-modal-close" style="background:none;border:none;cursor:pointer;padding:6px;color:#8B95A1">'+ico.close+'</button>'
    +'</div>'
    +(rec.value?'<p style="font-size:13px;color:#8B95A1;margin-bottom:14px;margin-top:4px">이전 기록: <strong style="color:#1A1A2E">'+rec.value+'</strong></p>':'<div style="height:14px"></div>')
    +inputHtml
    +'<div style="display:flex;gap:6px;margin-top:10px">'
    +['RXD','A','B'].map(function(s){
      var active=S.editVal.scale===s;
      return '<button data-bd-scale-btn="'+s+'" style="flex:1;height:36px;border-radius:10px;border:2px solid '+(active?'#3182F6':'#E8EBED')+';background:'+(active?'#EBF3FE':'#F2F4F6')+';color:'+(active?'#3182F6':'#8B95A1')+';font-size:13px;font-weight:700;cursor:pointer">'+s+'</button>';
    }).join('')
    +'</div>'
    +'<button id="btn-bd-save" data-save="'+mid+'" data-wid="'+wid+'" data-wtype="'+wtype+'" style="width:100%;height:52px;background:#3182F6;border:none;border-radius:14px;font-size:16px;font-weight:700;color:#fff;cursor:pointer;margin-top:12px">저장</button>'
    +'</div></div>';
}

/* ── RANK ── */
function renderRank() {
  const GENDERS = [{key:"male",label:"남성 👨"},{key:"female",label:"여성 👩"}];
  const medals = ["🥇","🥈","🥉"];

  // Per-WOD points per gender per member: {memberId: points}
  const allPoints = {}; // {memberId: totalPoints}
  members.filter(m=>!m.dormant).forEach(m=>{ allPoints[m.id]=0; });

  const renderGenderBoard = (wod, gender) => {
    const board = lb(wod.id, gender);
    if (board.length === 0) return "";
    const points = calcPoints(board);
    // Accumulate total points
    board.forEach((r,i) => { if(allPoints[r.id]!==undefined) allPoints[r.id] += points[i]; });

    const rows = board.map((r,i) => {
      const src = r.avatar!=null ? AVATARS[r.avatar] : null;
      const avHtml = src
        ? '<img src="'+src+'" style="width:28px;height:28px;border-radius:50%;object-fit:cover;flex-shrink:0"/>'
        : '<div style="width:28px;height:28px;border-radius:50%;background:#F2F4F6;color:#3182F6;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0">'+r.name[0]+'</div>';
      const medal = i < 3 && r.value ? medals[i] : '';
      const scaleChip = r.scale && r.scale!=="RXD" ? '<span style="font-size:10px;font-weight:700;color:#8B95A1;background:#F2F4F6;padding:2px 6px;border-radius:99px">'+r.scale+'</span>' : (r.scale==="RXD"?'<span style="font-size:10px;font-weight:700;color:#3182F6;background:#EBF3FE;padding:2px 6px;border-radius:99px">RXD</span>':'');
      return '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #F8F9FA">'
        +'<span style="font-size:14px;width:24px;text-align:center;flex-shrink:0">'+(medal||('<span style="font-size:12px;color:#B0B8C1">'+(i+1)+'</span>'))+'</span>'
        +avHtml
        +'<div style="flex:1;min-width:0">'
        +'<p style="font-size:14px;font-weight:700;color:#1A1A2E">'+r.name+'</p>'
        +(r.value?'<div style="display:flex;align-items:center;gap:6px;margin-top:2px"><span style="font-size:13px;font-weight:800;color:#3182F6">'+r.value+'</span>'+scaleChip+'</div>':'<p style="font-size:12px;color:#B0B8C1">미측정</p>')
        +'</div>'
        +'<span style="font-size:12px;font-weight:700;color:#8B95A1;flex-shrink:0">'+points[i]+'점</span>'
        +'</div>';
    }).join('');

    return '<div style="margin-bottom:8px">'
      +'<p style="font-size:11px;font-weight:800;color:#8B95A1;letter-spacing:.5px;padding:8px 0 4px">'+(gender==="male"?"남성":"여성")+'</p>'
      +rows+'</div>';
  };

  const wodCards = WODS.map(wod => {
    const mBoard = renderGenderBoard(wod, "male");
    const fBoard = renderGenderBoard(wod, "female");
    if (!mBoard && !fBoard) return '<div class="rank-row-card"><span class="rank-row-wod-name">'+wod.name+'</span><p style="font-size:13px;color:#B0B8C1;padding:8px 0">기록 없음</p></div>';
    return '<div class="rank-row-card">'
      +'<p style="font-size:16px;font-weight:800;color:#1A1A2E;margin-bottom:4px">'+wod.name+'</p>'
      +(wod.detail?'<p style="font-size:12px;color:#8B95A1;margin-bottom:8px">'+wod.detail+'</p>':'<div style="margin-bottom:8px"></div>')
      +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'
      +(mBoard||'<div></div>')+(fBoard||'<div></div>')
      +'</div>'
      +'</div>';
  }).join('');

  // Total ranking per gender
  const renderTotalRank = (gender) => {
    const pool = members.filter(m=>!m.dormant && m.gender===gender);
    if (pool.length===0) return "";
    const sorted = pool.map(m=>({...m, total:allPoints[m.id]||0})).sort((a,b)=>a.total-b.total);
    const rows = sorted.map((m,i)=>{
      const src = m.avatar!=null ? AVATARS[m.avatar] : null;
      const avHtml = src
        ? '<img src="'+src+'" style="width:28px;height:28px;border-radius:50%;object-fit:cover;flex-shrink:0"/>'
        : '<div style="width:28px;height:28px;border-radius:50%;background:#F2F4F6;color:#3182F6;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0">'+m.name[0]+'</div>';
      const medal = i<3?medals[i]:'';
      return '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #F8F9FA">'
        +'<span style="font-size:14px;width:24px;text-align:center;flex-shrink:0">'+(medal||'<span style="font-size:12px;color:#B0B8C1">'+(i+1)+'</span>')+'</span>'
        +avHtml
        +'<p style="flex:1;font-size:14px;font-weight:700;color:#1A1A2E">'+m.name+'</p>'
        +'<span style="font-size:13px;font-weight:800;color:#3182F6;flex-shrink:0">'+m.total+'점</span>'
        +'</div>';
    }).join('');
    return '<div style="margin-bottom:8px">'
      +'<p style="font-size:11px;font-weight:800;color:#8B95A1;letter-spacing:.5px;padding:8px 0 4px">'+(gender==="male"?"남성":"여성")+'</p>'
      +rows+'</div>';
  };

  // Note: allPoints is accumulated during wodCards rendering above
  // So total rank must come after
  const totalSection = '<div class="rank-row-card">'
    +'<p style="font-size:16px;font-weight:800;color:#1A1A2E;margin-bottom:4px">🏆 종합 순위</p>'
    +'<p style="font-size:12px;color:#8B95A1;margin-bottom:10px">낮을수록 높은 등수 · 미측정 100점</p>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'
    +(renderTotalRank("male")||'<div></div>')+(renderTotalRank("female")||'<div></div>')
    +'</div>'
    +'</div>';

  return `<div class="rank-page">
    <div class="rank-page-nav">
      <button class="nav-back icon-btn" id="btn-rank-back">${ico.chevL}</button>
      <span class="nav-title" style="flex:1;font-size:18px;font-weight:700">순위</span>
      <div style="width:32px"></div>
    </div>
    <div class="rank-page-body">
      ${totalSection}
      ${wodCards}
    </div>
  </div>`;
}

/* ── MEMBER ── */
function renderMember() {
  const m = members.find(x => x.id===S.activeMemberId);
  if (!m) { S.view="login"; return renderLogin(); }
  const done = Object.keys(m.records).length;
  const pct  = Math.round(done/WODS.length*100);
  const wodRows = renderWodListWithGroups(WODS, m, false);
  const rankRows = WODS.map(wod => {
    const board=lb(wod.id); const first=board[0]||null;
    const myIdx=board.findIndex(r=>r.name===m.name); const myRec=m.records[wod.id];
    return `<div class="my-rank-card">
      <div class="my-rank-top"><span class="my-rank-wod-num">WOD ${wod.id}</span><span class="my-rank-wod-name">${wod.name}</span></div>
      ${first ? `<div class="my-rank-first"><span class="my-rank-medal">🥇</span>
        <div class="my-rank-info"><div class="my-rank-first-name">${first.name}</div><div class="my-rank-first-val">${first.value}</div></div>
        ${first.scale?`<span class="pill-blue">${first.scale}</span>`:""}
        </div>
        ${myRec ? `<div class="my-rank-my-row"><span class="my-rank-label">내 기록</span><span class="my-rank-val">${myRec.value}</span>
          ${myIdx===0?`<span class="my-rank-top-badge">1위 🎉</span>`:`<span class="my-rank-pos">${myIdx+1}위</span>`}</div>`
          : `<div class="my-rank-no-rec">아직 기록이 없어요</div>`}`
      : `<div class="my-rank-empty">기록 없음</div>`}
    </div>`;
  }).join("");
  // avatar modal
  const avatarModalHtml = S.avatarModal===m.id ? `
  <div class="modal-overlay" id="mo-avatar">
    <div class="modal-box" onclick="event.stopPropagation()" style="padding:18px;width:calc(100% - 40px);max-width:320px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <div class="modal-title">캐릭터 선택</div>
        ${m.avatar!=null?`<button id="btn-avatar-reset" style="background:none;border:none;font-size:14px;font-weight:600;color:#F04452;cursor:pointer;min-height:44px;padding:0 12px;padding:4px 0">초기화</button>`:""}
      </div>
      <div style="overflow-y:auto;max-height:380px;margin:0 -2px">
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:2px">
          ${renderPickAvatarGrid(m.avatar)}
        </div>
      </div>
      <button class="btn-cancel" id="btn-avatar-cancel" style="width:auto;align-self:center;height:36px;padding:0 24px;margin-top:10px;border-radius:99px;display:block;margin-left:auto;margin-right:auto;font-size:14px">취소</button>
    </div>
  </div>` : "";

  const src = getMemberAvatar(m);
  return `<div style="min-height:100vh;background:#F2F4F6">
    <div class="nav">
      <button class="nav-back icon-btn" id="btn-member-back">${ico.chevL}</button>
      <button id="btn-pick-avatar" style="background:none;border:none;cursor:pointer;padding:6px;display:flex;align-items:center;min-height:32px;gap:6px;border-radius:10px">
        ${src ? `<img src="${src}" style="width:30px;height:30px;border-radius:50%;object-fit:cover;border:2px solid #E8EBED"/>` : `<div style="width:30px;height:30px;border-radius:50%;background:#EBF3FE;color:#3182F6;font-size:14px;font-weight:800;display:flex;align-items:center;justify-content:center">${m.name[0]}</div>`}
        <span style="font-size:16px;font-weight:700;color:#1A1A2E">${m.name}</span>
      </button>
      <div style="flex:1"></div>
      <span style="font-size:14px;font-weight:700;color:#3182F6;background:#EBF3FE;padding:4px 10px;border-radius:99px">${pct}%</span>
      <div style="width:8px"></div>
      <div class="tab-group">
        <button class="tab-btn${S.memberTab==="my"?" active":""}" data-mtab="my">내 기록</button>
        <button class="tab-btn${S.memberTab==="rank"?" active":""}" data-mtab="rank">1등</button>
      </div>
    </div>
    ${avatarModalHtml}
    ${S.memberTab==="my" ? `
      <div style="background:#fff;border-bottom:1px solid #E8EBED">
        <div style="display:flex">
          <button data-memberhistview="list" style="flex:1;height:44px;border:none;border-bottom:2px solid ${(S.histView[m.id]||'list')==='list'?'#3182F6':'transparent'};background:transparent;font-size:16px;font-weight:700;color:${(S.histView[m.id]||'list')==='list'?'#3182F6':'#8B95A1'};cursor:pointer;transition:all .15s">리스트</button>
          <button data-memberhistview="graph" style="flex:1;height:44px;border:none;border-bottom:2px solid ${S.histView[m.id]==='graph'?'#3182F6':'transparent'};background:transparent;font-size:16px;font-weight:700;color:${S.histView[m.id]==='graph'?'#3182F6':'#8B95A1'};cursor:pointer;transition:all .15s">그래프</button>
        </div>
      </div>
      ${wodRows}<div style="height:40px"></div>` 
    : `<div style="padding:16px 18px 40px">${rankRows}</div>`}
  </div>`;
}

/* ── COACH ── */
function renderCoach() {
  const pm=members.find(m=>m.id===S.panelId);
  const done=pm?Object.keys(pm.records).length:0;
  const pct=pm?Math.round(done/WODS.length*100):0;

  const sideRows = members.map(m => {
    const act=m.id===S.panelId; const cnt=Object.keys(m.records).length;
    return `<div class="sidebar-row${act?" active":""}">
      <div style="display:flex;align-items:center;gap:10px;flex:1;cursor:pointer;min-width:0" data-sel="${m.id}">
        ${av(m.name,34,act,m.avatar??null)}
        <div class="sidebar-info"><span class="sidebar-name${act?" active":""}">${m.name}</span><span class="sidebar-sub">${cnt}/${WODS.length}</span></div>
      </div>
      <div class="sidebar-actions">
        <button data-set-gender="${m.id}" style="background:${m.gender==="male"?"#EBF3FE":m.gender==="female"?"#FEF2F2":"#F2F4F6"};border:none;border-radius:6px;padding:3px 7px;font-size:11px;font-weight:700;color:${m.gender==="male"?"#3182F6":m.gender==="female"?"#F04452":"#B0B8C1"};cursor:pointer;min-height:28px">${m.gender==="male"?"남":m.gender==="female"?"여":"성별"}</button>
        <button class="sidebar-icon-btn" data-rename="${m.id}" data-rname="${m.name}">${ico.edit}</button>
        <button class="sidebar-icon-btn" data-delconfirm="${m.id}">${ico.trash}</button>
      </div></div>`;
  }).join("");

  const sheet = pm ? `
    ${renderWodListWithGroups(WODS, pm, true, true)}`
  : `<div class="empty-panel"><div style="font-size:28px">←</div><div class="empty-panel-text">회원을 선택하세요</div></div>`;

  const lbPanel = `<div style="padding:18px 40px">
    ${WODS.map(wod => {
      const rows=lb(wod.id);
      return `<div class="lb-card"><div class="lb-head"><span class="lb-num">WOD ${wod.id}</span><span class="lb-wod-name">${wod.name}</span></div>
        ${rows.length===0?`<div class="lb-empty">기록 없음</div>`
          :rows.map((r,i)=>`<div class="lb-row">
            <span class="lb-medal">${i<3?["🥇","🥈","🥉"][i]:i+1}</span>
            <span class="lb-member-name">${r.name}</span>
            <span class="lb-val">${r.value}</span>
            ${r.scale?`<span class="lb-scale">${r.scale}</span>`:""}
          </div>`).join("")}
      </div>`;
    }).join("")}
  </div>`;

  /* ── WOD MANAGER ── */
  const wodManager = `<div style="flex:1;overflow-y:auto;padding:20px">
    <div class="card" style="margin-bottom:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <div class="card-label" style="margin-bottom:0">WOD 목록 (${WODS.length}개)</div>
        <button id="btn-wod-add-toggle" style="display:flex;align-items:center;gap:4px;background:#3182F6;border:none;border-radius:8px;padding:7px 12px;font-size:12px;font-weight:700;color:#fff;min-height:32px">
          ${ico.plus} WOD 추가
        </button>
      </div>
      ${S.showWodForm ? renderWodAddForm() : ""}
      ${WODS.map((wod,idx) => `
      <div class="wod-manager-row">
        <div class="wod-manager-num">${wod.id}</div>
        <div class="wod-manager-info">
          <div class="wod-manager-name">${wod.name}</div>
          ${wod.detail?`<div class="wod-manager-detail">${wod.detail}</div>`:""}
        </div>
        <div class="wod-manager-actions">
          <button class="sidebar-icon-btn" data-wod-edit="${wod.id}">${ico.edit}</button>
          ${WODS.length>1?`<button class="sidebar-icon-btn" data-wod-del="${wod.id}">${ico.trash}</button>`:""}
        </div>
      </div>`).join("")}
    </div>
  </div>`;

  /* WOD edit overlay */
  const wodEditOverlay = S.editingWod ? `
  <div class="wod-edit-overlay" id="wod-edit-overlay">
    <div class="wod-edit-box" onclick="event.stopPropagation()">
      <div class="modal-title" style="margin-bottom:4px">WOD ${S.editingWod.id} 수정</div>
      ${renderWodEditChips(S.editingWod)}
      <input class="wod-input" id="wod-edit-name" placeholder="WOD 이름" value="${S.editingWod.name}"/>
      <input class="wod-input" id="wod-edit-detail" placeholder="세부사항 (선택)" value="${S.editingWod.detail||""}"/>
      <input class="wod-input" id="wod-edit-youtube" placeholder="유튜브 링크 (선택)" value="${S.editingWod.youtube||""}"/>
      <div style="display:flex;gap:8px">
        <button class="btn-cancel" id="btn-wod-edit-cancel">취소</button>
        <button class="btn-save" id="btn-wod-edit-save">저장</button>
      </div>
    </div>
  </div>` : "";

  /* rename / delete member modals */
  const renameModal = S.editingMember ? `
  <div style="position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;padding:24px">
    <div class="modal-box" onclick="event.stopPropagation()" style="width:100%;max-width:320px">
      <div class="modal-title">이름 수정</div>
      <input class="modal-input" id="inp-rename" value="${S.editingMember.name}" placeholder="이름 입력"/>
      <div class="modal-btns"><button class="modal-btn-cancel" id="btn-rename-cancel">취소</button><button class="modal-btn-save" id="btn-rename-save">저장</button></div>
    </div></div>` : "";

  const delModal = S.confirmDelete ? (() => {
    const t=members.find(m=>m.id===S.confirmDelete);
    return `<div style="position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;padding:24px">
      <div class="modal-box" onclick="event.stopPropagation()" style="width:100%;max-width:320px">
        <div class="modal-title">회원 삭제</div>
        <div class="modal-desc"><strong>${t?.name}</strong> 회원을 삭제할까요?<br/><span style="color:#8B95A1;font-size:14px">모든 기록도 함께 삭제돼요.</span></div>
        <div class="modal-btns"><button class="modal-btn-cancel" id="btn-del-cancel">취소</button><button class="modal-btn-delete" id="btn-del-ok">삭제</button></div>
      </div></div>`;
  })() : "";

  const addBox = S.addingMember ? `
  <div class="add-box">
    <input class="add-input" id="inp-newname" placeholder="이름 입력" value="${S.newName}" autofocus/>
    <div class="edit-btns"><button class="btn-cancel" id="btn-add-cancel">취소</button><button class="btn-save" id="btn-add-save">추가</button></div>
  </div>` : "";

  // 메뉴 화면
  if (S.coachSection==="menu") {
    const menus = [
      {key:"members", icon:"👥", label:"회원 관리",    desc:"회원 정보 및 기록 관리"},
      {key:"bmday",   icon:"🎯", label:"벤치마크 Day", desc:"오늘의 측정 WOD 등록"},
      {key:"wod",     icon:"🔥", label:"WOD 관리",     desc:"WOD 추가·수정·삭제"},
      {key:"msg",     icon:"💬", label:"한마디",       desc:"메인 화면 공지 메시지"},
    ];
    return `<div style="min-height:100vh;background:#F2F4F6;display:flex;flex-direction:column">
      <div class="nav">
        <button class="nav-back icon-btn" id="btn-coach-back">${ico.chevL}</button>
        <div class="nav-title">코치 대시보드</div>
        <div style="background:#1A1A2E;color:#fff;font-size:11px;font-weight:800;padding:4px 10px;border-radius:99px;letter-spacing:.3px">COACH</div>
      </div>
      <div style="padding:16px 18px;display:flex;flex-direction:column;gap:10px;flex:1">
        ${menus.map(m=>`
          <button data-go-section="${m.key}" style="display:flex;align-items:center;gap:16px;background:#fff;border:none;border-radius:16px;padding:18px;width:100%;text-align:left;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.05);-webkit-tap-highlight-color:transparent;min-height:76px">
            <span style="font-size:28px;flex-shrink:0">${m.icon}</span>
            <div style="flex:1">
              <p style="font-size:16px;font-weight:700;color:#1A1A2E">${m.label}</p>
              <p style="font-size:12px;color:#8B95A1;margin-top:3px">${m.desc}</p>
            </div>
            ${ico.chevR}
          </button>`).join("")}
      </div>
    </div>
`;
  }

  // 섹션 화면 — 상단에 ← + 섹션명
  const sectionLabels = {members:"회원 관리", rank:"순위", bmday:"벤치마크 Day", wod:"WOD 관리", msg:"한마디"};
  const isInMemberDetail = S.coachTab==="members" && S.panelId;
  const detailMember = isInMemberDetail ? members.find(m=>m.id===S.panelId) : null;
  const navBackId = isInMemberDetail ? "btn-member-detail-back" : "btn-coach-section-back";
  const navTitle = isInMemberDetail ? (detailMember?.name||"") : (sectionLabels[S.coachTab]||"코치 대시보드");

  return `<div style="min-height:100vh;background:#F2F4F6;display:flex;flex-direction:column">
    <div class="nav">
      <button class="nav-back icon-btn" id="${navBackId}">${ico.chevL}</button>
      <div class="nav-title">${navTitle}</div>
      ${isInMemberDetail ? `<span style="font-size:14px;font-weight:700;color:#3182F6;background:#EBF3FE;padding:4px 12px;border-radius:99px">${pct}%</span>` : `<div style="background:#1A1A2E;color:#fff;font-size:11px;font-weight:800;padding:4px 10px;border-radius:99px;letter-spacing:.3px">COACH</div>`}
    </div>
    ${S.coachTab==="members" ? (S.panelId ? renderCoachMemberDetail() : renderCoachMembers())
    : S.coachTab==="rank" ? `<div style="overflow-y:auto;flex:1">${lbPanel}</div>`
    : S.coachTab==="bmday" ? renderBenchmarkDayMgr()
    : S.coachTab==="wod"  ? wodManager
    : `<div style="flex:1;padding:24px 18px;max-width:480px;width:100%;margin:0 auto">
        <div class="card">
          <div class="card-label">코치의 한마디</div>
          <div style="font-size:14px;color:#8B95A1;margin-bottom:12px">메인 화면 상단에 표시됩니다</div>
          <textarea id="inp-coach-msg" maxlength="100"
            style="width:100%;height:120px;background:#F2F4F6;border:1.5px solid #3182F6;border-radius:12px;padding:12px 14px;font-size:16px;line-height:1.6;resize:none;outline:none;font-family:inherit;color:#1A1A2E;box-sizing:border-box"
            placeholder="회원들에게 전할 메시지 (최대 100자)">${coachMessage}</textarea>
          <div style="display:flex;justify-content:flex-end;margin-top:6px"><span id="msg-counter" style="font-size:12px;color:#B0B8C1">${coachMessage.length}/100</span></div>
          <div style="display:flex;gap:8px;margin-top:12px">
            <button id="btn-msg-clear" class="btn-cancel" style="flex:1;height:44px">지우기</button>
            <button id="btn-msg-save" class="btn-save" style="flex:2;height:44px">저장</button>
          </div>
        </div>
      </div>`}
    ${renameModal}${delModal}${wodEditOverlay}

  </div>`;
}

/* ── WOD Edit Chips (group + type, for edit overlay) ── */
function renderWodEditChips(wod) {
  if (!wod) return "";
  const groups = ["STRENGTH","HYROX","WOD"];
  const types  = [{key:"time",label:"시간"},{key:"weight",label:"무게"},{key:"rounds",label:"라운드"},{key:"reps",label:"횟수"}];
  const g = wod.group || "WOD";
  const t = wod.type  || "time";
  const gChips = groups.map(function(v){
    const a=g===v;
    return '<button data-wod-group="'+v+'" style="flex:1;height:48px;border-radius:12px;border:2px solid '+(a?"#3182F6":"#E8EBED")+';background:'+(a?"#EBF3FE":"#F2F4F6")+';color:'+(a?"#3182F6":"#8B95A1")+';font-size:14px;font-weight:700;cursor:pointer">'+v+'</button>';
  }).join("");
  const tChips = types.map(function(v){
    const a=t===v.key;
    return '<button data-wod-type="'+v.key+'" style="flex:1;height:48px;border-radius:12px;border:2px solid '+(a?"#3182F6":"#E8EBED")+';background:'+(a?"#EBF3FE":"#F2F4F6")+';color:'+(a?"#3182F6":"#8B95A1")+';font-size:14px;font-weight:700;cursor:pointer;white-space:nowrap">'+v.label+'</button>';
  }).join("");
  return '<div style="font-size:14px;font-weight:700;color:#8B95A1;margin-bottom:6px">그룹</div>'
    +'<div style="display:flex;gap:6px;margin-bottom:12px">'+gChips+'</div>'
    +'<div style="font-size:14px;font-weight:700;color:#8B95A1;margin-bottom:6px">측정 방식</div>'
    +'<div style="display:flex;gap:6px;margin-bottom:12px">'+tChips+'</div>';
}

/* ── WOD Add Form (separate fn to avoid nested template literal issues) ── */
function renderWodAddForm() {
  const groups = ["STRENGTH","HYROX","WOD"];
  const types  = [
    {key:"time",   label:"시간"},
    {key:"weight", label:"무게"},
    {key:"rounds", label:"라운드"},
    {key:"reps",   label:"횟수"},
  ];
  const g = S.wodFormVal.group || "WOD";
  const t = S.wodFormVal.type  || "time";

  const groupChips = groups.map(function(v) {
    const active = g === v;
    return '<button data-wod-form-group="' + v + '" style="flex:1;height:48px;border-radius:12px;border:2px solid ' + (active?"#3182F6":"#E8EBED") + ';background:' + (active?"#EBF3FE":"#F2F4F6") + ';color:' + (active?"#3182F6":"#8B95A1") + ';font-size:14px;font-weight:700;cursor:pointer">' + v + '</button>';
  }).join("");

  const typeChips = types.map(function(v) {
    const active = t === v.key;
    return '<button data-wod-form-type="' + v.key + '" style="flex:1;height:48px;border-radius:12px;border:2px solid ' + (active?"#3182F6":"#E8EBED") + ';background:' + (active?"#EBF3FE":"#F2F4F6") + ';color:' + (active?"#3182F6":"#8B95A1") + ';font-size:14px;font-weight:700;cursor:pointer;white-space:nowrap">' + v.label + '</button>';
  }).join("");

  return '<div class="wod-add-form">'
    + '<div style="font-size:14px;font-weight:700;color:#8B95A1;margin-bottom:6px">그룹</div>'
    + '<div style="display:flex;gap:6px;margin-bottom:12px">' + groupChips + '</div>'
    + '<div style="font-size:14px;font-weight:700;color:#8B95A1;margin-bottom:6px">측정 방식</div>'
    + '<div style="display:flex;gap:6px;margin-bottom:12px">' + typeChips + '</div>'
    + '<input class="wod-input" id="wod-inp-name" placeholder="WOD 이름 (예: BSQ 5RM)" value="' + (S.wodFormVal.name||"") + '"/>'
    + '<input class="wod-input" id="wod-inp-detail" placeholder="세부사항 선택사항" value="' + (S.wodFormVal.detail||"") + '"/>'
    + '<input class="wod-input" id="wod-inp-youtube" placeholder="유튜브 링크 (선택)" value="' + (S.wodFormVal.youtube||"") + '"/>'
    + '<div style="display:flex;gap:7px">'
    + '<button class="btn-cancel" id="btn-wod-add-cancel">취소</button>'
    + '<button class="btn-save" id="btn-wod-add-save">추가</button>'
    + '</div></div>';
}

/* ── WOD list with group headers ── */
function renderWodListWithGroups(wods, member, showDel, hideYoutube) {
  const GROUP_ORDER = ["STRENGTH","HYROX","WOD"];
  const GROUP_LABELS = {STRENGTH:"STRENGTH", HYROX:"HYROX", WOD:"WOD"};
  let html = "";
  let lastGroup = null;
  wods.forEach(wod => {
    const g = wod.group || "WOD";
    if (g !== lastGroup) {
      html += '<div style="padding:18px 8px;font-size:12px;font-weight:800;color:#8B95A1;letter-spacing:.8px;background:#F2F4F6">' + (GROUP_LABELS[g] || g) + '</div>';
      lastGroup = g;
    }
    const rec = member.records[wod.id];
    const isEd = S.editing?.memberId === member.id && S.editing?.wodId === wod.id;
    html += wodRowHtml(wod, rec, isEd, member.id, showDel, hideYoutube);
  });
  return html;
}



/* ── PROFILE MODAL ── */
function renderProfileModal() {
  const GRID_COLS = 4;

  const memberRows = '<div class="member-grid" style="margin-bottom:16px">'
    + members.map(function(m) {
        const src = getMemberAvatar(m);
        const avHtml = src
          ? '<img src="'+src+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>'
          : m.name[0];
        return '<button class="member-cell" data-profile-select="'+m.id+'">'
          +'<div class="member-cell-av">'+avHtml+'</div>'
          +'<span class="member-cell-name">'+m.name+'</span>'
          +'</button>';
      }).join("")
    + '</div>';

  const newNameSection = '<div style="margin-top:4px">'
    +'<p style="font-size:12px;font-weight:700;color:#8B95A1;margin-bottom:8px">새 프로필 등록</p>'
    +'<input id="inp-profile-name" class="input" style="height:48px;margin-bottom:8px" placeholder="이름 입력" value="'+(S.profileNewName||'')+'"/>'
    +'<div style="display:flex;gap:8px;margin-bottom:8px">'
    +'<button id="btn-gender-male" style="flex:1;height:44px;border-radius:12px;border:2px solid '+(S.profileGender==="male"?"#3182F6":"#E8EBED")+';background:'+(S.profileGender==="male"?"#EBF3FE":"#F2F4F6")+';color:'+(S.profileGender==="male"?"#3182F6":"#8B95A1")+';font-size:14px;font-weight:700;cursor:pointer">남성</button>'
    +'<button id="btn-gender-female" style="flex:1;height:44px;border-radius:12px;border:2px solid '+(S.profileGender==="female"?"#F04452":"#E8EBED")+';background:'+(S.profileGender==="female"?"#FEF2F2":"#F2F4F6")+';color:'+(S.profileGender==="female"?"#F04452":"#8B95A1")+';font-size:14px;font-weight:700;cursor:pointer">여성</button>'
    +'</div>'
    +'<button id="btn-profile-add" style="width:100%;height:48px;background:#3182F6;border:none;border-radius:14px;font-size:14px;font-weight:700;color:#fff;cursor:pointer">등록</button>'
    +(S.profileNameErr ? '<p style="font-size:12px;color:#F04452;margin-top:6px">'+S.profileNameErr+'</p>' : '')
    +'</div>';

  return '<div class="modal-overlay" id="profile-modal-overlay" style="align-items:flex-end">'
    +'<div style="background:#fff;border-radius:20px 20px 0 0;width:100%;max-width:480px;padding:24px 20px calc(24px + env(safe-area-inset-bottom));max-height:85vh;overflow-y:auto">'
    +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">'
    +'<p style="font-size:18px;font-weight:800;color:#1A1A2E">프로필 설정</p>'
    +'</div>'
    +'<p style="font-size:14px;color:#8B95A1;margin-bottom:18px">나를 선택하거나 새로 등록해주세요</p>'
    +(members.length > 0
      ? '<p style="font-size:12px;font-weight:700;color:#8B95A1;margin-bottom:8px">회원 목록</p>'+memberRows
      : '')
    +newNameSection
    +'</div>'
    +'</div>';
}


/* ── COACH MEMBERS ── */

function renderMemberHome(m) {
  const now = new Date();
  const MONTHS = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];
  const DOWS   = ["일","월","화","수","목","금","토"];
  const dateStr = now.getFullYear()+"년 "+MONTHS[now.getMonth()]+" "+now.getDate()+"일 "+DOWS[now.getDay()]+"요일";

  // Today's benchmark day
  const tKey = todayKey();
  const td = todayWod && todayWod[tKey];
  const bdWod = td ? WODS.find(w=>w.id===parseInt(td.wodId)) : null;
  const myRec = bdWod ? m.records[bdWod.id] : null;
  const pass = passes[m.id];

  // Benchmark Day card
  let bdCard = "";
  if (!bdWod) {
    bdCard = '<div class="card" style="text-align:center;padding:32px 18px">'
      +'<div style="font-size:28px;margin-bottom:10px">🏋️</div>'
      +'<p style="font-size:16px;font-weight:700;color:#1A1A2E;margin-bottom:6px">오늘은 벤치마크 Day가 없어요</p>'
      +'<p style="font-size:14px;color:#B0B8C1">코치가 등록하면 여기에 나타나요</p>'
      +'</div>';
  } else {
    const hasRecord = !!myRec;
    const trendHtml = (() => {
      if (!hasRecord || !myRec.history || myRec.history.length === 0) return "";
      const prev = myRec.history[myRec.history.length-1];
      const prevNum = parseRecordVal(prev.value, bdWod.type);
      const curNum  = parseRecordVal(myRec.value, bdWod.type);
      if (!prevNum || !curNum || prevNum===Infinity || curNum===Infinity) return "";
      const diff = bdWod.type==="time" ? prevNum-curNum : curNum-prevNum;
      const pct = Math.abs(Math.round(diff/Math.abs(prevNum)*100));
      if (diff > 0) return '<span style="font-size:12px;font-weight:700;color:#00C471;background:#E6FAF0;padding:3px 10px;border-radius:99px">▲ '+pct+'%</span>';
      if (diff < 0) return '<span style="font-size:12px;font-weight:700;color:#F04452;background:#FEF2F2;padding:3px 10px;border-radius:99px">▼ '+pct+'%</span>';
      return '<span style="font-size:12px;font-weight:700;color:#8B95A1;background:#F2F4F6;padding:3px 10px;border-radius:99px">→ 동일</span>';
    })();

    bdCard = '<div class="card">'
      +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">'
      +'<span style="font-size:12px;font-weight:800;color:#3182F6;background:#EBF3FE;padding:4px 12px;border-radius:99px;letter-spacing:.5px">🎯 벤치마크 Day</span>'
      +(hasRecord ? '<span style="font-size:12px;font-weight:700;color:#00C471">✓ 기록 완료</span>' : '<span style="font-size:12px;color:#B0B8C1">기록 전</span>')
      +'</div>'
      +'<p style="font-size:18px;font-weight:800;color:#1A1A2E;letter-spacing:-.4px;margin-bottom:4px">'+bdWod.name+'</p>'
      +(bdWod.detail ? '<p style="font-size:14px;color:#8B95A1;margin-bottom:14px">'+bdWod.detail+'</p>' : '<div style="margin-bottom:14px"></div>')
      +(hasRecord
        ? '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">'
          +'<span style="font-size:24px;font-weight:800;color:#1A1A2E">'+myRec.value+'</span>'
          +trendHtml
          +'</div>'
        : '')
      +(td.note ? '<p style="font-size:13px;color:#8B95A1;background:#F8F9FA;border-radius:10px;padding:10px 14px;margin-bottom:14px">💬 '+td.note+'</p>' : '')
      +'<button data-bd-record="'+bdWod.id+'" style="width:100%;height:48px;background:'+(hasRecord?"#F2F4F6":"#3182F6")+';border:none;border-radius:12px;font-size:16px;font-weight:700;color:'+(hasRecord?"#8B95A1":"#fff")+';cursor:pointer">'
      +(hasRecord ? '✏️ 기록 수정' : '+ 기록 입력')
      +'</button>'
      +'</div>';
  }

  // Coach message
  const msgHtml = coachMessage
    ? '<div class="coach-msg-card" style="margin-bottom:14px"><div class="coach-msg-label">💬 코치의 한마디</div><div class="coach-msg-text">'+coachMessage+'</div></div>'
    : '';

  return '<div style="flex:1;overflow-y:auto;background:#F2F4F6;padding:18px;display:flex;flex-direction:column;gap:12px">'
    +'<div>'
    +'<p style="font-size:24px;font-weight:800;color:#1A1A2E;letter-spacing:-.5px;margin-bottom:4px">안녕하세요, '+m.name+'님 👋</p>'
    +'<p style="font-size:14px;color:#8B95A1">'+dateStr+'</p>'
    +'</div>'
    +msgHtml
    +bdCard
    +'</div>';
}

/* ── WOD ROW ── */
function wodRowHtml(wod,rec,isEd,memberId,showDel,hideYoutube) {
  let body="";
  if (isEd) {
    const wtype = wod.type || "time";
    let inputHtml = "";
    if (wtype === "time") {
      inputHtml = '<div class="time-input-row">'
        + '<div class="time-field-wrap"><input class="time-field" id="inp-min" type="text" inputmode="numeric" pattern="[0-9]*" placeholder="0" value="' + S.timeVal.min + '" inputmode="numeric"/><span class="time-field-label">분</span></div>'
        + '<span class="time-sep">:</span>'
        + '<div class="time-field-wrap"><input class="time-field" id="inp-sec" type="text" inputmode="numeric" pattern="[0-9]*" placeholder="00" value="' + S.timeVal.sec + '" inputmode="numeric"/><span class="time-field-label">초</span></div>'
        + '</div>';
    } else if (wtype === "weight") {
      const prev = S.editVal.value ? parseFloat(S.editVal.value)||"" : "";
      inputHtml = '<div class="time-input-row">'
        + '<div class="time-field-wrap" style="flex:2"><input class="time-field" id="inp-weight" type="text" inputmode="decimal" pattern="[0-9.]*" placeholder="0" value="' + prev + '" inputmode="decimal"/><span class="time-field-label">kg</span></div>'
        + '</div>';
    } else if (wtype === "rounds") {
      const rMatch = S.editVal.value ? S.editVal.value.match(/^(\d+)R\+(\d+)$/) : null;
      const rVal = rMatch ? rMatch[1] : (S.editVal.value ? S.editVal.value.replace(/R.*/, "") : "");
      const repVal = rMatch ? rMatch[2] : "";
      inputHtml = '<div class="time-input-row">'
        + '<div class="time-field-wrap"><input class="time-field" id="inp-rounds" type="text" inputmode="numeric" pattern="[0-9]*" placeholder="0" value="' + rVal + '"/><span class="time-field-label">라운드</span></div>'
        + '<span class="time-sep">+</span>'
        + '<div class="time-field-wrap"><input class="time-field" id="inp-reps-extra" type="text" inputmode="numeric" pattern="[0-9]*" placeholder="0" value="' + repVal + '"/><span class="time-field-label">렙</span></div>'
        + '</div>';
    } else {
      const prev = S.editVal.value ? parseFloat(S.editVal.value)||"" : "";
      inputHtml = '<div class="time-input-row">'
        + '<div class="time-field-wrap" style="flex:2"><input class="time-field" id="inp-reps" type="text" inputmode="numeric" pattern="[0-9]*" placeholder="0" value="' + prev + '" inputmode="numeric"/><span class="time-field-label">횟수</span></div>'
        + '</div>';
    }
    body = `<div class="edit-area">
      ${inputHtml}
      <div style="display:flex;gap:6px;margin-top:6px">
        ${["RXD","A","B"].map(s=>`<button data-scale-btn="${s}" style="flex:1;height:36px;border-radius:10px;border:2px solid ${S.editVal.scale===s?"#3182F6":"#E8EBED"};background:${S.editVal.scale===s?"#EBF3FE":"#F2F4F6"};color:${S.editVal.scale===s?"#3182F6":"#8B95A1"};font-size:13px;font-weight:700;cursor:pointer">${s}</button>`).join("")}
      </div>
      <div class="edit-btns" style="margin-top:2px">
        <button class="btn-cancel" id="btn-edit-cancel">취소</button>
        <button class="btn-save" data-save="${memberId}" data-wid="${wod.id}" data-wtype="${wod.type||'time'}" data-isnew="${S.isAddingNew?'1':'0'}">저장</button>
      </div></div>`;
  } else if (rec) {
    const recWtype = wod.type || "time";
    const hist = rec.history||[];
    let trendHtml = "";
    if (hist.length > 0) {
      const prev = hist[hist.length-1];
      const prevNum = parseRecordVal(prev.value, recWtype);
      const curNum  = parseRecordVal(rec.value,  recWtype);
      if (prevNum && curNum && prevNum !== Infinity && curNum !== Infinity) {
        const diff = recWtype==="time" ? prevNum - curNum : curNum - prevNum;
        const pct  = Math.abs(Math.round(diff/Math.abs(prevNum)*100));
        if (diff > 0)      trendHtml = `<span style="font-size:12px;font-weight:700;color:#00C471;background:#E6FAF0;padding:2px 7px;border-radius:99px">▲ ${pct}%</span>`;
        else if (diff < 0) trendHtml = `<span style="font-size:12px;font-weight:700;color:#F04452;background:#FEF2F2;padding:2px 7px;border-radius:99px">▼ ${pct}%</span>`;
        else               trendHtml = `<span style="font-size:12px;font-weight:700;color:#8B95A1;background:#F2F4F6;padding:2px 7px;border-radius:99px">→ 동일</span>`;
      }
    }
    // 히스토리 추이 (회원별 리스트/그래프 토글)
    let histHtml = "";
    if (true) {
      const key = memberId + "_" + wod.id;
      const memberMode = S.histView[memberId] || "list";
      const allRecs = [...hist, {value:rec.value, scale:rec.scale||"", date:rec.date}].slice(-5);

      // 리스트 뷰
      const listRows = allRecs.map((h, i, arr) => {
        const prev = arr[i-1];
        let arrow = "";
        if (prev) {
          const pn = parseRecordVal(prev.value, recWtype);
          const cn = parseRecordVal(h.value, recWtype);
          if (pn && cn && pn !== Infinity && cn !== Infinity) {
            const d = recWtype==="time" ? pn - cn : cn - pn;
            if (d > 0)      arrow = `<span style="color:#00C471;font-weight:700">▲</span>`;
            else if (d < 0) arrow = `<span style="color:#F04452;font-weight:700">▼</span>`;
            else            arrow = `<span style="color:#B0B8C1">→</span>`;
          }
        }
        const isLast = i === arr.length - 1;
        return `<tr style="background:transparent;border-bottom:${isLast?"none":"1px solid #F2F4F6"}">
          <td style="padding:5px 8px;font-size:12px;color:#8B95A1;white-space:nowrap">${h.date}</td>
          <td style="padding:5px 8px;font-size:14px;font-weight:${isLast?"800":"600"};color:${isLast?"#3182F6":"#1A1A2E"}">${h.value}</td>
          <td style="padding:5px 8px;font-size:12px;text-align:center">${arrow}</td>
          <td style="padding:5px 8px;font-size:12px;color:#8B95A1">${h.scale||""}</td>
        </tr>`;
      }).join("");
      const listHtml = `<div style="border-radius:10px;overflow:hidden;border:1px solid #E8EBED">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="border-bottom:1px solid #E8EBED">
            <th style="padding:5px 8px;font-size:12px;font-weight:700;color:#8B95A1;text-align:left">날짜</th>
            <th style="padding:5px 8px;font-size:12px;font-weight:700;color:#8B95A1;text-align:left">기록</th>
            <th style="padding:5px 8px;font-size:12px;font-weight:700;color:#8B95A1;text-align:center">추이</th>
            <th style="padding:5px 8px;font-size:12px;font-weight:700;color:#8B95A1;text-align:left">스케일</th>
          </tr></thead>
          <tbody>${listRows}</tbody>
        </table>
      </div>`;

      // 그래프 뷰
      const vals = allRecs.map(h => parseRecordVal(h.value, recWtype)).filter(v => v !== Infinity && v !== -Infinity && v);
      const minV = Math.min(...vals), maxV = Math.max(...vals);
      const range = maxV - minV || 1;
      const W = 280, H = 80, pad = 10;
      const points = allRecs.map((h, i) => {
        const v = parseRecordVal(h.value, recWtype);
        const normalized = recWtype === "time" ? (maxV - v) / range : (v - minV) / range;
        const x = pad + i * ((W - pad*2) / (allRecs.length - 1 || 1));
        const y = H - pad - normalized * (H - pad*2);
        return {x, y, h, isLast: i === allRecs.length-1};
      });
      const polyline = points.map(p=>`${p.x},${p.y}`).join(" ");
      const dots = points.map(p => {
        const color = p.isLast ? "#3182F6" : "#B0B8C1";
        const r = p.isLast ? 5 : 3;
        return `<circle cx="${p.x}" cy="${p.y}" r="${r}" fill="${color}"/>
          <text x="${p.x}" y="${p.y - 8}" text-anchor="middle" font-size="9" fill="${p.isLast?"#3182F6":"#8B95A1"}" font-weight="${p.isLast?"700":"400"}">${p.h.value}</text>
          <text x="${p.x}" y="${H}" text-anchor="middle" font-size="8" fill="#B0B8C1">${p.h.date}</text>`;
      }).join("");
      const graphHtml = allRecs.length >= 2
        ? `<div style="border-radius:10px;border:1px solid #E8EBED;padding:12px 8px 4px;background:#fff">
            <svg width="100%" viewBox="0 0 ${W} ${H+4}" style="overflow:visible">
              <polyline points="${polyline}" fill="none" stroke="#3182F6" stroke-width="2" stroke-linejoin="round"/>
              ${dots}
            </svg>
          </div>`
        : `<div style="border-radius:10px;border:1px solid #E8EBED;padding:14px;background:#fff;font-size:12px;color:#B0B8C1;text-align:center">기록 2개 이상부터 그래프를 볼 수 있어요</div>`;

      histHtml = `<div style="margin-top:10px">
        ${memberMode === "list" ? listHtml : graphHtml}
      </div>`;}

    body=`<div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;gap:8px">
      <span class="rec-val" style="margin-top:0">${rec.value}</span>
      <button class="icon-btn" data-oedit="${memberId}" data-owid="${wod.id}" style="background:#F2F4F6;border-radius:8px;height:36px;padding:0 12px;display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:600;color:#8B95A1;flex-shrink:0">${ico.edit} 수정</button>
    </div>
    <div class="rec-meta">
      ${trendHtml}
      ${rec.scale?`<span class="rec-scale">${rec.scale}</span>`:""}
      <span class="rec-date">${rec.date}</span>
    </div>
    ${histHtml}
    <button class="add-rec-btn" data-oadd="${memberId}" data-owid="${wod.id}" style="margin-top:8px">+ 기록 추가</button>`;
  } else {
    body=`<button class="add-rec-btn" data-oedit="${memberId}" data-owid="${wod.id}">+ 기록 추가</button>`;
  }
  return `<div class="wod-row${rec?" done":""}">
    <div class="wod-badge${rec?" done":""}">${wod.id}</div>
    <div class="wod-content">
      <div class="wod-name">${wod.name}</div>
      ${wod.detail?`<div class="wod-detail">${wod.detail}</div>`:""}
      ${body}
      ${hideYoutube ? "" : wod.youtube
        ? `<a href="https://youtu.be/${getYoutubeId(wod.youtube)||wod.youtube}" target="_blank" rel="noopener" class="add-rec-btn" style="text-decoration:none;display:inline-flex;align-items:center;gap:5px">
            🎬 동작 영상
          </a>`
        : `<button class="add-rec-btn" style="cursor:default;color:#B0B8C1;border-color:#F2F4F6">동작 영상 준비 중 · 코치에게 문의</button>`}
    </div></div>`;
}



/* ── COACH MEMBERS LIST ── */
function renderCoachMembers() {
  const addBox = S.addingMember
    ? '<div style="background:#F2F4F6;border-radius:14px;padding:12px;margin-bottom:12px;display:flex;flex-direction:column;gap:8px">'
      +'<input id="inp-new-member-name" class="input" placeholder="이름 입력" value="'+(S.newMemberName||'')+'"/>'
      +'<div style="display:flex;gap:8px">'
      +'<button id="btn-add-member-cancel" class="btn-secondary" style="flex:1;height:44px;font-size:14px">취소</button>'
      +'<button id="btn-add-member-save" style="flex:2;height:44px;background:#3182F6;border:none;border-radius:12px;font-size:14px;font-weight:700;color:#fff;cursor:pointer">추가</button>'
      +'</div></div>'
    : '';
  const rows = members.map(function(m) {
    const src = getMemberAvatar(m);
    const av = src
      ? '<img src="'+src+'" style="width:44px;height:44px;border-radius:50%;object-fit:cover;flex-shrink:0"/>'
      : '<div style="width:44px;height:44px;border-radius:50%;background:#EBF3FE;color:#3182F6;font-size:18px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0">'+m.name[0]+'</div>';
    const cnt = Object.keys(m.records).length;
    const gB = '<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:99px;background:'+(m.gender==="male"?"#EBF3FE":m.gender==="female"?"#FEF2F2":"#F2F4F6")+';color:'+(m.gender==="male"?"#3182F6":m.gender==="female"?"#F04452":"#B0B8C1")+'">'+(m.gender==="male"?"남성":m.gender==="female"?"여성":"미설정")+'</span>';
    const dB = m.dormant ? '<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:99px;background:#FFF0E0;color:#E06000">휴면</span>' : '';
    return '<div data-open-member="'+m.id+'" style="background:#fff;border-radius:14px;padding:14px 16px;margin-bottom:8px;display:flex;align-items:center;gap:12px;box-shadow:0 1px 4px rgba(0,0,0,.04);cursor:pointer">'
      +av+'<div style="flex:1;min-width:0"><p style="font-size:15px;font-weight:700;color:#1A1A2E">'+m.name+'</p>'
      +'<div style="display:flex;gap:4px;margin-top:4px">'+gB+dB+'</div></div>'
      +'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B0B8C1" stroke-width="2" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>'
      +'</div>';
  }).join('');
  const hdr = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">'
    +'<span style="font-size:14px;font-weight:700;color:#8B95A1">회원 '+members.length+'명</span>'
    +(S.addingMember?'':'<button id="btn-add-member" style="background:#3182F6;border:none;border-radius:8px;padding:7px 12px;font-size:12px;font-weight:700;color:#fff;cursor:pointer">+ 추가</button>')
    +'</div>';
  return '<div style="flex:1;overflow-y:auto;background:#F2F4F6;padding:14px 16px 40px">'+hdr+addBox+rows+'</div>';
}

/* ── COACH MEMBER DETAIL ── */
function renderCoachMemberDetail() {
  const m = members.find(x=>x.id===S.panelId);
  if (!m) return "";
  const src = getMemberAvatar(m);
  const av = src
    ? '<img src="'+src+'" style="width:56px;height:56px;border-radius:50%;object-fit:cover"/>'
    : '<div style="width:56px;height:56px;border-radius:50%;background:#EBF3FE;color:#3182F6;font-size:22px;font-weight:800;display:flex;align-items:center;justify-content:center">'+m.name[0]+'</div>';
  const gL = m.gender==="male"?"남성":m.gender==="female"?"여성":"미설정";
  const dL = m.dormant?"휴면":"활성";
  const hv = S.histView[m.id]||'list';
  const sheet = renderWodListWithGroups(WODS, m, true, true);

  // 삭제 아이콘 SVG
  const trashIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F04452" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>';

  const btnStyle = 'height:44px;border-radius:10px;border:1.5px solid #E8EBED;background:#fff;font-size:13px;font-weight:600;color:#1A1A2E;padding:0 10px;cursor:pointer;width:100%';
  const selectStyle = 'height:44px;border-radius:10px;border:1.5px solid #E8EBED;background:#fff;font-size:13px;font-weight:600;color:#1A1A2E;padding:0 10px;cursor:pointer;width:100%';

  return '<div style="flex:1;overflow-y:auto;background:#F2F4F6;padding:16px 18px 40px">'
    // 프로필 카드
    +'<div style="background:#fff;border-radius:16px;padding:18px;margin-bottom:12px;box-shadow:0 1px 4px rgba(0,0,0,.05)">'
    // 아바타 + 이름 + 삭제 아이콘
    +'<div style="display:flex;align-items:center;gap:14px;margin-bottom:14px">'+av
    +'<div style="flex:1"><p style="font-size:18px;font-weight:800;color:#1A1A2E">'+m.name+'</p>'
    +'<div style="display:flex;gap:6px;margin-top:6px">'
    +'<span style="font-size:12px;font-weight:700;padding:3px 10px;border-radius:99px;background:'+(m.gender==="male"?"#EBF3FE":m.gender==="female"?"#FEF2F2":"#F2F4F6")+';color:'+(m.gender==="male"?"#3182F6":m.gender==="female"?"#F04452":"#B0B8C1")+'">'+gL+'</span>'
    +'<span style="font-size:12px;font-weight:700;padding:3px 10px;border-radius:99px;background:'+(m.dormant?"#FFF0E0":"#E6FAF0")+';color:'+(m.dormant?"#E06000":"#00C471")+'">'+dL+'</span>'
    +'</div></div>'
    // 삭제 아이콘 버튼 (우측)
    +'<button data-delconfirm="'+m.id+'" style="background:none;border:none;cursor:pointer;padding:6px;flex-shrink:0">'+trashIcon+'</button>'
    +'</div>'
    // 이름수정 / 성별 / 상태 — 동일한 width 3열
    +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">'
    +'<button data-rename="'+m.id+'" data-rname="'+m.name+'" style="'+btnStyle+'">이름 수정</button>'
    +'<select data-select-gender="'+m.id+'" style="'+selectStyle+'">'
    +'<option value="male"'+(m.gender==="male"?" selected":"")+'>남성</option>'
    +'<option value="female"'+(m.gender==="female"?" selected":"")+'>여성</option>'
    +'</select>'
    +'<select data-select-dormant="'+m.id+'" style="'+selectStyle+'">'
    +'<option value="0"'+(m.dormant?"":" selected")+'>활성</option>'
    +'<option value="1"'+(m.dormant?" selected":"")+'>휴면</option>'
    +'</select>'
    +'</div>'
    +'</div>'
    // 기록 탭
    +'<div style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.05)">'
    +'<div style="display:flex;border-bottom:1px solid #E8EBED">'
    +'<button data-memberhistview="list" style="flex:1;height:44px;border:none;border-bottom:2px solid '+(hv==="list"?"#3182F6":"transparent")+';background:transparent;font-size:15px;font-weight:700;color:'+(hv==="list"?"#3182F6":"#8B95A1")+';cursor:pointer">리스트</button>'
    +'<button data-memberhistview="graph" style="flex:1;height:44px;border:none;border-bottom:2px solid '+(hv==="graph"?"#3182F6":"transparent")+';background:transparent;font-size:15px;font-weight:700;color:'+(hv==="graph"?"#3182F6":"#8B95A1")+';cursor:pointer">그래프</button>'
    +'</div><div class="sheet-panel">'+sheet+'</div></div></div>';
}

/* ── BENCHMARK DAY MANAGER (Coach) ── */
function renderBenchmarkDayMgr() {
  const tKey = todayKey();
  const td = todayWod && todayWod[tKey];
  const selWodId = S.bdWodId !== undefined ? S.bdWodId : (td ? parseInt(td.wodId) : null);
  const selWod = selWodId ? WODS.find(w=>w.id===selWodId) : null;

  const wodOptions = WODS.map(function(w) {
    const active = w.id === selWodId;
    return '<option value="'+w.id+'"'+(active?' selected':'')+'>'+w.name+(w.detail?' · '+w.detail:'')+'</option>';
  }).join('');

  return '<div style="flex:1;overflow-y:auto;background:#F2F4F6;padding:18px">'
    +'<div class="card" style="margin-bottom:12px">'
    +'<p style="font-size:12px;font-weight:800;color:#8B95A1;letter-spacing:.5px;margin-bottom:14px">오늘 등록된 벤치마크 Day</p>'
    +(td
      ? '<div style="background:#EBF3FE;border-radius:12px;padding:14px 16px;margin-bottom:14px">'
        +'<p style="font-size:16px;font-weight:800;color:#1A1A2E">'+(WODS.find(w=>w.id===parseInt(td.wodId))?.name||"알 수 없음")+'</p>'
        +(td.note?'<p style="font-size:14px;color:#8B95A1;margin-top:4px">'+td.note+'</p>':'')
        +'<p style="font-size:12px;color:#3182F6;margin-top:6px">✓ 등록됨</p>'
        +'</div>'
      : '<div style="background:#F8F9FA;border-radius:12px;padding:14px 16px;margin-bottom:14px;text-align:center">'
        +'<p style="font-size:14px;color:#B0B8C1">아직 등록되지 않았어요</p>'
        +'</div>')
    +'<p style="font-size:12px;font-weight:700;color:#8B95A1;margin-bottom:8px">WOD 선택</p>'
    +'<select id="sel-bmday-wod" style="width:100%;height:48px;background:#F2F4F6;border:1.5px solid #E8EBED;border-radius:12px;padding:0 14px;font-size:16px;color:#1A1A2E;font-family:inherit;outline:none;cursor:pointer;margin-bottom:10px">'
    +'<option value="">WOD를 선택하세요</option>'
    +wodOptions
    +'</select>'
    +'<p style="font-size:12px;font-weight:700;color:#8B95A1;margin-bottom:8px">코치 메모 (선택)</p>'
    +'<input id="inp-bmday-note" class="input" placeholder="오늘의 목표나 주의사항을 입력하세요" value="'+(S.bdNote!==undefined?S.bdNote:(td?.note||''))+'" style="margin-bottom:12px"/>'
    +'<button id="btn-bmday-save" style="width:100%;height:48px;background:#3182F6;border:none;border-radius:12px;font-size:16px;font-weight:700;color:#fff;cursor:pointer">오늘 벤치마크 Day 등록</button>'
    +(td ? '<button id="btn-bmday-clear" style="width:100%;height:44px;background:none;border:none;color:#F04452;font-size:14px;font-weight:600;cursor:pointer;margin-top:6px">오늘 등록 취소</button>' : '')
    +'</div>'
    +'</div>';
}

/* ══ BIND ══ */
function updateCoachMemberGrid() {
  const container = document.getElementById("coach-member-grid");
  if (!container) return;
  const filtered = members.filter(m=>m.name.includes(S.coachMemberSearch));
  container.innerHTML = filtered.map(function(m) {
    const cnt = Object.keys(m.records).length;
    const src = getMemberAvatar(m);
    const pct = Math.round(cnt/WODS.length*100);
    const avHtml = src
      ? '<img src="'+src+'" style="width:44px;height:44px;border-radius:50%;object-fit:cover"/>'
      : '<div style="width:44px;height:44px;border-radius:50%;background:#EBF3FE;color:#3182F6;font-size:18px;font-weight:800;display:flex;align-items:center;justify-content:center">'+m.name[0]+'</div>';
    return '<div data-sel-member="'+m.id+'" style="display:flex;align-items:center;gap:12px;background:#fff;border-radius:16px;padding:16px 18px;margin-bottom:8px;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.05);-webkit-tap-highlight-color:transparent">'
      +'<div style="position:relative;flex-shrink:0">'+avHtml+'</div>'
      +'<div style="flex:1;min-width:0">'
      +'<p style="font-size:16px;font-weight:700;color:#1A1A2E">'+m.name+'</p>'
      +'<p style="font-size:12px;color:#8B95A1;margin-top:2px">'+cnt+'/'+WODS.length+' 완료</p>'
      +'</div>'
      +'<div style="display:flex;align-items:center;gap:8px;flex-shrink:0">'
      +'<div style="width:60px"><div class="progress-track"><div class="progress-fill" style="width:'+pct+'%;background:#3182F6"></div></div></div>'
      +'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B0B8C1" stroke-width="2" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>'
      +'</div></div>';
  }).join("");
  // Re-bind click events
  container.querySelectorAll("[data-sel-member]").forEach(function(el) {
    el.addEventListener("click", function() {
      S.panelId=el.dataset.selMember; S.coachSheetView="sheet"; S.editing=null; render();
    });
  });
}

function updateMemberGrid() {
  const container = document.getElementById("member-grid-container");
  if (!container) return;
  const fil = members.filter(m => m.name.includes(S.search));
  container.innerHTML = fil.length===0
    ? `<div class="empty-search">"${S.search}" 검색 결과가 없어요</div>`
    : `<div class="member-grid">${fil.map(m => {
        const hasDone = Object.keys(m.records).length>0;
        return `<button class="member-cell" data-login="${m.id}">
          <div class="member-cell-av">${m.name[0]}${hasDone?`<div class="member-cell-dot"></div>`:""} </div>
          <span class="member-cell-name">${m.name}</span></button>`;
      }).join("")}</div>`;
  container.querySelectorAll("[data-login]").forEach(el => {
    el.addEventListener("click", () => { S.activeMemberId=el.dataset.login; S.memberTab="my"; S.view="member"; render(); });
  });
  const cb = document.getElementById("btn-clear");
  if (cb) cb.style.display = S.search?"flex":"none";
}

function showToast(msg) {
  document.querySelector(".toast")?.remove();
  const el=document.createElement("div"); el.className="toast";
  el.innerHTML=`<span>✓</span>${msg}`; document.body.appendChild(el);
  setTimeout(()=>el.remove(),2100);
}

function bind() {
  const g=id=>document.getElementById(id);
  const on=(id,ev,fn)=>{const el=g(id);if(el)el.addEventListener(ev,fn);};
  const qa=(sel,fn)=>document.querySelectorAll(sel).forEach(fn);

  /* login search */
  const searchEl=g("inp-search");
  if (searchEl) {
    let composing=false;
    searchEl.addEventListener("compositionstart",()=>{composing=true;});
    searchEl.addEventListener("compositionend",e=>{composing=false;S.search=e.target.value;updateMemberGrid();});
    searchEl.addEventListener("input",e=>{if(composing)return;S.search=e.target.value;updateMemberGrid();});
  }
  on("btn-clear","click",()=>{S.search="";const el=g("inp-search");if(el)el.value="";updateMemberGrid();});
  on("btn-rank","click",()=>{S.view="rank";render();});
  // BD Record modal
  on("btn-bd-modal-close","click",()=>{S.bdRecordModal=false;render();});
  on("bd-record-overlay","click",function(e){if(e.target.id==="bd-record-overlay"){S.bdRecordModal=false;render();}});
  on("inp-bd-min","input",e=>{S.timeVal.min=e.target.value;});
  on("inp-bd-sec","input",e=>{S.timeVal.sec=e.target.value;});
  on("inp-bd-weight","input",e=>{S.editVal.value=e.target.value;});
  on("inp-bd-rounds","input",e=>{S.editVal.value=e.target.value;});
  on("inp-bd-reps","input",e=>{S.editVal.value=e.target.value;});
  on("inp-bd-scale-gone","input",e=>{S.editVal.scale=e.target.value;});
  on("inp-reps-extra","input",e=>{});
  on("btn-bd-save","click",function(){
    const btn=document.getElementById("btn-bd-save");
    if(!btn)return;
    const mid=btn.dataset.save, wid=parseInt(btn.dataset.wid), wtype=btn.dataset.wtype;
    const scale=S.editVal.scale||"";
    let value="";
    if(wtype==="time"){
      const min=parseInt(document.getElementById("inp-bd-min")?.value||S.timeVal.min)||0;
      const sec=parseInt(document.getElementById("inp-bd-sec")?.value||S.timeVal.sec)||0;
      if(min===0&&sec===0)return;
      value=min+"'"+String(sec).padStart(2,"0")+'"';
    } else if(wtype==="weight"){
      const w=document.getElementById("inp-bd-weight")?.value||S.editVal.value;
      if(!w||parseFloat(w)===0)return;
      value=parseFloat(w)+"kg";
    } else if(wtype==="rounds"){
      const r=document.getElementById("inp-bd-rounds")?.value||"";
      const extra=document.getElementById("inp-bd-reps-extra")?.value||"";
      if(!r)return;
      value = extra ? r+"R+"+extra : r+"R";
    } else {
      const r=document.getElementById("inp-bd-reps")?.value||S.editVal.value;
      if(!r)return; value=r+"회";
    }
    const m=members.find(x=>x.id===mid);
    const existing=m&&m.records[wid];
    const history=existing&&existing.history?[...existing.history,{value:existing.value,scale:existing.scale,date:existing.date}]:existing?[{value:existing.value,scale:existing.scale,date:existing.date}]:[];
    const today_=()=>{const d=new Date();return (d.getMonth()+1)+"/"+d.getDate();};
    fbSet("members/"+mid+"/records/"+wid,{value,scale,date:today_(),history});
    S.bdRecordModal=false;
    S.editVal={value:"",scale:""};S.timeVal={min:"",sec:""};
    render();
    showToast("기록 저장! 🎉");
  });
  // 전체 회원 보기
  on("btn-all-members","click",()=>{S.allMembersModal=true;render();});
  on("btn-all-members-close","click",()=>{S.allMembersModal=false;render();});
  on("all-members-overlay","click",function(e){if(e.target.id==="all-members-overlay"){S.allMembersModal=false;render();}});
  qa("[data-view-member]",function(el){el.addEventListener("click",function(){
    S.viewingMemberId=el.dataset.viewMember;
    S.allMembersModal=false;
    render();
  });});
  // Member view back
  on("btn-member-view-back","click",()=>{S.viewingMemberId=null;render();});
  on("btn-login-bmday","click",()=>{
    try {
      const saved = localStorage.getItem("mt_last_member");
      const savedMember = saved && members.find(m=>m.id===saved);
      if (savedMember) {
        const tKey = todayKey();
        const td = todayWod && todayWod[tKey];
        const wid = td ? parseInt(td.wodId) : null;
        const wod = wid ? WODS.find(w=>w.id===wid) : null;
        // Set active member and open bottom sheet
        S.activeMemberId = saved;
        S.bdRecordModal = true;
        // Init edit values
        const r = savedMember.records[wid]||{};
        const wtype = wod ? wod.type||"time" : "time";
        S.editVal = {scale:r.scale||"", value:r.value||""};
        if (wtype==="time") {
          const match = r.value ? r.value.match(/(\d+)'(\d+)/) : null;
          S.timeVal = match ? {min:match[1],sec:match[2]} : {min:"",sec:""};
        } else {
          S.timeVal = {min:"",sec:""};
          S.editVal.value = r.value ? parseFloat(r.value)||"" : "";
        }
        render();
        return;
      }
    } catch(e) {}
    S.profileModal = true;
    S.profileNewName = "";
    S.profileNameErr = "";
    render();
  });
  on("btn-show-register","click",()=>{S.registerModal=true;S.registerStep=1;S.registerName="";S.registerErr="";S.registerAvatar=null;render();setTimeout(()=>document.getElementById("inp-register-name")?.focus(),60);});
  on("btn-show-profile-modal","click",()=>{S.profileModal=true;S.profileNewName="";S.profileNameErr="";S.profileGender="";render();});
  on("btn-gender-male","click",()=>{S.profileGender="male";render();});
  on("btn-gender-female","click",()=>{S.profileGender="female";render();});
  on("btn-gender-male","click",()=>{S.profileGender="male";render();});
  on("btn-gender-female","click",()=>{S.profileGender="female";render();});
  on("profile-modal-overlay","click",e=>{if(e.target.id==="profile-modal-overlay"){S.profileModal=false;S.profileGender="";render();}});
  qa("[data-profile-select]",el=>el.addEventListener("click",()=>{
    const mid=el.dataset.profileSelect;
    try{localStorage.setItem("mt_last_member",mid);}catch(e){}
    S.profileModal=false;
    S.activeMemberId=mid;S.view="member";S.memberTab="my";
    render();
  }));
  const profNameEl=document.getElementById("inp-profile-name");
  if(profNameEl){
    profNameEl.addEventListener("input",e=>{S.profileNewName=e.target.value;S.profileNameErr="";});
    profNameEl.addEventListener("keydown",e=>{if(e.key==="Enter")doAddProfileMember();});
  }
  on("btn-profile-add","click",doAddProfileMember);
  on("btn-register-cancel","click",()=>{S.registerModal=false;render();});
  document.getElementById("mo-register")?.addEventListener("click",()=>{S.registerModal=false;render();});
  on("inp-register-name","input",e=>{S.registerName=e.target.value;S.registerErr="";});
  on("inp-register-name","keydown",e=>{if(e.key==="Enter")doRegisterNext();});
  on("btn-register-next","click",doRegisterNext);
  on("btn-register-back","click",()=>{S.registerStep=1;render();setTimeout(()=>document.getElementById("inp-register-name")?.focus(),60);});
  on("btn-register-save","click",doRegisterMember);
  document.querySelectorAll("[data-reg-avatar]").forEach(el=>el.addEventListener("click",()=>{
    S.registerAvatar=parseInt(el.dataset.regAvatar);render();
  }));
  on("btn-open-pin","click",()=>{S.pinModal=true;S.pin="";S.pinErr=false;render();setTimeout(()=>g("inp-pin")?.focus(),60);});
  on("btn-open-coach-from-header","click",()=>{S.view="coach";S.coachSection="menu";render();});
  on("pin-overlay","click",()=>{S.pinModal=false;S.pin="";S.pinErr=false;render();});
  on("inp-pin","input",e=>{S.pin=e.target.value;S.pinErr=false;});
  on("inp-pin","keydown",e=>{if(e.key==="Enter")doLogin();});
  on("btn-pin","click",doLogin);

  /* member login */
  qa("[data-login]",el=>el.addEventListener("click",()=>{
    const mid=el.dataset.login;
    try{localStorage.setItem("mt_last_member",mid);}catch(e){}
    if(S.view==="coach") return;
    S.activeMemberId=mid;S.memberTab="my";S.view="member";S.viewingMemberId=null;
    render();
  }));

  /* rank */
  on("btn-rank-back","click",()=>{S.view="login";render();});

  /* member nav */
  on("btn-member-back","click",()=>{S.view="login";S.editing=null;render();});
  qa("[data-mtab]",el=>el.addEventListener("click",()=>{S.memberTab=el.dataset.mtab;render();}));
  qa("[data-bd-record]",el=>el.addEventListener("click",()=>{
    const wid=parseInt(el.dataset.bdRecord);
    const wod=WODS.find(w=>w.id===wid);
    const m=members.find(x=>x.id===S.activeMemberId);
    const rec=m?.records[wid]||{};
    const wtype=wod?.type||"time";
    S.memberTab="my";
    S.editing={memberId:m.id,wodId:wid};
    S.editVal={scale:rec.scale||"",value:rec.value||""};
    if(wtype==="time"){const mt=rec.value?.match(/(\d+)'(\d+)/);S.timeVal=mt?{min:mt[1],sec:mt[2]}:{min:"",sec:""};}
    else{S.timeVal={min:"",sec:""};S.editVal.value=rec.value?parseFloat(rec.value)||"":"";}
    render();
    setTimeout(()=>{
      const el=document.querySelector('[data-owid="'+wid+'"]');
      if(el)el.scrollIntoView({behavior:"smooth",block:"center"});
    },100);
  }));

  /* avatar picker */
  on("btn-pick-avatar","click",()=>{S.avatarModal=S.activeMemberId;render();});
  on("btn-avatar-cancel","click",()=>{S.avatarModal=false;render();});
  on("btn-avatar-reset","click",()=>{
    fbUpdate(`members/${S.activeMemberId}`,{avatar:null});
    S.avatarModal=false;
  });
  g("mo-avatar")?.addEventListener("click",()=>{S.avatarModal=false;render();});
  qa("[data-pick-avatar]",el=>el.addEventListener("click",e=>{
    e.stopPropagation();
    const idx=parseInt(el.dataset.pickAvatar);
    fbUpdate(`members/${S.activeMemberId}`,{avatar:idx});
    S.avatarModal=false;
    render();
    showToast("캐릭터가 저장됐어요! 🐾");
  }));

  /* coach nav */
  on("btn-coach-back","click",()=>{S.view="login";S.editing=null;S.panelId=null;S.coachSection="menu";try{localStorage.removeItem("mt_coach_logged");}catch{}render();});
  on("btn-member-detail-back","click",()=>{S.panelId=null;render();});
  on("btn-add-member","click",()=>{S.addingMember=true;S.newMemberName="";render();setTimeout(()=>document.getElementById("inp-new-member-name")?.focus(),50);});
  on("btn-add-member-cancel","click",()=>{S.addingMember=false;render();});
  on("btn-add-member-save","click",()=>{
    const name=(document.getElementById("inp-new-member-name")?.value||"").trim();
    if(!name)return;
    if(members.find(m=>m.name===name)){showToast("이미 있는 이름이에요");return;}
    fbPush("members",{name,records:{},avatar:null,gender:"",dormant:false});
    S.addingMember=false; S.newMemberName=""; render();
  });
  on("inp-new-member-name","keydown",e=>{if(e.key==="Enter")document.getElementById("btn-add-member-save")?.click();});
  on("inp-new-member-name","input",e=>{S.newMemberName=e.target.value;});
  document.querySelectorAll("[data-open-member]").forEach(el=>el.addEventListener("click",()=>{S.panelId=el.dataset.openMember;render();}));
  // Benchmark Day binds
  const selBmday=document.getElementById("sel-bmday-wod");
  if(selBmday) selBmday.addEventListener("change",e=>{S.bdWodId=parseInt(e.target.value)||null;render();});
  const noteBmday=document.getElementById("inp-bmday-note");
  if(noteBmday) noteBmday.addEventListener("input",e=>{S.bdNote=e.target.value;});
  on("btn-bmday-save","click",()=>{
    const wid=document.getElementById("sel-bmday-wod")?.value;
    if(!wid){showToast("WOD를 선택해주세요");return;}
    const note=document.getElementById("inp-bmday-note")?.value||"";
    fbSet("benchmarkDay/"+todayKey(),{wodId:parseInt(wid),note});
    S.bdWodId=undefined;S.bdNote=undefined;showToast("벤치마크 Day 등록 완료! 🎯");
  });
  on("btn-bmday-clear","click",()=>{
    fbRemove("benchmarkDay/"+todayKey());
    S.bdWodId=undefined;S.bdNote=undefined;showToast("오늘 등록이 취소됐어요");
  });
  // Home bd-record bind
  qa("[data-bd-record]",el=>el.addEventListener("click",()=>{
    const wid=parseInt(el.dataset.bdRecord);
    const wod=WODS.find(w=>w.id===wid);
    const m=members.find(x=>x.id===S.activeMemberId);
    const rec=m&&m.records[wid]||{};
    const wtype=wod&&wod.type||"time";
    S.memberTab="my";
    S.editing={memberId:m.id,wodId:wid};
    S.editVal={scale:rec.scale||"",value:rec.value||""};
    if(wtype==="time"){const mt=rec.value&&rec.value.match(/(\d+)'(\d+)/);S.timeVal=mt?{min:mt[1],sec:mt[2]}:{min:"",sec:""};}
    else{S.timeVal={min:"",sec:""};S.editVal.value=rec.value?parseFloat(rec.value)||"":"";}
    render();
    setTimeout(function(){
      var el=document.querySelector('[data-oedit][data-owid="'+wid+'"]');
      if(el)el.scrollIntoView({behavior:"smooth",block:"center"});
    },150);
  }));
  const coachSearchEl=document.getElementById("inp-coach-member-search");
  if(coachSearchEl){
    let cmp=false;
    coachSearchEl.addEventListener("compositionstart",()=>{cmp=true;});
    coachSearchEl.addEventListener("compositionend",e=>{cmp=false;S.coachMemberSearch=e.target.value;updateCoachMemberGrid();});
    coachSearchEl.addEventListener("input",e=>{if(cmp)return;S.coachMemberSearch=e.target.value;updateCoachMemberGrid();});
  }
  on("btn-coach-section-back","click",()=>{S.coachSection="menu";S.coachSheetView="list";S.panelId=null;S.editing=null;render();});
  qa("[data-go-section]",el=>el.addEventListener("click",()=>{S.coachTab=el.dataset.goSection;S.coachSection="section";render();}));
  qa("[data-ctab]",el=>el.addEventListener("click",()=>{S.coachTab=el.dataset.ctab;render();}));

  /* select member */
  qa("[data-sel]",el=>el.addEventListener("click",()=>{S.panelId=el.dataset.sel;S.editing=null;render();}));
  qa("[data-sel-member]",el=>el.addEventListener("click",()=>{S.panelId=el.dataset.selMember;S.coachSheetView="sheet";S.editing=null;render();}));
  on("btn-sheet-back","click",()=>{S.coachSheetView="list";S.panelId=null;S.editing=null;render();});

  /* add member */
  on("btn-add-member","click",()=>{S.addingMember=true;render();setTimeout(()=>g("inp-newname")?.focus(),50);});
  // Coach members tab
  on("btn-add-member-cancel","click",()=>{S.addingMember=false;render();});
  on("btn-add-member-save","click",()=>{
    const name=(document.getElementById("inp-new-member-name")?.value||"").trim();
    if(!name)return;
    if(members.find(m=>m.name===name)){showToast("이미 있는 이름이에요");return;}
    fbPush("members",{name,records:{},avatar:null,gender:"",dormant:false});
    S.addingMember=false;
    showToast(name+" 추가됐어요!");
  });
  on("inp-new-member-name","input",e=>{S.newMemberName=e.target.value;});
  on("inp-new-member-name","keydown",e=>{if(e.key==="Enter")document.getElementById("btn-add-member-save")?.click();});
  qa("[data-toggle-dormant]",el=>el.addEventListener("click",e=>{
    e.stopPropagation();
    const mid=el.dataset.toggleDormant;
    const m=members.find(x=>x.id===mid);
    if(m)fbUpdate("members/"+mid,{dormant:!m.dormant});
  }));
  on("inp-newname","input",e=>{S.newName=e.target.value;});
  on("inp-newname","keydown",e=>{if(e.key==="Enter")doAddMember();});
  on("btn-add-cancel","click",()=>{S.addingMember=false;S.newName="";render();});
  on("btn-add-save","click",doAddMember);

  /* rename member */
  qa("[data-rename]",el=>el.addEventListener("click",e=>{
    e.stopPropagation();S.editingMember={id:el.dataset.rename,name:el.dataset.rname};
    render();setTimeout(()=>g("inp-rename")?.focus(),50);
  }));
  on("btn-rename-cancel","click",()=>{S.editingMember=null;render();});
  on("btn-rename-save","click",doRename);
  on("inp-rename","keydown",e=>{if(e.key==="Enter")doRename();});
  g("mo-rename")?.addEventListener("click",()=>{S.editingMember=null;render();});

  /* delete member */
  qa("[data-delconfirm]",el=>el.addEventListener("click",e=>{
    e.stopPropagation();S.confirmDelete=el.dataset.delconfirm;render();
  }));
  on("btn-del-cancel","click",()=>{S.confirmDelete=null;render();});
  on("btn-del-ok","click",()=>doDeleteMember(S.confirmDelete));
  g("mo-del")?.addEventListener("click",()=>{S.confirmDelete=null;render();});

  /* record edit */
  qa("[data-oedit]",el=>el.addEventListener("click",()=>{
    const mid=el.dataset.oedit,wid=parseInt(el.dataset.owid);
    const m=members.find(x=>x.id===mid); const r=m?.records[wid]||{};
    const wod=WODS.find(w=>w.id===wid);
    const wtype=wod?.type||"time";
    S.editing={memberId:mid,wodId:wid};
    S.editVal={scale:r.scale||"",value:r.value||""};
    if(wtype==="time"){
      const match=r.value?.match(/(\d+)'(\d+)/);
      S.timeVal=match?{min:match[1],sec:match[2]}:{min:"",sec:""};
    } else {
      S.timeVal={min:"",sec:""};
    }
    render();
    setTimeout(()=>{(g("inp-min")||g("inp-weight")||g("inp-rounds")||g("inp-reps"))?.focus();},50); }));
  /* record add-new: open empty form */
  qa("[data-oadd]",el=>el.addEventListener("click",()=>{
    const mid=el.dataset.oadd,wid=parseInt(el.dataset.owid);
    S.editing={memberId:mid,wodId:wid};
    S.editVal={scale:"",value:""};
    S.timeVal={min:"",sec:""};
    render();
    setTimeout(()=>{(g("inp-min")||g("inp-weight")||g("inp-rounds")||g("inp-reps"))?.focus();},50); }));
  on("btn-edit-cancel","click",()=>{S.editing=null;render();});
  on("inp-min","input",e=>{S.timeVal.min=e.target.value;});
  on("inp-sec","input",e=>{S.timeVal.sec=e.target.value;});
  on("inp-escale","input",e=>{S.editVal.scale=e.target.value;});
  on("inp-sec",    "keydown",e=>{if(e.key==="Enter"){const btn=document.querySelector("[data-save]");if(btn)doSaveRecord(btn.dataset.save,parseInt(btn.dataset.wid),btn.dataset.wtype);}});
  on("inp-weight", "keydown",e=>{if(e.key==="Enter"){const btn=document.querySelector("[data-save]");if(btn)doSaveRecord(btn.dataset.save,parseInt(btn.dataset.wid),btn.dataset.wtype);}});
  on("inp-rounds", "keydown",e=>{if(e.key==="Enter"){const btn=document.querySelector("[data-save]");if(btn)doSaveRecord(btn.dataset.save,parseInt(btn.dataset.wid),btn.dataset.wtype);}});
  on("inp-reps",   "keydown",e=>{if(e.key==="Enter"){const btn=document.querySelector("[data-save]");if(btn)doSaveRecord(btn.dataset.save,parseInt(btn.dataset.wid),btn.dataset.wtype);}});
  on("inp-weight", "input",e=>{S.editVal.value=e.target.value;});
  on("inp-rounds", "input",e=>{S.editVal.value=e.target.value;});
  on("inp-reps",   "input",e=>{S.editVal.value=e.target.value;});
  qa("[data-save]",el=>el.addEventListener("click",()=>doSaveRecord(el.dataset.save,parseInt(el.dataset.wid),el.dataset.wtype)));
  qa("[data-drec]",el=>el.addEventListener("click",()=>fbRemove(`members/${el.dataset.drec}/records/${el.dataset.dwid}`)));

  /* history view toggle (member-level) */
  qa("[data-memberhistview]",el=>el.addEventListener("click",e=>{
    e.stopPropagation();
    const mode=el.dataset.memberhistview;
    const mid=S.activeMemberId||S.panelId;
    if(mid){ S.histView={...S.histView,[mid]:mode}; render(); }
  }));

  /* WOD manager */
  on("btn-wod-add-toggle","click",()=>{S.showWodForm=!S.showWodForm;S.wodFormVal={name:"",detail:"",group:"WOD",type:"time"};render();setTimeout(()=>g("wod-inp-name")?.focus(),50);});
  on("wod-inp-name","input",e=>{S.wodFormVal.name=e.target.value;});
  on("wod-inp-detail","input",e=>{S.wodFormVal.detail=e.target.value;});
  on("wod-inp-youtube","input",e=>{S.wodFormVal.youtube=e.target.value;});
  on("btn-wod-add-cancel","click",()=>{S.showWodForm=false;render();});
  on("btn-wod-add-save","click",doAddWod);
  qa("[data-wod-form-group]",el=>el.addEventListener("click",()=>{S.wodFormVal={...S.wodFormVal,group:el.dataset.wodFormGroup};render();setTimeout(()=>g("wod-inp-name")?.focus(),0);}));
  qa("[data-wod-form-type]",el=>el.addEventListener("click",()=>{S.wodFormVal={...S.wodFormVal,type:el.dataset.wodFormType};render();setTimeout(()=>g("wod-inp-name")?.focus(),0);}));
  qa("[data-wod-edit]",el=>el.addEventListener("click",()=>{
    const wod=WODS.find(w=>w.id===parseInt(el.dataset.wodEdit));
    if(wod){S.editingWod={...wod};render();setTimeout(()=>g("wod-edit-name")?.focus(),50);}
  }));
  on("btn-wod-edit-cancel","click",()=>{S.editingWod=null;render();});
  on("btn-wod-edit-save","click",doEditWod);
  on("wod-edit-name","keydown",e=>{if(e.key==="Enter")g("wod-edit-detail")?.focus();});
  on("wod-edit-detail","keydown",e=>{if(e.key==="Enter")g("wod-edit-youtube")?.focus();});
  on("wod-edit-youtube","keydown",e=>{if(e.key==="Enter")doEditWod();});
  g("wod-edit-overlay")?.addEventListener("click",()=>{S.editingWod=null;render();});
  qa("[data-wod-group]",el=>el.addEventListener("click",e=>{
    e.stopPropagation();
    if(S.editingWod) { S.editingWod={...S.editingWod,group:el.dataset.wodGroup}; render(); }
  }));
  qa("[data-wod-type]",el=>el.addEventListener("click",e=>{
    e.stopPropagation();
    if(S.editingWod) { S.editingWod={...S.editingWod,type:el.dataset.wodType}; render(); }
  }));
  qa("[data-wod-del]",el=>el.addEventListener("click",()=>doDeleteWod(parseInt(el.dataset.wodDel))));

  /* coach message */
  const msgEl=g("inp-coach-msg"); const counterEl=g("msg-counter");
  if(msgEl) msgEl.addEventListener("input",()=>{if(counterEl)counterEl.textContent=`${msgEl.value.length}/100`;});
  on("btn-msg-save","click",()=>{const val=g("inp-coach-msg")?.value.trim()??"";fbSet("coachMessage",val);showToast("한마디가 저장됐어요!");});
  on("btn-msg-clear","click",()=>{const el=g("inp-coach-msg");if(el){el.value="";if(counterEl)counterEl.textContent="0/100";}fbSet("coachMessage","");showToast("한마디를 지웠어요");});

  /* Scale btn - wod row */
  qa("[data-scale-btn]",el=>el.addEventListener("click",e=>{e.stopPropagation();S.editVal.scale=el.dataset.scaleBtn;render();}));
  /* Scale btn - BD modal */
  qa("[data-bd-scale-btn]",el=>el.addEventListener("click",e=>{e.stopPropagation();S.editVal.scale=el.dataset.bdScaleBtn;render();}));
  /* Gender btn - coach sidebar */
  qa("[data-set-gender]",el=>el.addEventListener("click",e=>{
    e.stopPropagation();
    const mid=el.dataset.setGender;
    const m=members.find(x=>x.id===mid);
    if(!m)return;
    const next=m.gender==="male"?"female":m.gender==="female"?"":"male";
    fbUpdate("members/"+mid,{gender:next});
  }));
  // 드롭다운 성별 선택
  qa("[data-select-gender]",el=>el.addEventListener("change",e=>{
    e.stopPropagation();
    const label=el.value==="male"?"남성":el.value==="female"?"여성":"미설정";
    fbUpdate("members/"+el.dataset.selectGender,{gender:el.value});
    showToast("성별이 "+label+"으로 변경됐어요");
  }));
  // 드롭다운 상태 선택
  qa("[data-select-dormant]",el=>el.addEventListener("change",e=>{
    e.stopPropagation();
    const label=el.value==="1"?"휴면":"활성";
    fbUpdate("members/"+el.dataset.selectDormant,{dormant:el.value==="1"});
    showToast("상태가 "+label+"으로 변경됐어요");
  }));

  /* PWA install */
  on("install-btn","click",doInstall);
}

/* ══ ACTIONS ══ */
function doLogin() {
  const el=document.getElementById("inp-pin"); const v=el?el.value:S.pin;
  if(v===PIN){S.view="coach";S.coachSection="menu";S.pin="";S.pinErr=false;S.pinModal=false;try{localStorage.setItem("mt_coach_logged","1");}catch{}render();}
  else{S.pinErr=true;render();setTimeout(()=>document.getElementById("inp-pin")?.focus(),50);}
}

function doSaveRecord(mid,wid,wtype) {
  const scaleEl=document.getElementById("inp-escale"); const scale=(scaleEl?scaleEl.value:S.editVal.scale).trim();
  const wod=WODS.find(w=>w.id===wid);
  const t = wtype || wod?.type || "time";
  let value = "";

  if (t === "time") {
    const min=parseInt(document.getElementById("inp-min")?.value??S.timeVal.min)||0;
    const sec=parseInt(document.getElementById("inp-sec")?.value??S.timeVal.sec)||0;
    if(min===0&&sec===0)return;
    value=`${min}'${String(sec).padStart(2,"0")}"`;
  } else if (t === "weight") {
    const w=document.getElementById("inp-weight")?.value||S.editVal.value;
    if(!w||parseFloat(w)===0)return;
    value=`${parseFloat(w)}kg`;
  } else if (t === "rounds") {
    const r=document.getElementById("inp-rounds")?.value||"";
    const extra=document.getElementById("inp-reps-extra")?.value||"";
    if(!r)return;
    value = extra ? r+"R+"+extra : r+"R";
  } else {
    const r=document.getElementById("inp-reps")?.value||S.editVal.value;
    if(!r)return;
    value=`${r}회`;
  }

  // render() 전에 existing 캡처
  const existing = members.find(m=>m.id===mid)?.records[wid];
  const newRecord = {value, scale, date:today()};
  // 기존 기록이 있으면 반드시 history에 추가
  let history = existing?.history ? [...existing.history] : [];
  if (existing?.value) {
    history = [...history, {value:existing.value, scale:existing.scale||"", date:existing.date}];
  }
  fbSet(`members/${mid}/records/${wid}`, {...newRecord, history});

  S.editing=null;S.timeVal={min:"",sec:""};S.editVal={value:"",scale:""};render();
  showToast(`${wod?.name??"WOD"} 기록 저장 완료!`);
}

function doAddProfileMember() {
  const name = (document.getElementById("inp-profile-name")?.value || S.profileNewName || "").trim();
  if (!name) { S.profileNameErr = "이름을 입력해주세요"; render(); return; }
  if (members.find(m=>m.name===name)) { S.profileNameErr = "이미 있는 이름이에요"; render(); return; }
  const gender = S.profileGender || "";
  fbPush("members", {name, records:{}, avatar:null, gender, dormant:false}).then(ref => {
    try{localStorage.setItem("mt_last_member", ref.key);}catch(e){}
    S.profileModal = false;
    S.profileNewName = "";
    S.profileNameErr = "";
    S.activeMemberId = ref.key;
    S.view = "member";
    S.memberTab = "my";
    render();
    showToast(name+"님 환영해요! 🎉");
  });
}

function doAddMember() {
  const name=(document.getElementById("inp-newname")?.value||S.newName).trim();
  if(!name)return;
  fbPush("members",{name,records:{}});
  S.addingMember=false;S.newName="";
}

function doRegisterNext() {
  const nameEl = document.getElementById("inp-register-name");
  const name = (nameEl?.value || S.registerName).trim();
  if (!name) { S.registerErr="이름을 입력해주세요"; render(); return; }
  // 중복 체크 — 이미 등록된 회원이면 바로 입장
  const dup = members.find(m => m.name === name);
  if (dup) {
    S.registerModal=false; S.registerName=""; S.registerErr="";
    S.activeMemberId=dup.id; S.memberTab="my"; S.view="member";
    saveLastMember(dup.id); render(); return;
  }
  S.registerName = name;
  S.registerStep = 2;
  render();
}

function doRegisterMember() {
  const name = S.registerName.trim();
  if (!name) return;
  const avatarIdx = S.registerAvatar;
  const data = avatarIdx !== null ? {name, records:{}, avatar:avatarIdx} : {name, records:{}};
  fbPush("members", data).then(ref=>{
    S.registerModal=false; S.registerName=""; S.registerErr=""; S.registerAvatar=null; S.registerStep=1;
    S.activeMemberId=ref.key; S.memberTab="my"; S.view="member";
    saveLastMember(ref.key);
    render();
    showToast(`${name}님 환영해요! 🎉`);
  });
}

function doRename() {
  const name=(document.getElementById("inp-rename")?.value||S.editingMember?.name||"").trim();
  if(!name||!S.editingMember)return;
  fbUpdate(`members/${S.editingMember.id}`,{name});
  S.editingMember=null;
  showToast("이름이 변경됐어요");
}

function doDeleteMember(id) {
  const m = members.find(x=>x.id===id);
  fbRemove(`members/${id}`);
  if(S.panelId===id) S.panelId=null;
  S.confirmDelete=null;
  showToast((m?.name||"회원")+" 삭제됐어요");
}

/* WOD actions */
function doAddWod() {
  const name=(document.getElementById("wod-inp-name")?.value||S.wodFormVal.name).trim();
  const detail=(document.getElementById("wod-inp-detail")?.value||S.wodFormVal.detail).trim();
  if(!name)return;
  const youtube=(document.getElementById("wod-inp-youtube")?.value||S.wodFormVal.youtube||"").trim();
  const maxId=WODS.length>0?Math.max(...WODS.map(w=>w.id)):0;
  const newId=maxId+1;
  const group = S.wodFormVal.group || "WOD";
  const type  = S.wodFormVal.type  || "time";
  fbSet(`wods/${newId}`,{name,detail,group,type,youtube});
  S.showWodForm=false;S.wodFormVal={name:"",detail:""};
  showToast(`WOD ${newId} 추가됐어요!`);
}

function doEditWod() {
  const name=(document.getElementById("wod-edit-name")?.value||S.editingWod?.name||"").trim();
  const detail=(document.getElementById("wod-edit-detail")?.value||S.editingWod?.detail||"").trim();
  const group=S.editingWod?.group||"WOD";
  if(!name||!S.editingWod)return;
  const type = S.editingWod?.type || "time";
  const youtube = (document.getElementById("wod-edit-youtube")?.value || S.editingWod?.youtube || "").trim();
  fbSet(`wods/${S.editingWod.id}`,{name,detail,group,type,youtube});
  S.editingWod=null;showToast("WOD가 수정됐어요!");
}

function doDeleteWod(id) {
  if(WODS.length<=1){showToast("WOD는 최소 1개 필요해요");return;}
  fbRemove(`wods/${id}`);
  // 해당 WOD 기록도 정리 (id를 문자열로도 비교)
  members.forEach(m=>{
    const strId = String(id);
    if(m.records[id] || m.records[strId]) fbRemove(`members/${m.id}/records/${id}`);
  });
  showToast("WOD가 삭제됐어요");
}

/* PWA install */
let deferredPrompt=null;
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;showInstallBanner();});
function showInstallBanner(){
  if(document.getElementById("install-banner"))return;
  const b=document.createElement("div");b.id="install-banner";
  b.style.cssText="position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1A1A2E;color:#fff;padding:12px 18px;border-radius:14px;display:flex;align-items:center;gap:12px;z-index:9000;box-shadow:0 8px 32px rgba(0,0,0,.25);font-family:inherit;white-space:nowrap;font-size:14px;font-weight:600;";
  b.innerHTML=`<span style="font-size:18px">📲</span><span>홈 화면에 추가하기</span><button id="install-btn" style="background:#3182F6;border:none;color:#fff;border-radius:8px;height:36px;padding:0 14px;font-size:14px;font-weight:700;cursor:pointer;">추가</button><button onclick="this.parentElement.remove()" style="background:none;border:none;color:#8B95A1;font-size:18px;cursor:pointer;min-height:44px;padding:0 2px;">×</button>`;
  document.body.appendChild(b);
}
async function doInstall(){
  if(!deferredPrompt)return;
  deferredPrompt.prompt();const{outcome}=await deferredPrompt.userChoice;deferredPrompt=null;document.getElementById("install-banner")?.remove();
}
