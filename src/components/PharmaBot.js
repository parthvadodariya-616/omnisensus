// src/components/PharmaBot.js
'use client';
import { useState, useEffect, useRef } from 'react';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';

export default function PharmaBot({ patientId = null, context = 'general' }) {
  const [open,     setOpen]     = useState(false);
  const [msgs,     setMsgs]     = useState([
    { role:'bot', text:'Hello! I\'m the OmniSensus Pharma-Bot. I can help you with health scores, medications, risk factors, diagnostic interpretations, and medical queries. How can I help?', createdAt:null }
  ]);
  const [input,    setInput]    = useState('');
  const [typing,   setTyping]   = useState(false);
  const [unread,   setUnread]   = useState(1);
  const [hydrated, setHydrated] = useState(false);
  const bottomRef  = useRef();
  const sessionId  = useRef(`session-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const user       = getUser();

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior:'smooth' });
  }, [msgs, typing]);

  const send = async (text) => {
    const msg = (text || input).trim();
    if (!msg) return;
    setInput('');
    setMsgs(p => [...p, { role:'user', text:msg, createdAt:Date.now() }]);
    setTyping(true);
    const typingSince = Date.now();
    const ensureTypingVisible = async () => {
      const minVisibleMs = 800;
      const remaining = minVisibleMs - (Date.now() - typingSince);
      if (remaining > 0) {
        await new Promise(resolve => setTimeout(resolve, remaining));
      }
    };

    try {
      const payload = { prompt: msg, session_id: sessionId.current };
      if (patientId) payload.patient_id = patientId;
      else if (user?.user_id) payload.patient_id = user.user_id;

      const res = await api.post('/ml/chat', payload);
      const reply = res.data?.response || res.data?.answer || 'I processed your query. Please provide more specific details for a precise response.';
      await ensureTypingVisible();
      setMsgs(p => [...p, { role:'bot', text:reply, createdAt:Date.now() }]);
    } catch (err) {
      const status = err?.response?.status;

      if (status === 401 || status === 403) {
        await ensureTypingVisible();
        setMsgs(p => [...p, {
          role:'bot',
          text:'Your session has expired or is unauthorized. Please sign in again to use AI features.',
          createdAt:Date.now(),
        }]);
        return;
      }

      // Fallback KB/data-based responses when ML chat is unavailable.
      const m = msg.toLowerCase();
      let reply = 'I apologize — the AI service is temporarily unavailable. Please try again shortly or contact your healthcare provider directly.';

      if (m.includes('how many patients') || m.includes('patient count') || m.includes('patients do i have')) {
        try {
          const list = await api.get('/patients?page=1&page_size=1');
          const total = list?.data?.total ?? list?.data?.count ?? (list?.data?.patients || []).length;
          reply = `You currently have ${total} patient${Number(total) === 1 ? '' : 's'} assigned.`;
        } catch {
          reply = 'I could not fetch your patient count right now. Please open the Patients page and refresh once.';
        }
      } else if (m.includes('risk factor') || m.includes('risk factors')) {
        const pid = patientId || user?.user_id;
        if (!pid) {
          reply = 'Please open a specific patient context first so I can summarize their risk factors.';
        } else {
          try {
            const latest = await api.get(`/diagnostics/patient/${pid}/latest`);
            const flags = latest?.data?.flags || [];
            if (flags.length > 0) {
              const top = flags.slice(0, 3).map(f => f.message || f.msg || f.flag_message).filter(Boolean);
              reply = top.length > 0
                ? `Top risk factors: ${top.join(' | ')}`
                : 'Recent diagnostic flags exist, but I could not parse a concise risk-factor summary.';
            } else {
              reply = 'No high-priority risk factors are flagged in the latest diagnostic run.';
            }
          } catch {
            reply = 'I could not fetch risk factors from the latest diagnostic right now. Please run a fresh diagnostic and try again.';
          }
        }
      } else if (m.includes('medication') || m.includes('drug') || m.includes('medicine')) {
        const pid = patientId || user?.user_id;
        if (pid) {
          try {
            const medsRes = await api.get(`/patients/${pid}/medications`);
            const meds = medsRes?.data?.medications || [];
            if (meds.length > 0) {
              const names = meds.slice(0, 4).map(x => x.name).filter(Boolean);
              reply = names.length > 0
                ? `Active medications: ${names.join(', ')}.`
                : 'Medication records are available, but names are missing in the latest payload.';
            } else {
              reply = 'No active medications are currently listed for this patient.';
            }
          } catch {
            reply = 'Medication data is temporarily unavailable. Please check the Medications page.';
          }
        } else {
          reply = 'Your active medications are managed by your prescribing physician. Always take medications as directed, do not skip doses, and report any adverse effects immediately. For specific drug information, consult your pharmacist.';
        }
      }

      if (m.includes('health score') || m.includes('score'))
        reply = 'Your health score is a composite index (0–100) calculated from cardiovascular, metabolic, and renal biomarkers. Scores ≥70 indicate Stable health, 50–69 Borderline risk, and <50 Critical risk requiring immediate clinical review.';
      else if (m.includes('hba1c') || m.includes('hemoglobin'))
        reply = 'HbA1c reflects average blood glucose over 2–3 months. Normal: <5.7% | Pre-diabetes: 5.7–6.4% | Diabetes: ≥6.5%. Values ≥8% indicate poor glycaemic control requiring medication review.';
      else if (m.includes('egfr') || m.includes('kidney') || m.includes('renal'))
        reply = 'eGFR measures kidney filtration capacity. Normal: ≥90 mL/min | Mild CKD: 60–89 | Moderate: 30–59 | Severe: 15–29 | Kidney failure: <15. Low eGFR requires nephrology consultation.';
      else if (m.includes('blood pressure') || m.includes('bp') || m.includes('hypertension'))
        reply = 'Normal BP: <120/80 mmHg | Elevated: 120–129/<80 | Stage 1 HTN: 130–139/80–89 | Stage 2 HTN: ≥140/≥90. Persistent elevation requires antihypertensive therapy and lifestyle modification.';
      else if (m.includes('appointment'))
        reply = 'You can view your upcoming appointments in the Appointments section. For scheduling or cancellations, please contact your healthcare provider directly.';
      await ensureTypingVisible();
      setMsgs(p => [...p, { role:'bot', text:reply, createdAt:Date.now() }]);
    } finally { setTyping(false); }
  };

  const clear = async () => {
    try { await api.post('/ml/chat/clear', { session_id: sessionId.current }); } catch {}
    sessionId.current = `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setMsgs([{ role:'bot', text:'Session cleared. How can I help you?', createdAt:Date.now() }]);
  };

  const PILLS = context === 'doctor'
    ? ['Explain risk scores', 'Medication protocols', 'Diagnostic interpretation', 'Triage guidelines']
    : ['What does my score mean?', 'Explain my medications', 'My risk factors', 'When is my next appointment?'];

  const fmt = (createdAt) => {
    if (!hydrated || !createdAt) return '';
    return new Intl.DateTimeFormat('en-US', { hour:'2-digit', minute:'2-digit', hour12:true })
      .format(new Date(createdAt))
      .replace('am', 'AM')
      .replace('pm', 'PM');
  };

  return (
    <>
      <button className="chat-fab" onClick={() => { setOpen(!open); if (!open) setUnread(0); }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        {unread > 0 && <span className="chat-fab__badge">{unread}</span>}
      </button>

      <div className={`chat-window${open?' open':''}`}>
        <div className="chat-header">
          <div className="chat-header__avatar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <div>
            <div className="chat-header__name">OmniSensus Pharma-Bot</div>
            <div className="chat-header__status">{typing ? 'Typing...' : 'AI Medical Assistant · Online'}</div>
          </div>
          <div style={{marginLeft:'auto', display:'flex', gap:6}}>
            <button onClick={clear} style={{background:'rgba(255,255,255,.15)',border:'none',color:'rgba(255,255,255,.8)',width:26,height:26,borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:10,fontWeight:700}}>
              CLR
            </button>
            <button className="chat-header__close" onClick={() => setOpen(false)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        <div className="chat-messages">
          {msgs.map((m, i) => (
            <div key={i} className={`msg-group msg-group--${m.role}`}>
              <div className="msg-bubble" style={{whiteSpace:'pre-wrap'}}>{m.text}</div>
              <div className="msg-time">{fmt(m.createdAt)}</div>
            </div>
          ))}
          {typing && (
            <div className="msg-group msg-group--bot">
              <div className="typing-indicator">
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
              </div>
            </div>
          )}
          <div ref={bottomRef}/>
        </div>

        <div className="chat-quickpills">
          {PILLS.map(p => (
            <button key={p} className="quick-pill" onClick={() => send(p)}>{p}</button>
          ))}
        </div>

        <div className="chat-input-row">
          <input className="chat-input" placeholder="Ask a medical or health query..."
            value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key==='Enter' && !e.shiftKey && send()}/>
          <button className="chat-send-btn" onClick={() => send()} disabled={typing || !input.trim()}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}
