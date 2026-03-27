// src/app/patients/settings/page.js  (copy to patients/settings/page.js too)
'use client';
import { useState } from 'react';
import { getUser } from '@/lib/auth';
export default function Settings() {
  const user = getUser();
  const [saved, setSaved] = useState(false);
  const save = () => { setSaved(true); setTimeout(() => setSaved(false), 2500); };
  return (
    <div className="wrap">
      <div className="sh"><div><h2>Settings</h2><p>Manage your account preferences</p></div></div>
      <div className="card" style={{marginBottom:16}}>
        <div style={{padding:'14px 20px',borderBottom:'1px solid var(--border)',fontSize:13,fontWeight:700,color:'var(--text-900)'}}>Profile Information</div>
        <div className="card-pad">
          {[['Username',user?.username||'—',true],['Email',user?.email||'—',false],['Full Name',user?.name||'—',false]].map(([l,v,d])=>(
            <div key={l} className="field" style={{marginBottom:12}}>
              <label className="f-label">{l}</label>
              <input defaultValue={v} disabled={d} className="f-input" style={{opacity:d?0.6:1,cursor:d?'not-allowed':'text'}}/>
            </div>
          ))}
        </div>
      </div>
      <div className="card" style={{marginBottom:16}}>
        <div style={{padding:'14px 20px',borderBottom:'1px solid var(--border)',fontSize:13,fontWeight:700,color:'var(--text-900)'}}>Security</div>
        <div className="card-pad">
          {[['Current Password','password'],['New Password','password'],['Confirm Password','password']].map(([l,t])=>(
            <div key={l} className="field" style={{marginBottom:12}}>
              <label className="f-label">{l}</label>
              <input type={t} defaultValue="" className="f-input" placeholder="••••••••"/>
            </div>
          ))}
        </div>
      </div>
      <div className="card" style={{marginBottom:20}}>
        <div style={{padding:'14px 20px',borderBottom:'1px solid var(--border)',fontSize:13,fontWeight:700,color:'var(--text-900)'}}>Preferences</div>
        <div className="card-pad">
          {[['Email notifications',true],['Push alerts',true],['Session timeout warnings',true]].map(p=>(
            <div key={p[0]} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 0',borderBottom:'1px solid var(--border-l)'}}>
              <span style={{fontSize:13,color:'var(--text-700)'}}>{p[0]}</span>
              <div style={{width:36,height:20,borderRadius:10,background:p[1]?'var(--teal)':'var(--border)',position:'relative',cursor:'pointer'}}>
                <div style={{position:'absolute',top:2,left:p[1]?'auto':2,right:p[1]?2:'auto',width:16,height:16,borderRadius:'50%',background:'white',boxShadow:'0 1px 3px rgba(0,0,0,0.2)'}}></div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{display:'flex',justifyContent:'flex-end',gap:10}}>
        <button className="btn btn-ghost">Cancel</button>
        <button className="btn btn-primary" onClick={save} style={{minWidth:130}}>{saved ? '✓ Saved' : 'Save Changes'}</button>
      </div>
    </div>
  );
}
