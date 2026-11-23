import React, {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import Discover from './Discover.jsx';
import Edit from './Edit.jsx';
import {Detail, Gallery, invalidate} from './Gallery.jsx';
import {api, Icon, json, Loading, ResponsivePhoto, Modal, Notice, route} from './common.jsx';
import {Atmosphere, useMotion} from './Scene.jsx';
import SearchBar from './SearchBar.jsx';
import './style.css';

function Account({close, onUser}) {
  const [register,setRegister]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [pending,setPending]=useState(null),[canResend,setCanResend]=useState(false);
  useEffect(()=>{
    if (!pending) return;
    const timer=setTimeout(()=>setCanResend(true),60000);
    return ()=>clearTimeout(timer);
  },[pending]);
  async function authenticate(body, creating) {
    setBusy(true);setError('');
    try {
      const result=await api(creating?'/register':'/login',json('POST',body));
      if (result.verificationRequired) {
        setCanResend(false);
        setPending({identifier:result.email,password:body.password});
      } else {onUser(result);close();}
    }
    catch(e){setError(e.message);}finally{setBusy(false);}
  }
  function submit(e) {
    e.preventDefault();
    authenticate(Object.fromEntries(new FormData(e.currentTarget)),register);
  }
  if (pending) return <Modal title="Check your email" close={close}>
    <p role="status">Open the most recent Stillroom verification link sent to <strong>{pending.identifier}</strong> and enter your password. The link works for 24 hours.</p>
    <Notice>{error}</Notice>
    <button className="button primary" disabled={busy||!canResend} onClick={()=>authenticate(pending,false)}>{busy?'Sending…':'Resend verification email'}</button>
    {!canResend&&<p>You can request another link in one minute.</p>}
  </Modal>;
  return <Modal title={register?'Create an account':'Welcome back'} close={close}>
    <form className="account-form" onSubmit={submit} key={register}>
      {register?<><label>Username<input required name="username" autoComplete="username" minLength={3} maxLength={32} pattern="[A-Za-z0-9._\-]+"/></label>
      <label>Email<input required name="email" autoComplete="email" type="email"/></label></>:
      <label>Username or email<input required name="identifier" autoComplete="username"/></label>}
      <label>Password<input required name="password" type="password" minLength={register?8:1} maxLength={128} autoComplete={register?'new-password':'current-password'}/></label>
      <Notice>{error}</Notice><button disabled={busy} className="button primary">{busy?'Please wait…':register?'Create account':'Sign in'}</button></form>
    <button disabled={busy} className="text-link switch" onClick={()=>{setRegister(!register);setError('');}}>{register?'Already registered? Sign in':'New here? Create an account'}</button>
  </Modal>;
}
function VerifyEmail({token,onUser,signIn}) {
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function verify(e) {
    e.preventDefault();
    const password=new FormData(e.currentTarget).get('password');
    setBusy(true);setError('');
    try {
      const user=await api('/verify-email',json('POST',{token,password}));
      onUser(user);
      window.location.replace('#/gallery');
    } catch(e){setError(e.message);} finally {setBusy(false);}
  }
  return <section className="verify-card" aria-labelledby="verify-title">
    <div className="verify-emblem" aria-hidden="true"><Icon name="lock" size={20}/></div>
    <h1 id="verify-title">Verify your email</h1>
    <p className="verify-intro">Enter your Stillroom password to confirm your email and open your gallery.</p>
    <form className="account-form" onSubmit={verify} aria-busy={busy}>
      <label>Password<input type="password" name="password" required maxLength={128} autoComplete="current-password"/></label>
      <Notice>{error}</Notice>
      <button disabled={busy} className="button primary">{busy?'Verifying…':'Verify email'}<Icon name="arrow" size={16}/></button>
    </form>
    <div className="verify-footer">
      <button type="button" onClick={signIn}>Sign in or request another link</button>
    </div>
  </section>;
}
function Daily({moving}) {
  const [photo,setPhoto]=useState(null),[rolling,setRolling]=useState(false),[empty,setEmpty]=useState(false),[error,setError]=useState('');
  async function draw() {
    setRolling(true);setError('');setPhoto(null);
    try {
      const wait=moving?800:0;
      const [p]=await Promise.all([api('/draw',{method:'POST'}),new Promise(resolve=>setTimeout(resolve,wait))]);
      setPhoto(p);setEmpty(!p);
    } catch(e){setError(e.message);}finally{setRolling(false);}
  }
  return <section className="daily"><div className="daily-copy"><span className="kicker"><i/> PERSONAL DARKROOM</span>
    <h1>Picture of<br/><em>the day.</em></h1><p>Reveal a random frame from your own gallery. Your pick stays with you for the day.</p>
    <button className="button acid" disabled={rolling} onClick={draw}><Icon name="spark" size={18}/>{rolling?'Drawing…':photo?'Replay reveal':'Reveal my photo'}</button>
    <div role="status">{empty&&<p>Your roll is empty. <a href="#/gallery">Add your first photo</a> to draw a frame.</p>}{photo&&<p>Today’s pick: <a href={'#/photo/'+photo.id}>{photo.title}</a></p>}</div><Notice>{error}</Notice></div>
    <div className={'draw-stage '+(rolling?'rolling':'')}><div className={'draw-frame '+(photo?'turned':'')}>
      <div className="card-back" aria-hidden="true"><Icon name="aperture" size={70}/><span>STILLROOM</span></div>
      <div className="card-photo">{photo&&<a className="reveal" href={'#/photo/'+photo.id}><ResponsivePhoto photo={photo} sizes="(max-width: 540px) 145px, 224px" alt={photo.title}/><strong>{photo.title}</strong></a>}</div>
    </div></div></section>;
}
const links=[['/','Discover'],['/gallery','Your gallery'],['/edit','Edit'],['/daily','Picture of the day']];
const positions=new Map();
function App() {
  const [moving,toggleMotion]=useMotion();
  const [path,setPath]=useState(route),[user,setUser]=useState(null),[ready,setReady]=useState(false),[account,setAccount]=useState(false),[error,setError]=useState('');
  useEffect(()=>{api('/me').then(setUser).catch(e=>setError(e.message)).finally(()=>setReady(true));},[]);
  useEffect(()=>{
    function change(){positions.set(path,window.scrollY);setPath(route());}
    window.addEventListener('hashchange',change);return ()=>window.removeEventListener('hashchange',change);
  },[path]);
  useEffect(()=>{window.scrollTo(0,positions.get(path)||0);},[path]);
  function identify(u){invalidate();positions.clear();setUser(u);setError('');}
  async function logout(){try{await api('/logout',{method:'POST'});identify(null);}catch(e){setError(e.message);}}
  const [,part='',id]=path.split('/');
  const personal=['gallery','edit','daily'].includes(part);
  let page;
  if((personal||part==='verify-email')&&!ready)page=<Loading/>;
  else if(part==='verify-email')page=<VerifyEmail token={id} onUser={identify} signIn={()=>{window.location.replace('#/gallery');setAccount(true);}}/>;
  else if(personal&&!user)page=<div className="empty gate"><Icon name="film" size={44}/><h1>{links.find(([p])=>p==='/'+part)?.[1]}</h1><p>Sign in to open your personal collection.</p><button className="button primary" onClick={()=>setAccount(true)}>Sign in or register</button></div>;
  else if(part==='gallery'||part==='artist')page=<Gallery artist={part==='artist'?id:null}/>;
  else if(part==='edit')page=id?<Edit id={id}/>:<Gallery choose/>;
  else if(part==='daily')page=<Daily moving={moving}/>;
  else if(part==='photo'&&id)page=<Detail id={id}/>;
  else page=<Discover moving={moving}/>;
  return <div className="world" data-motion={moving?"on":"off"}><Atmosphere/><header><div className="bar"><a className="brand" href="#/" aria-label="Stillroom home"><Icon name="aperture" size={30}/>Stillroom</a>
  <nav aria-label="Gallery navigation">{links.map(([url,label])=><a key={url} aria-current={(url==='/'?!part:'/'+part===url)?'page':undefined} href={'#'+url}>{label}</a>)}</nav>
  <SearchBar key={path+':'+(user?.id||'guest')} user={user}/>
  <div className="nav-tools"><button className="icon motion-toggle" type="button" aria-label={moving?"Pause motion":"Enable motion"} title={moving?"Pause motion":"Enable motion"} onClick={toggleMotion}><Icon name={moving?"pause":"play"} size={15}/></button>
  {user?<button className="button account" onClick={logout} title={'Sign out @'+user.username}>Sign out</button>:<button className="button account" onClick={()=>setAccount(true)}><Icon name="user" size={16}/>Sign in</button>}</div></div></header>
  <main><Notice>{error}</Notice><React.Fragment key={path+':'+(user?.id||'guest')}>{page}</React.Fragment></main>
  {account&&<Account close={()=>setAccount(false)} onUser={identify}/>}</div>;
}
createRoot(document.getElementById('root')).render(<App/>);
