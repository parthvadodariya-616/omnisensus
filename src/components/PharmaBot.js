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
  const normalizeRole = (value) => {
    const r = String(value || '').trim().toLowerCase();
    if (r === 'doctor' || r === 'dr' || r === 'clinician' || r === 'physician' || r === 'admin') return 'doctor';
    return 'patient';
  };
  const activeRole = normalizeRole((context === 'doctor' ? 'doctor' : null) || user?.role || user?.user_role || context);
  const isDoctor = activeRole === 'doctor';

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior:'smooth' });
  }, [msgs, typing]);

  const readStoredJson = (key) => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const writeStoredJson = (key, value) => {
    if (typeof window === 'undefined' || value === undefined || value === null) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  };

  const pickVitalsFromRun = (run) => {
    if (!run || typeof run !== 'object') return null;
    const keys = [
      'glucose', 'hba1c', 'egfr', 'blood_pressure_sys', 'blood_pressure_dia',
      'blood_pressure', 'bmi', 'creatinine', 'cholesterol_total', 'heart_rate',
      'spo2', 'ldl', 'hdl', 'triglycerides'
    ];

    const out = {};
    keys.forEach((k) => {
      if (run[k] !== undefined && run[k] !== null) out[k] = run[k];
    });
    return Object.keys(out).length > 0 ? out : null;
  };

  const asObject = (value) => (
    value && typeof value === 'object' && !Array.isArray(value) ? value : null
  );

  const unwrapPayload = (payload) => {
    const root = asObject(payload);
    if (!root) return null;
    return asObject(root.data) || root;
  };

  const extractHistoryFromPayload = (payload) => {
    const p = unwrapPayload(payload);
    if (!p) return null;
    if (Array.isArray(p.history)) return p.history;
    if (Array.isArray(p.scores)) return p.scores;
    if (Array.isArray(p.runs)) return p.runs;
    if (Array.isArray(p.visits)) return p.visits;
    return null;
  };

  const extractProfileFromPayload = (payload) => {
    const p = unwrapPayload(payload);
    if (!p) return null;
    return asObject(p.profile) || asObject(p.patient_info) || asObject(p.patientInfo) || asObject(p.patient) || null;
  };

  const normalizeMlResult = (run) => {
    const obj = asObject(run);
    if (!obj) return null;

    const out = { ...obj };
    if (!asObject(out.raw_risks)) {
      const heart = out.heart_pct ?? out.heart_risk_pct;
      const diabetes = out.diabetes_pct ?? out.diabetes_risk_pct;
      const kidney = out.kidney_pct ?? out.kidney_risk_pct;
      if (heart !== undefined || diabetes !== undefined || kidney !== undefined) {
        out.raw_risks = {
          heart_pct: heart ?? 0,
          diabetes_pct: diabetes ?? 0,
          kidney_pct: kidney ?? 0,
        };
      }
    }

    if (!asObject(out.domain_scores)) {
      const cv = out.cardiovascular;
      const mt = out.metabolic;
      const rn = out.renal;
      if (cv !== undefined || mt !== undefined || rn !== undefined) {
        out.domain_scores = {
          cardiovascular: cv,
          metabolic: mt,
          renal: rn,
        };
      }
    }

    return out;
  };

  const attachRunExtras = (payload, run) => {
    const p = unwrapPayload(payload);
    const base = asObject(run);
    if (!p || !base) return base;

    const out = { ...base };
    if (!Array.isArray(out.clinical_flags) && Array.isArray(p.flags)) {
      out.clinical_flags = p.flags;
    }

    if (!out.ai_insights && Array.isArray(p.insights)) {
      const map = {};
      p.insights.forEach((row) => {
        if (!row || typeof row !== 'object') return;
        const key = row.feature_name || row.feature || row.name;
        const val = row.shap_value ?? row.value;
        if (!key || val === undefined || val === null) return;
        map[key] = val;
      });
      if (Object.keys(map).length > 0) out.ai_insights = map;
    }

    return out;
  };

  const extractLatestRunFromPayload = (payload) => {
    const p = unwrapPayload(payload);
    if (!p) return null;

    const latest = asObject(p.latest_run) || asObject(p.latestRun) || asObject(p.run);
    if (latest) return normalizeMlResult(latest);

    if (Array.isArray(p.runs) && p.runs.length > 0) {
      const last = p.runs[p.runs.length - 1];
      return normalizeMlResult(last);
    }

    if (Array.isArray(p.visits) && p.visits.length > 0) {
      const lastVisit = p.visits[0];
      return normalizeMlResult(lastVisit);
    }

    return null;
  };

  const extractVitalsFromPayload = (payload) => {
    const p = unwrapPayload(payload);
    if (!p) return null;

    const direct = asObject(p.vitals) || asObject(p.latest_vitals) || asObject(p.latestVitals);
    if (direct) return direct;

    return pickVitalsFromRun(p);
  };

  const persistDiagnosticContext = ({ mlResult, vitals, patientInfo, history }) => {
    if (mlResult && typeof mlResult === 'object') {
      writeStoredJson('os_last_ml_result', mlResult);
      writeStoredJson('last_ml_result', mlResult);
      writeStoredJson('ml_result', mlResult);
    }
    if (vitals && typeof vitals === 'object') {
      writeStoredJson('os_last_vitals', vitals);
      writeStoredJson('last_vitals', vitals);
      writeStoredJson('vitals', vitals);
    }
    if (patientInfo && typeof patientInfo === 'object') {
      writeStoredJson('os_last_patient_info', patientInfo);
      writeStoredJson('last_patient_info', patientInfo);
      writeStoredJson('patient_info', patientInfo);
    }
    if (Array.isArray(history)) {
      writeStoredJson('os_last_history', history);
      writeStoredJson('last_history', history);
      writeStoredJson('history', history);
    }
  };

  const bootstrapDiagnosticContext = async (pid) => {
    const empty = { mlResult: null, vitals: null, patientInfo: null, history: null };
    if (!pid) return empty;

    const out = { ...empty };

    try {
      const patientRes = await api.get(`/patients/${encodeURIComponent(pid)}`);
      const latestRun = extractLatestRunFromPayload(patientRes?.data);
      const profile = extractProfileFromPayload(patientRes?.data);
      const history = extractHistoryFromPayload(patientRes?.data);
      const vitals = extractVitalsFromPayload(patientRes?.data) || (latestRun ? pickVitalsFromRun(latestRun) : null);

      if (!out.mlResult && latestRun) out.mlResult = latestRun;
      if (!out.vitals && vitals) out.vitals = vitals;
      if (!out.patientInfo && profile) out.patientInfo = profile;
      if (!Array.isArray(out.history) && Array.isArray(history)) out.history = history;
    } catch {}

    try {
      const latestRes = await api.get(`/diagnostics/patient/${encodeURIComponent(pid)}/latest`);
      const latestRun = attachRunExtras(latestRes?.data, extractLatestRunFromPayload(latestRes?.data));
      const vitals = extractVitalsFromPayload(latestRes?.data) || (latestRun ? pickVitalsFromRun(latestRun) : null);

      if (!out.mlResult && latestRun) out.mlResult = latestRun;
      if (!out.vitals && vitals) out.vitals = vitals;
    } catch {}

    try {
      const [vitalsRes, historyRes] = await Promise.allSettled([
        api.get(`/patients/${encodeURIComponent(pid)}/vitals`),
        api.get(`/patients/${encodeURIComponent(pid)}/history`),
      ]);

      const vitalsPayload = vitalsRes.status === 'fulfilled' ? vitalsRes.value?.data : null;
      const historyPayload = historyRes.status === 'fulfilled' ? historyRes.value?.data : null;

      const latestRun = extractLatestRunFromPayload(historyPayload);
      const vitals = extractVitalsFromPayload(vitalsPayload) || (latestRun ? pickVitalsFromRun(latestRun) : null);
      const history = extractHistoryFromPayload(historyPayload);

      if (!out.mlResult && latestRun) out.mlResult = latestRun;
      if (!out.vitals && vitals) out.vitals = vitals;
      if (!Array.isArray(out.history) && Array.isArray(history)) out.history = history;
    } catch {}

    if (out.mlResult || out.vitals || out.patientInfo || Array.isArray(out.history)) {
      persistDiagnosticContext(out);
      return out;
    }

    return empty;
  };

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
      payload.requester_role = activeRole;
      const contextId = patientId || user?.user_id;
      if (contextId) payload.patient_id = contextId;

      let lastResult =
        readStoredJson('os_last_ml_result') ||
        readStoredJson('last_ml_result') ||
        readStoredJson('ml_result');
      let lastVitals =
        readStoredJson('os_last_vitals') ||
        readStoredJson('last_vitals') ||
        readStoredJson('vitals');
      let lastPatientInfo =
        readStoredJson('os_last_patient_info') ||
        readStoredJson('last_patient_info') ||
        readStoredJson('patient_info');
      let lastHistory =
        readStoredJson('os_last_history') ||
        readStoredJson('last_history') ||
        readStoredJson('history');

      // Bootstrap only in explicit patient context; user_id values often do not map
      // to /patients/{id} endpoints and create noisy 404 calls.
      if ((!lastResult || !lastVitals || !lastPatientInfo || !Array.isArray(lastHistory)) && patientId) {
        const boot = await bootstrapDiagnosticContext(patientId);
        if (!lastResult) lastResult = boot.mlResult;
        if (!lastVitals) lastVitals = boot.vitals;
        if (!lastPatientInfo) lastPatientInfo = boot.patientInfo;
        if (!Array.isArray(lastHistory)) lastHistory = boot.history;
      }

      if (lastResult && typeof lastResult === 'object') payload.ml_result = lastResult;
      if (lastVitals && typeof lastVitals === 'object') payload.vitals = lastVitals;
      if (lastPatientInfo && typeof lastPatientInfo === 'object') payload.patient_info = lastPatientInfo;
      if (Array.isArray(lastHistory) && lastHistory.length > 0) payload.history = lastHistory;

      const res = await api.post('/ml/chat', payload);
      const reply = res.data?.response || res.data?.answer || 'I processed your query. Please provide more specific details for a precise response.';

      // Refresh storage so subsequent prompts always include context.
      persistDiagnosticContext({
        mlResult: payload.ml_result,
        vitals: payload.vitals,
        patientInfo: payload.patient_info,
        history: payload.history,
      });

      await ensureTypingVisible();
      setMsgs(p => [...p, { role:'bot', text:reply, createdAt:Date.now() }]);
    } catch (err) {
      const status = err?.response?.status;

      if (status === 401 || status === 403) {
        await ensureTypingVisible();
        setMsgs(p => [...p, {
          role:'bot',
          text:'Your session has expired. Please sign in again.',
          createdAt:Date.now(),
        }]);
        return;
      }

      // Fallback KB/data-based responses when ML chat is unavailable.
      const m = msg.toLowerCase();
      let reply = isDoctor
        ? 'OmniSensus site assistant is temporarily unavailable. Please retry shortly.'
        : 'I apologize - the OmniSensus site assistant is temporarily unavailable. Please try again shortly.';

      if (m.includes('login') || m.includes('logout') || m.includes('session') || m.includes('token') || m.includes('401') || m.includes('403')) {
        reply = isDoctor
          ? 'If sign-in access is not working, sign out and sign in again with the correct account.'
          : 'For sign-in issues: log out and log in again. If session expired, refresh and re-authenticate.';
      } else if (m.includes('settings') || m.includes('setting') || m.includes('profile setting')) {
        reply = isDoctor
          ? 'Yes, Settings should open from Profile. If not opening, refresh once, sign in again, then open Profile -> Settings.'
          : 'Settings should open from Profile. If not opening, refresh once and sign in again.';
      } else if (m.includes('dashboard') || m.includes('home page')) {
        reply = isDoctor
          ? 'Dashboard should show quick cards and shortcuts. If data looks outdated, refresh and reopen the page.'
          : 'Dashboard should show your latest summary cards. Refresh the page if information looks outdated.';
      } else if (m.includes('report') || m.includes('pdf') || m.includes('download')) {
        reply = isDoctor
          ? 'Reports workflow: run diagnostic first, then open Reports to generate and download the latest PDF.'
          : 'To view reports: open your patient profile, then Reports. If missing, ensure a diagnostic was completed first.';
      } else if (m.includes('diagnostic') || m.includes('diagnose') || m.includes('scan')) {
        reply = isDoctor
          ? 'Diagnostics workflow: select patient, submit vitals, run diagnostic, then review score, flags, triage, and insights.'
          : 'Diagnostics summary appears after scan completion. Open your latest run to review score and recommendations.';
      } else if (m.includes('history') || m.includes('vitals')) {
        reply = isDoctor
          ? 'Patient timeline data is available in the History and Vitals sections of the patient profile.'
          : 'Open your profile and check Vitals/History to see your recent readings and trend.';
      } else if (m.includes('notification')) {
        reply = 'Notifications: open Notifications panel, then mark items read or use mark-all-read action.';
      } else if (m.includes('appointment')) {
        reply = isDoctor
          ? 'Appointments module supports list, create, and status updates (booked/confirmed/completed/cancelled/no_show).'
          : 'Use Appointments to view upcoming visits. Contact your provider for booking or rescheduling if needed.';
      } else if (
        m.includes('what can i access') ||
        m.includes('what can i see') ||
        m.includes('my access') ||
        m.includes('my role') ||
        m.includes('who am i')
      ) {
        reply = isDoctor
          ? 'You are signed in as doctor. You can access your assigned patients, diagnostics, reports, and appointments.'
          : 'You are signed in as patient. You can access your own profile, vitals, reports, appointments, and notifications.';
      }

      if (m.includes('how many patients') || m.includes('patient count') || m.includes('patients do i have')) {
        try {
          if (isDoctor) {
            const list = await api.get('/patients?page=1&page_size=1');
            const total = list?.data?.total ?? list?.data?.count ?? (list?.data?.patients || []).length;
            reply = `Current panel size: ${total} patient${Number(total) === 1 ? '' : 's'} assigned.`;
          } else {
            const me = await api.get('/patients/me');
            const profile = me?.data?.patient || me?.data?.data?.patient || null;
            const total = profile ? 1 : 0;
            reply = `You can access your own profile only. Linked patient profile count: ${total}.`;
          }
        } catch {
          reply = isDoctor
            ? 'Unable to fetch panel count right now. Refresh the Patients list and retry.'
            : 'I could not confirm your profile count right now. Please open Profile and refresh once.';
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
                ? (isDoctor
                  ? `Top clinical risk factors: ${top.join(' | ')}`
                  : `Top risk factors: ${top.join(' | ')}`)
                : (isDoctor
                  ? 'Recent diagnostic flags are present, but concise extraction failed for this payload.'
                  : 'Recent diagnostic flags exist, but I could not parse a concise risk-factor summary.');
            } else {
              reply = isDoctor
                ? 'No high-priority clinical flags were detected in the latest diagnostic run.'
                : 'No high-priority risk factors are flagged in the latest diagnostic run.';
            }
          } catch {
            reply = isDoctor
              ? 'Unable to fetch latest diagnostic flags. Please run/refresh diagnostics and retry.'
              : 'I could not fetch risk factors from the latest diagnostic right now. Please run a fresh diagnostic and try again.';
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
                ? (isDoctor
                  ? `Active medication list: ${names.join(', ')}.`
                  : `Active medications: ${names.join(', ')}.`)
                : (isDoctor
                  ? 'Medication records exist, but medication names are missing in this payload.'
                  : 'Medication records are available, but names are missing in the latest payload.');
            } else {
              reply = 'No active medications are currently listed for this patient.';
            }
          } catch {
            reply = isDoctor
              ? 'Medication data is temporarily unavailable. Verify from the Medications module.'
              : 'Medication data is temporarily unavailable. Please check the Medications page.';
          }
        } else {
          reply = 'Your active medications are managed by your prescribing physician. Always take medications as directed, do not skip doses, and report any adverse effects immediately. For specific drug information, consult your pharmacist.';
        }
      }

      if (m.includes('health score') || m.includes('score'))
        reply = isDoctor
          ? 'Health score is available in the latest diagnostic run summary for each patient. Open Diagnostics or latest run details.'
          : 'You can view your latest health score in your most recent diagnostic summary.';
      else if (m.includes('hba1c') || m.includes('hemoglobin'))
        reply = isDoctor
          ? 'Use patient Vitals/History to review HbA1c trends and latest values.'
          : 'You can find HbA1c readings in your Vitals and History sections.';
      else if (m.includes('egfr') || m.includes('kidney') || m.includes('renal'))
        reply = isDoctor
          ? 'Use patient Vitals and diagnostic trend views to monitor renal markers such as eGFR.'
          : 'Kidney-related values like eGFR are visible in your Vitals and diagnostic history.';
      else if (m.includes('blood pressure') || m.includes('bp') || m.includes('hypertension'))
        reply = isDoctor
          ? 'Blood pressure values can be checked in latest vitals and visit history for each patient.'
          : 'Blood pressure readings are available in your Vitals and History pages.';
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

  const PILLS = isDoctor
    ? ['How many patients do I have right now?', 'How to run diagnostic for a patient?', 'Where can I download the latest report?', 'Why is my access not working?']
    : ['What can I access with my account?', 'How do I view my latest report?', 'How can I check my vitals history?', 'How can I mark notifications as read?'];

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
            <div className="chat-header__status">{typing ? 'Typing...' : 'AI Medical Assistant - Online'}</div>
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
