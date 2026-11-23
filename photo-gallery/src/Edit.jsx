import React,{useEffect,useRef,useState} from 'react';
import {api,Icon,json,Loading,media,nav,Notice,useData} from './common.jsx';
import {invalidate} from './Gallery.jsx';

function Result({image,crop,rotation,w,h}){
  const canvas=useRef(null);
  useEffect(()=>{
    if(!image)return;
    const c=crop||{left:0,top:0,width:w,height:h}, sx=image.naturalWidth/w,sy=image.naturalHeight/h;
    const factor=Math.min(1,540/Math.max(c.width,c.height));
    const dw=Math.max(1,Math.round(c.width*factor)),dh=Math.max(1,Math.round(c.height*factor));
    const el=canvas.current,quarter=rotation%180!==0;
    el.width=quarter?dh:dw;el.height=quarter?dw:dh;
    const ctx=el.getContext('2d');ctx.translate(el.width/2,el.height/2);ctx.rotate(rotation*Math.PI/180);
    ctx.drawImage(image,c.left*sx,c.top*sy,c.width*sx,c.height*sy,-dw/2,-dh/2,dw,dh);
  },[image,crop,rotation,w,h]);
  return <canvas className="result" ref={canvas} aria-label="Edited preview"/>;
}
function Editor({p}) {
  const w=p.original_width,h=p.original_height;
  const [crop,setCrop]=useState(p.edit.crop),[rotation,setRotation]=useState(p.edit.rotation),[square,setSquare]=useState(false);
  const [image,setImage]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const start=useRef(null);
  const full={left:0,top:0,width:w,height:h},c=crop||full;
  function point(e) {
    const r=e.currentTarget.getBoundingClientRect();
    return {x:Math.max(0,Math.min(w,Math.round((e.clientX-r.left)/r.width*w))),y:Math.max(0,Math.min(h,Math.round((e.clientY-r.top)/r.height*h)))};
  }
  function drag(e){
    if(!start.current)return;
    const a=start.current,b=point(e);
    let dx=Math.abs(b.x-a.x),dy=Math.abs(b.y-a.y);
    if(square)dx=dy=Math.min(dx,dy);
    if(!dx||!dy)return;
    setCrop({left:b.x<a.x?a.x-dx:a.x,top:b.y<a.y?a.y-dy:a.y,width:dx,height:dy});
  }
  function field(k,v){
    let n={...c,[k]:Math.round(Number(v))};
    n.left=Math.max(0,Math.min(w-1,n.left));n.top=Math.max(0,Math.min(h-1,n.top));
    n.width=Math.max(1,Math.min(w-n.left,n.width));n.height=Math.max(1,Math.min(h-n.top,n.height));
    if(square)n.width=n.height=Math.min(w-n.left,h-n.top,k==='height'?n.height:n.width);
    setCrop(n);
  }
  async function save(){
    setBusy(true);setError('');
    try {await api('/photos/'+p.id,json('PATCH',{edit:{crop,rotation},revision:p.revision}));invalidate();nav('/photo/'+p.id);}
    catch(e){setError(e.message);setBusy(false);}
  }
  return <section className="workspace"><a className="text-link back" href="#/edit"><Icon name="left" size={14}/> Choose another frame</a>
    <div className="page-head"><div><span className="kicker"><i/> EDIT STUDIO</span><h1>{p.title}<em>.</em></h1></div></div>
    <div className="editor-layout"><div className="edit-stage"><div className="crop-surface" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);start.current=point(e);}} onPointerMove={drag} onPointerUp={e=>{drag(e);start.current=null;}} onPointerCancel={()=>start.current=null}>
      <img src={media(p,'source')} alt={'Original '+p.title} draggable="false" onLoad={e=>setImage(e.target)} onError={()=>setError('The original preview could not be loaded.')}/>
      {crop&&<div className="crop-window" style={{left:100*c.left/w+'%',top:100*c.top/h+'%',width:100*c.width/w+'%',height:100*c.height/h+'%'}}/>}</div></div>
    <aside className="controls"><h2>Crop & rotate</h2><p>Drag on the original to select a crop, or enter its dimensions in pixels.</p>
    <label>Crop shape<select value={square?'square':'free'} onChange={e=>{const sq=e.target.value==='square';setSquare(sq);if(sq)setCrop({...c,width:Math.min(c.width,c.height),height:Math.min(c.width,c.height)});}}><option value="free">Freeform</option><option value="square">Square</option></select></label>
    <div className="fields">{Object.keys(full).map(k=><label key={k}>{k}<input type="number" min={k==='left'||k==='top'?0:1} max={k==='left'?w-1:k==='top'?h-1:k==='width'?w:h} value={c[k]} onChange={e=>field(k,e.target.value)}/></label>)}</div>
    <div className="row"><button className="button outline" onClick={()=>setRotation((rotation+90)%360)}><Icon name="rotate" size={16}/>Rotate 90°</button><small>{rotation}°</small></div>
    <h3>Result preview</h3><Result image={image} crop={crop} rotation={rotation} w={w} h={h}/>
    <button className="text-link" onClick={()=>{setCrop(null);setRotation(0);setSquare(false);}}>Reset to original</button>
    <div className="actions"><button className="button primary" disabled={busy||!image} onClick={save}>{busy?'Saving…':'Save edit'}</button><a className="button outline" href={'#/photo/'+p.id}>Cancel</a></div><Notice>{error}</Notice></aside></div>
  </section>;
}
export default function Edit({id}){
  const {value,error,loading}=useData('/photos/'+id);
  if(loading)return <Loading/>;
  if(error||!value?.owner)return <Notice>{error||'Choose a frame from your own gallery.'}</Notice>;
  return <Editor p={value}/>;
}
