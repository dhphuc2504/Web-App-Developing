import React, {useEffect, useRef, useState} from 'react';

export const nav = path => { window.location.hash = path; };
export const route = () => decodeURI(window.location.hash.slice(1) || '/');
export const media = (p,v='thumb') => '/api/photos/'+p.id+'/media/'+v+'?v='+p.revision;
export function ResponsivePhoto({photo,sizes,fallback='thumb',...props}) {
  const seen = new Set();
  const candidates = [];
  for (const name of ['thumb','medium','preview']) {
    const width = photo.variant_widths?.[name];
    if (width && !seen.has(width)) {
      candidates.push(media(photo,name)+' '+width+'w');
      seen.add(width);
    }
  }
  return <img {...props} sizes={sizes} srcSet={candidates.join(', ') || undefined} src={media(photo,fallback)}/>;
}

export async function api(path,options={}) {
  const response = await fetch('/api'+path,options);
  if (!response.ok) {
    const data = await response.json().catch(()=>({}));
    throw new Error(data.error || 'Unable to reach the gallery.');
  }
  return response.status===204 ? null : response.json();
}
export const json = (method,body) => ({method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
export function useData(path) {
  const [version,setVersion] = useState(0);
  const [state,setState] = useState({value:null,error:'',loading:true});
  useEffect(()=>{
    const controller = new AbortController();
    setState({value:null,error:'',loading:true});
    api(path,{signal:controller.signal}).then(value=>setState({value,error:'',loading:false}))
      .catch(e=>{if(!controller.signal.aborted)setState({value:null,error:e.message,loading:false});});
    return ()=>controller.abort();
  },[path,version]);
  return {...state,retry:()=>setVersion(v=>v+1)};
}
export function Icon({name,size=20}) {
  const paths = {
    search:'M16 10a6 6 0 1 1-12 0 6 6 0 1 1 12 0m-2 4 6 6',
    aperture:'M8 3.8 14.5 3l5.4 4.4 1 6.8-4.4 5.7-6.8 1-5.6-4.3-1.2-6.8z M8 3.8l4.8 8.2 M19.9 7.4h-9 M16.5 19.9l-4.6-8 M4.1 16.6l4.6-8 M9.7 20.9l4.7-8 M20.9 14.2h-9.4',
    arrow:'M5 12h14m-6-6 6 6-6 6',up:'M5 19 19 5M6 5h13v13',down:'M6 6l12 12m-12 0h12V6',
    left:'m15 5-7 7 7 7',right:'m9 5 7 7-7 7',shuffle:'m3 5 4 0 10 14h4m-4-4 4 4-4 3 M3 19h4l3-4m4-7 3-3h4m-4-3 4 3-4 4',
    user:'M16 8a4 4 0 1 1-8 0 4 4 0 1 1 8 0M4 21v-2a8 8 0 0 1 16 0v2',
    camera:'M3 7h4l2-3h6l2 3h4v13H3z M16 13a4 4 0 1 1-8 0 4 4 0 1 1 8 0',
    plus:'M12 4v16M4 12h16',close:'m5 5 14 14M19 5 5 19',upload:'M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5',
    edit:'M4 20l4-1 12-12-3-3L5 16z',rotate:'M5 8a8 8 0 1 1-1 7M4 3v6h6',
    spark:'m12 2 2.4 7.6L21 12l-6.6 2.4L12 22l-2.4-7.6L3 12l6.6-2.4z',
    play:'m8 4 12 8-12 8z',pause:'M8 5v14M16 5v14',film:'M3 4h18v16H3z M7 4v16m10-16v16',
    lock:'M6 11h12v10H6z M8 11V7a4 4 0 0 1 8 0v4',eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M15 12a3 3 0 1 1-6 0 3 3 0 1 1 6 0',
    grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z'
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/></svg>;
}
export function Notice({children}) { return children ? <p className="notice" role="alert">{children}</p> : null; }
export function Loading(){return <p className="status" role="status">Developing frames…</p>;}
export function Modal({title,children,close}) {
  const ref=useRef(null);
  useEffect(()=>{const d=ref.current;d.showModal();return ()=>d.close();},[]);
  return <dialog ref={ref} aria-label={title} onCancel={e=>{e.preventDefault();close();}} onClick={e=>{if(e.target===ref.current)close();}}>
    <div className="modal-inner"><div className="row"><h2>{title}</h2><button type="button" className="icon" aria-label="Close dialog" onClick={close}><Icon name="close"/></button></div>{children}</div>
  </dialog>;
}
export function PhotoTile({photo,index,choose}) {
  return <a className="tile" href={'#/'+(choose?'edit/':'photo/')+photo.id}>
    <div className="tile-image"><ResponsivePhoto photo={photo} loading="lazy" sizes="auto, (max-width: 800px) 45vw, (max-width: 1540px) 30vw, 450px" alt={photo.title}/>{photo.owner&&<span className="visibility"><Icon name={photo.public?'eye':'lock'} size={14}/>{photo.public?'Public':'Private'}</span>}</div>
    <div className="tile-caption"><div><strong>{photo.title}</strong><small>@{photo.username}</small></div><span className="frame-number">{String(index+1).padStart(2,'0')}</span></div>
  </a>;
}
