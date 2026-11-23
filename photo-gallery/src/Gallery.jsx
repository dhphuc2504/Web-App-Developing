import React,{useEffect,useRef,useState} from 'react';
import {api,Icon,Loading,ResponsivePhoto,Modal,nav,Notice,PhotoTile,json,useData} from './common.jsx';

const pages=new Map();
export const invalidate = ()=>pages.clear();

function Upload({close,done}) {
  const [files,setFiles]=useState([]),[visible,setVisible]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const urls=useRef(new Set());
  useEffect(()=>()=>{for(const url of urls.current)URL.revokeObjectURL(url);},[]);
  function add(list){
    const fresh=Array.from(list), room=5-files.length;
    const valid=fresh.filter(f=>['image/jpeg','image/png','image/webp'].includes(f.type) && f.size<=10*1024*1024);
    const additions=valid.slice(0,room).map(file=>{
      const url=URL.createObjectURL(file);urls.current.add(url);return {file,url};
    });
    setFiles([...files,...additions]);
    setError(valid.length!==fresh.length?'Choose JPEG, PNG or WebP files up to 10 MB each.':valid.length>room?'Only five photos fit in a batch. Your selection is ready below.':'');
  }
  async function submit(e){
    e.preventDefault();if(!files.length||busy)return;
    setBusy(true);setError('');
    const data=new FormData();data.append('public',String(visible));
    files.forEach(f=>data.append('files',f.file));
    try {await api('/photos',{method:'POST',body:data});done();}catch(e){setBusy(false);setError(e.message);}
  }
  return <Modal title="Add photos" close={()=>{if(!busy)close();}}><form onSubmit={submit}>
    <fieldset disabled={busy}><label className="drop" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(!busy)add(e.dataTransfer.files);}}>
      <Icon name="upload" size={28}/><strong>Choose photos or drop them here</strong><small>JPEG, PNG or WebP · 10 MB per photo</small>
      <input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={e=>{add(e.target.files);e.target.value='';}}/></label>
    <div className="upload-list">{files.map(({file,url},i)=><div key={url}><img src={url} alt=""/><span>{file.name}</span><button type="button" className="icon" aria-label={'Remove '+file.name} onClick={()=>{setFiles(files.filter((_,n)=>n!==i));URL.revokeObjectURL(url);urls.current.delete(url);}}><Icon name="close" size={16}/></button></div>)}</div>
    <label className="check"><input type="checkbox" checked={visible} onChange={e=>setVisible(e.target.checked)}/> Make these photos public</label>
    <div className="row"><small>{files.length} of 5 selected</small><button className="button primary" disabled={!files.length||busy}>{busy?'Developing…':'Upload photos'}</button></div>
    </fieldset><Notice>{error}</Notice></form></Modal>;
}

export function Gallery({artist,choose=false}) {
  const path='/photos?'+(artist?'owner='+artist:'scope=mine');
  const [data,setData]=useState(()=>pages.get(path)||null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[show,setShow]=useState(false),[reload,setReload]=useState(0);
  const [success,setSuccess]=useState('');
  useEffect(()=>{
    const controller=new AbortController();
    setData(pages.get(path)||null);setError('');
    if(!pages.has(path))api(path,{signal:controller.signal}).then(d=>{pages.set(path,d);setData(d);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});
    return ()=>controller.abort();
  },[path,reload]);
  async function loadMore(){
    if(busy)return;setBusy(true);setError('');
    try {const next=await api(path+'&cursor='+encodeURIComponent(data.next));const all={items:[...data.items,...next.items],next:next.next};pages.set(path,all);setData(all);}
    catch(e){setError(e.message);}finally{setBusy(false);}
  }
  const title=artist?'@'+(data?.username||data?.items[0]?.username||'Photographer'):choose?'Edit studio':'Your gallery';
  return <section className="workspace"><div className="page-head"><div><span className="kicker"><i/> {artist?'PUBLIC COLLECTION':choose?'DARKROOM':'PERSONAL COLLECTION'}</span><h1>{title}<em>.</em></h1>
    <p>{artist?'Public frames from this photographer.':choose?'Choose a frame to crop or rotate.':'Your photographs, frame by frame.'}</p></div>
    {!artist&&!choose&&<button className="button primary" onClick={()=>setShow(true)}><Icon name="plus" size={17}/> Upload photos</button>}</div>
    <Notice>{error}</Notice>{error&&!data&&<button className="button" onClick={()=>setReload(r=>r+1)}>Retry</button>}
    {success&&<p role="status">{success}</p>}
    {!data&&!error?<Loading/>:data?.items.length?<div className="filmstrip"><div className="film-track">{data.items.map((p,i)=><PhotoTile key={p.id} photo={p} index={i} choose={choose}/>)}</div></div>:
    data&&<div className="empty"><Icon name="film" size={38}/><h2>{artist?'No public frames yet':'Your roll is empty'}</h2>
    {!artist&&<button className="button primary" onClick={()=>setShow(true)}>Upload your first photo</button>}</div>}
    {data?.next&&<div className="center"><button className="button outline" disabled={busy} onClick={loadMore}>{busy?'Loading…':'Load 24 more frames'}</button></div>}
    {show&&<Upload close={()=>setShow(false)} done={()=>{invalidate();setShow(false);setSuccess('Photos added to your gallery.');setReload(r=>r+1);}}/>}
  </section>;
}

export function Detail({id}) {
  const {value:photo,error,loading,retry}=useData('/photos/'+id);
  const [changed,setChanged]=useState(null),[confirm,setConfirm]=useState(false),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const p=changed||photo;
  async function mutate(del=false){
    setBusy(true);setMessage('');
    try {
      if(del){await api('/photos/'+id,{method:'DELETE'});invalidate();nav('/gallery');}
      else{setChanged(await api('/photos/'+id,json('PATCH',{public:!p.public})));invalidate();}
    }catch(e){setMessage(e.message);}finally{setBusy(false);setConfirm(false);}
  }
  if(loading)return <Loading/>;
  if(error)return <><Notice>{error}</Notice><button className="button" onClick={retry}>Retry</button></>;
  return <section className="workspace"><a className="text-link back" href={p.owner?'#/gallery':'#/artist/'+p.owner_id}><Icon name="left" size={15}/> {p.owner?'Your gallery':'Photographer’s gallery'}</a>
    <div className="detail-layout"><div className="lightbox"><ResponsivePhoto photo={p} sizes="(max-width: 800px) 92vw, (max-width: 1540px) 56vw, 860px" fallback="preview" alt={p.title}/></div><aside className="detail-panel">
    <span className="kicker"><i/> FRAME DETAILS</span><h1>{p.title}</h1><a className="text-link" href={'#/artist/'+p.owner_id}>@{p.username} <Icon name="up" size={14}/></a>
    <dl>{[['Dimensions',p.width+' × '+p.height],['Original file',p.format.toUpperCase()+' · '+(p.bytes/1024).toFixed(0)+' KB'],['Captured',p.captured||'Not recorded'],['Uploaded',new Date(p.created_at).toLocaleDateString()],['Visibility',p.public?'Public':'Private'],
    ...(p.owner?[['GPS location',p.latitude==null?'No location recorded':p.latitude.toFixed(5)+', '+p.longitude.toFixed(5)]]:[])].map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
    {p.owner&&<div className="actions"><a className="button primary" href={'#/edit/'+id}><Icon name="edit" size={16}/> Edit photo</a><button disabled={busy} className="button outline" onClick={()=>mutate()}>{p.public?'Make private':'Make public'}</button><button className="delete" onClick={()=>setConfirm(true)}>Delete photo</button></div>}
    <Notice>{message}</Notice></aside></div>
    {confirm&&<Modal title="Delete this photo?" close={()=>{if(!busy)setConfirm(false);}}><p>“{p.title}” and its image files will be removed from your gallery.</p><div className="actions"><button className="button outline" onClick={()=>setConfirm(false)} disabled={busy}>Cancel</button><button className="button danger" disabled={busy} onClick={()=>mutate(true)}>Delete photo</button></div></Modal>}
  </section>;
}
