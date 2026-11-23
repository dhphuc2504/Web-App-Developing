import React, {useEffect, useState} from 'react';
import {ResponsivePhoto} from './common.jsx';

// Map each triangular face from its local plane into the crystal's 3D space.
function makeFaces(sides, radius, top, bottom) {
  const ring = Array.from({length:sides}, (_,i) => {
    const angle = 2*Math.PI*i/sides;
    return [radius*Math.cos(angle), 0, radius*Math.sin(angle)];
  });
  const difference = (a,b) => a.map((v,i)=>v-b[i]);
  const unit = v => v.map(n=>n/Math.hypot(...v));
  return [top, bottom].flatMap((tip, half) => ring.map((vertex,i) => {
    const next = ring[(i+1)%sides];
    const [a,b] = half === 0 ? [vertex,next] : [next,vertex];
    const base = difference(b,a);
    const middle = a.map((v,k)=>(v+b[k])/2);
    const slope = difference([0,tip,0],middle);
    const x = unit(base), y = unit(slope);
    const z = [x[1]*y[2]-x[2]*y[1],x[2]*y[0]-x[0]*y[2],x[0]*y[1]-x[1]*y[0]];
    const basis = [...x,0,...y,0,...z,0,0,0,0,1].map(v=>Number(v.toFixed(6)));
    return {
      width:Math.hypot(...base)+'em',height:Math.hypot(...slope)+'em',
      transform:'translate3d('+a.map(v=>v+'em').join(',')+') matrix3d('+basis.join(',')+')',
      '--shade':String((i+half)%4), '--upright': half===0 ? '-1':'1'
    };
  }));
}
const facets=makeFaces(4,175,-162,196);
const fragments=makeFaces(3,13,-35,23);

export function PhotoCrystal({photos,step}) {
  return <div className="observatory">
    <div className="orbit-system" aria-hidden="true"><i/><i/><i/></div>
    <div className="crystal-center"><div className="crystal-axis"><div className="crystal-spin">
      {facets.map((style,index)=>{
        const photo=photos[(index+step)%photos.length];
        return <div key={index} className="facet" style={style}>{photo&&
          <a href={'#/photo/'+photo.id} tabIndex={-1} aria-label={'Open '+photo.title}>
            <ResponsivePhoto photo={photo} sizes="(max-width: 540px) 154px, (max-width: 800px) 188px, 280px" alt="" draggable="false"/>
          </a>}</div>;
      })}
    </div></div></div>
  </div>;
}

const positions = [[6,16,1.3],[87,9,1.25],[17,62,.66],[94,47,.8],[38,4,.48],[78,81,1.1],[5,90,.64],[52,64,.45]];
export function Atmosphere() {
  return <div className="atmosphere" aria-hidden="true"><div className="sky-glow"/><div className="sky-stars"/>
    {positions.map(([x,y,scale],i)=><div key={i} className="mote" style={{
      left:x+'%',top:y+'%',fontSize:scale+'px','--delay':(-i*3.7)+'s','--period':(20+i*1.8)+'s'
    }}><div>{fragments.map((style,k)=><i className="facet" key={k} style={style}/>)}</div></div>)}
    <div className="horizon-grid"/>
  </div>;
}

export function useMotion() {
  const [system,setSystem]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [choice,setChoice]=useState(()=>{try{return localStorage.getItem('stillroom-motion');}catch{return null;}});
  useEffect(()=>{
    const query=matchMedia('(prefers-reduced-motion: reduce)');
    const changed=()=>setSystem(query.matches);
    query.addEventListener('change',changed);
    return ()=>query.removeEventListener('change',changed);
  },[]);
  const moving=choice ? choice==='on' : !system;
  function toggle() {
    const next=moving?'off':'on';
    setChoice(next);
    try {localStorage.setItem('stillroom-motion',next);}catch{}
  }
  useEffect(()=>{
    if(!moving || !matchMedia('(hover: hover) and (pointer: fine)').matches)return;
    let tile=null, frame=0, point;
    function clear(){
      if(tile){tile.style.removeProperty('--pitch');tile.style.removeProperty('--yaw');tile=null;}
    }
    function update(){
      frame=0;
      const active=point.target.closest?.('.tile,.observatory,.stack-wrap');
      if(active!==tile)clear();
      tile=active;
      if(!tile)return;
      const box=tile.getBoundingClientRect();
      const nx=(point.clientX-box.left)/box.width-.5, ny=(point.clientY-box.top)/box.height-.5;
      tile.style.setProperty('--pitch',(-ny*9).toFixed(2)+'deg');
      tile.style.setProperty('--yaw',(nx*13).toFixed(2)+'deg');
    }
    function move(e){point=e;if(!frame)frame=requestAnimationFrame(update);}
    function leave(){cancelAnimationFrame(frame);frame=0;clear();}
    document.addEventListener('pointermove',move,{passive:true});
    document.documentElement.addEventListener('pointerleave',leave);
    return ()=>{document.removeEventListener('pointermove',move);document.documentElement.removeEventListener('pointerleave',leave);leave();};
  },[moving]);
  return [moving,toggle];
}
