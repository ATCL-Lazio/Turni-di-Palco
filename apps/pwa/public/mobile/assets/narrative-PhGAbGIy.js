import{r as v}from"./ai-Ba2ODocp.js";import{aa as I}from"./index-CFHs4MZI.js";const g=new Map;function y(e){for(const t of e)g.set(t.id,t)}function j(e){return g.get(e)??null}function X(e,t){if(e.allowedRoles?.length&&(!t.roleId||!e.allowedRoles.includes(t.roleId)))return!1;if(e.requiresFlags?.length){for(const n of e.requiresFlags)if(!t.flags.has(n))return!1}return!0}function _(e,t){const n=e.requires;if(!n)return{available:!0};if(n.flag&&!t.flags.has(n.flag))return{available:!1,reason:"flag",detail:n.flag};if(n.stat&&n.min!=null){const o=t.stats?.[n.stat];if(o==null||o<n.min)return{available:!1,reason:"stat",detail:`Serve ${n.stat} ≥ ${n.min}`}}return{available:!0}}function z(e){return{currentSceneId:e,history:[],flags:new Set}}function W(e,t,n,o,l=()=>new Date().toISOString()){if(t.id!==e.currentSceneId)throw new Error(`Scene mismatch: state at ${e.currentSceneId}, got scene ${t.id}`);const r=t.choices.find(f=>f.id===n);if(!r)throw new Error(`Choice "${n}" not found in scene "${t.id}"`);const a=_(r,o);if(!a.available)throw new Error(`Choice "${n}" not available: ${a.reason}${a.detail?` (${a.detail})`:""}`);const i=new Set(e.flags);for(const f of r.outcome.setFlags??[])i.add(f);const s=r.outcome.next??null,c=s===null;return{state:{currentSceneId:c?e.currentSceneId:s,history:[...e.history,{sceneId:t.id,choiceId:n,ts:l()}],flags:i},outcome:r.outcome,finished:c}}function w(e){const t=[];if(!e||typeof e!="object")return[{path:"$",message:"scene must be an object"}];const n=e;for(const o of["id","title","setting","prompt"])(typeof n[o]!="string"||!n[o].length)&&t.push({path:`$.${o}`,message:`${o} must be a non-empty string`});if(!Array.isArray(n.choices)||n.choices.length<2||n.choices.length>4)t.push({path:"$.choices",message:"choices must be an array of 2-4 elements"});else{const o=new Set;n.choices.forEach((l,r)=>{const a=l;if(typeof a.id!="string"||!a.id.length?t.push({path:`$.choices[${r}].id`,message:"id required"}):o.has(a.id)?t.push({path:`$.choices[${r}].id`,message:`duplicate choice id "${a.id}"`}):o.add(a.id),(typeof a.label!="string"||!a.label.length)&&t.push({path:`$.choices[${r}].label`,message:"label required"}),!a.outcome||typeof a.outcome!="object")t.push({path:`$.choices[${r}].outcome`,message:"outcome required"});else{const i=a.outcome;(typeof i.text!="string"||!i.text.length)&&t.push({path:`$.choices[${r}].outcome.text`,message:"outcome.text required"}),(!i.rewards||typeof i.rewards!="object")&&t.push({path:`$.choices[${r}].outcome.rewards`,message:"outcome.rewards required"}),i.next!==void 0&&i.next!==null&&typeof i.next!="string"&&t.push({path:`$.choices[${r}].outcome.next`,message:"next must be string|null"})}})}return t}function H(e){const t=w(e);if(t.length)throw new Error(`Invalid narrative scene:
`+t.map(n=>`  ${n.path}: ${n.message}`).join(`
`))}const S="maxwell_",R="tdp-narrative-daily:",A="tdp-narrative-daily-done:",C=12e3;function $(){return new Date().toLocaleDateString("en-CA")}function b(e){return`${R}${e.roleId??"none"}:${$()}`}function E(e){return`${A}${e.roleId??"none"}:${$()}`}function J(e){if(typeof window>"u")return!1;try{return window.localStorage.getItem(E(e))==="true"}catch{return!1}}function G(e){if(!(typeof window>"u"))try{window.localStorage.setItem(E(e),"true")}catch{}}const{xp:{min:u,max:h},cachet:{min:d,max:m}}=I.narrative_scene,M='Sei Maxwell, narratore del gioco teatrale "Turni di Palco". Genera scenari narrativi realistici e coinvolgenti per professionisti del teatro. Rispondi SEMPRE e SOLO con un singolo JSON valido, nessun testo aggiuntivo.';function T(e){const t=e.roleId??"sconosciuto",n=e.stats?`presenza=${e.stats.presence}, precisione=${e.stats.precision}, leadership=${e.stats.leadership}, creatività=${e.stats.creativity}`:"statistiche non disponibili",o=e.flags.size?Array.from(e.flags).join(", "):"nessuno";return`Genera UNO scenario narrativo in italiano per un giocatore con queste caratteristiche:
- Ruolo: ${t}
- Statistiche: ${n}
- Flag attivi: ${o}

Lo scenario deve:
1. Essere ambientato in un teatro durante una serata di spettacolo
2. Presentare una situazione concreta e specifica per il ruolo "${t}"
3. Avere 2-4 scelte con approcci professionali diversi
4. Includere almeno una scelta con requisito di statistica (usa quella più rilevante per il ruolo)

Schema JSON da restituire (nessun testo prima o dopo):
{
  "id": "PLACEHOLDER",
  "title": "Titolo breve (max 40 caratteri)",
  "setting": "Luogo e momento preciso",
  "prompt": "Situazione e decisione (1-2 frasi)",
  "choices": [
    {
      "id": "scelta_1",
      "label": "Testo breve (max 50 caratteri)",
      "requires": { "stat": "NOME_STAT", "min": NUMERO },
      "outcome": {
        "text": "Conseguenza narrativa (1-2 frasi)",
        "rewards": { "xp": NUMERO_${u}_${h}, "cachet": NUMERO_${d}_${m} },
        "next": null
      }
    }
  ]
}

Regole:
- "requires" è opzionale: includilo per scelte che richiedono competenza (min: 60-80)
- Statistiche valide: "presence", "precision", "leadership", "creativity"
- Rewards: scelte con stat alta → xp più alto; xp in [${u}-${h}], cachet in [${d}-${m}]
- "setFlags" opzionale per scelte con impatto narrativo duraturo (snake_case)
- Non usare flag già attivi: ${o}
- id e flag in snake_case`}function N(e){let t=2166136261;for(let n=0;n<e.length;n++)t^=e.charCodeAt(n),t=t*16777619>>>0;return`${S}${t.toString(16).padStart(8,"0")}`}function p(e,t){const n=Math.round(Number(e));return Number.isFinite(n)?n:t}function O(e){return{...e,choices:e.choices.map(t=>({...t,outcome:{...t.outcome,rewards:{xp:Math.min(h,Math.max(u,p(t.outcome.rewards?.xp,u))),cachet:Math.min(m,Math.max(d,p(t.outcome.rewards?.cachet,d))),...t.outcome.rewards?.reputation!=null?{reputation:Math.min(3,Math.max(0,p(t.outcome.rewards.reputation,0)))}:{}}}}))}}function D(e){if(typeof window>"u")return null;try{const t=window.localStorage.getItem(b(e));if(!t)return null;const n=JSON.parse(t);return w(n).length>0?null:n}catch{return null}}function x(e,t){if(!(typeof window>"u"))try{window.localStorage.setItem(b(t),JSON.stringify(e))}catch{}}async function q(e,t){const n=v();if(!n)return null;let o;try{o=await fetch(n,{method:"POST",headers:{"Content-Type":"application/json"},signal:t,body:JSON.stringify({prompt:M,messages:[{role:"user",content:T(e)}],context:{roleId:e.roleId}})})}catch{return null}if(!o.ok)return null;let l;try{l=await o.json()}catch{return null}const r=l,a=typeof r.reply=="string"?r.reply:typeof r.message=="string"?r.message:typeof r.content=="string"?r.content:typeof r.text=="string"?r.text:typeof r.choices?.[0]?.message?.content=="string"?String(r.choices[0].message.content):null;if(!a)return null;const i=a.replace(/^```(?:json)?\n?/,"").replace(/\n?```$/,"").trim();let s;try{s=JSON.parse(i)}catch{return null}if(w(s).length>0)return null;const c=O(s);return c.id=N(i),e.roleId&&(c.allowedRoles=[e.roleId]),c}async function U(e,t,n){const o=g.get(e);if(o)return o;if(!e.startsWith(S))return null;const l=D(t);if(l)return y([l]),l;const r=new AbortController,a=typeof window<"u"?window.setTimeout(()=>r.abort(),C):null,i=n?.signal?(()=>{const s=new AbortController;if(r.signal.aborted||n.signal.aborted)s.abort();else{const c=()=>s.abort();r.signal.addEventListener("abort",c,{once:!0}),n.signal.addEventListener("abort",c,{once:!0})}return s.signal})():r.signal;try{const s=await q(t,i);return a!==null&&window.clearTimeout(a),s?(x(s,t),y([s]),s):null}catch{return a!==null&&window.clearTimeout(a),null}}export{S as M,H as a,J as b,z as c,W as d,_ as e,U as f,X as i,j as l,G as m,y as r};
