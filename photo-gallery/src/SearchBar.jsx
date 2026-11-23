import React, {useEffect, useRef, useState} from 'react';
import {api, Icon, ResponsivePhoto} from './common.jsx';

export default function SearchBar({user}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const form = useRef(null);
  const input = useRef(null);
  const term = query.trim();
  const visible = open && Boolean(term);
  const current = result?.term === term && result.offset === offset ? result : null;

  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({q:term, offset:String(offset)});
        const page = await api('/search?'+params, {signal:controller.signal});
        if (!controller.signal.aborted) setResult({term, offset, ...page});
      } catch (e) {
        if (!controller.signal.aborted) setResult({term, offset, error:e.message});
      }
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [term, offset, visible, attempt]);

  useEffect(() => {
    if (!visible) return;
    const outside = event => {
      if (!form.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [visible]);

  function visitPage(nextOffset) {
    input.current.focus();
    setOffset(nextOffset);
  }

  return <form ref={form} className="gallery-search" role="search" aria-label="Gallery search"
    onSubmit={e=>{e.preventDefault(); setOpen(true); input.current.focus();}}
    onBlur={e=>{if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);}}
    onKeyDown={e=>{if(e.key==='Escape' && visible){e.preventDefault();input.current.focus();setOpen(false);}}}>
    <div className="search-field">
      <input ref={input} type="search" aria-label="Search users or photos" placeholder="Search users or photos"
        autoComplete="off" maxLength={160} value={query} onFocus={()=>setOpen(true)}
        onChange={e=>{setQuery(e.target.value);setOffset(0);setOpen(true);}}/>
      <button type="submit" aria-label="Search"><Icon name="search" size={18}/></button>
    </div>
    {visible && <section className="search-results" aria-label="Search results">
      {!current ? <p role="status">Searching…</p> : current.error ?
        <><p role="alert">{current.error}</p><button type="button" className="text-link" onClick={()=>{
          input.current.focus();setResult(null);setAttempt(n=>n+1);
        }}>Retry</button></> :
        <>
          {!current.items.length && <p role="status">No matches for “{term}”.</p>}
          <ul>{current.items.map(item=>{
            const isUser = item.kind === 'user';
            const target = isUser ? (item.id===user?.id ? '/gallery' : '/artist/'+item.id) : '/photo/'+item.id;
            return <li key={item.kind+item.id}><a href={'#'+target} onClick={()=>setOpen(false)}>
              {isUser ? <span className="search-avatar"><Icon name="user"/></span> :
                <ResponsivePhoto photo={item} loading="lazy" sizes="45px" alt=""/>}
              <span><strong>{isUser?'@'+item.username:item.name}</strong><small>{isUser?'User':'Photo · @'+item.username}</small></span>
            </a></li>;
          })}</ul>
          {(offset>0 || current.hasMore) && <div className="search-pages">
            <button type="button" className="text-link" disabled={!offset} onClick={()=>visitPage(Math.max(0,offset-12))}>Previous</button>
            <small>Page {1+offset/12}</small>
            <button type="button" className="text-link" disabled={!current.hasMore} onClick={()=>visitPage(offset+current.items.length)}>Next</button>
          </div>}
        </>}
    </section>}
  </form>;
}
