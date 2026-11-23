import React,{useEffect,useState} from 'react';
import {api,Icon,Loading,ResponsivePhoto,Notice,PhotoTile} from './common.jsx';

import {PhotoCrystal} from './Scene.jsx';

function Spotlight({photos}) {
  const users=[...new Set(photos.map(p=>p.owner_id))];
  const [index,setIndex]=useState(0),[frame,setFrame]=useState(0);
  const id=users[index%users.length], roll=photos.filter(p=>p.owner_id===id);
  const current=roll[frame%roll.length];
  function nextUser(d){setIndex(i=>(i+d+users.length)%users.length);setFrame(0);}
  return <section className="spotlight">
    <div className="spot-copy"><span className="kicker"><i/> PHOTOGRAPHER SPOTLIGHT</span><h2>@{current.username}</h2>
      <p>{roll.length} featured {roll.length===1?'frame':'frames'} in this roll</p>
      <a className="text-link" href={'#/artist/'+id}>View public gallery <Icon name="up" size={16}/></a>
      {users.length>1&&<div className="pager"><button aria-label="Previous photographer" className="icon" onClick={()=>nextUser(-1)}><Icon name="left"/></button>
      <span>{index%users.length+1} / {users.length}</span><button aria-label="Next photographer" className="icon" onClick={()=>nextUser(1)}><Icon name="right"/></button></div>}
    </div>
    <div className="stack-wrap"><div className="stack">
      {roll.length>1&&<div className="print backprint"><ResponsivePhoto photo={roll[(frame+1)%roll.length]} sizes="(max-width: 540px) 55vw, min(34vw, 360px)" alt=""/></div>}
      <div className="print topprint" key={current.id}><a href={'#/photo/'+current.id}><ResponsivePhoto photo={current} sizes="(max-width: 540px) 55vw, min(34vw, 360px)" alt={current.title}/></a>
      <div className="row"><strong>{current.title}</strong>{roll.length>1&&<button className="text-link" onClick={()=>setFrame(f=>f+1)}>Flip <Icon name="right" size={14}/></button>}</div></div>
    </div></div>
  </section>;
}

export default function Discover({moving}) {
  const [photos,setPhotos]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(true);
  const [step,setStep]=useState(0);
  const paused=!moving;
  const [reload,setReload]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    async function load(){
      try {const result=await api('/discover',{signal:controller.signal});setPhotos(result);setError('');}
      catch(e){if(!controller.signal.aborted)setError(e.message);}
      finally{if(!controller.signal.aborted)setBusy(false);}
    }
    load();
    return ()=>controller.abort();
  },[reload]);
  useEffect(()=>{
    if(paused)return;
    const interval=setInterval(()=>setReload(value=>value+1),60000);
    return ()=>clearInterval(interval);
  },[paused]);
  useEffect(()=>{if(paused||photos.length<=1)return;const t=setInterval(()=>setStep(i=>i+1),5100);return ()=>clearInterval(t);},[paused,photos.length]);
  return <>
    <div className={'hero '+(paused?'paused':'')}>
      <div className="hero-copy"><div className="hero-kicker"><span/> COMMUNITY PHOTO GALLERY</div>
      <h1>Frames in<br/><em>motion.</em></h1>
      <p>A changing collection of public photographs<br className="wide"/> from the Stillroom community.</p>
      <button className="button acid" onClick={()=>document.getElementById('public-roll')?.scrollIntoView({behavior:paused?'instant':'smooth'})}>Explore the roll <Icon name="down" size={17}/></button></div>
      <PhotoCrystal photos={photos} step={step}/>
      <div className="hero-foot"><span><b className="live-dot"/> PUBLIC ROLL</span><span>{String(photos.length?step%photos.length+1:0).padStart(2,'0')} / {String(photos.length).padStart(2,'0')}</span></div>
    </div>
    <Notice>{error}</Notice>{error&&<button className="button" onClick={()=>setReload(r=>r+1)}>Retry</button>}
    {!!photos.length&&<Spotlight photos={photos}/>}
    <section className="section" id="public-roll"><div className="section-line"><div><span className="kicker"><i/> DISCOVER</span><h2>The public roll<span>.</span></h2></div>
      <button className="button outline" onClick={()=>setReload(r=>r+1)}><Icon name="shuffle" size={16}/> Shuffle roll</button></div>
      {busy?<Loading/>:photos.length?<div className="grid">{photos.map((p,i)=><PhotoTile key={p.id} photo={p} index={i}/>)}</div>:!error&&<p>No public photos yet. Publish a frame from your gallery to start the roll.</p>}
    </section>
  </>;
}
