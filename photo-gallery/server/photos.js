import { randomUUID } from 'node:crypto';
import { displayVariants, fail, inspect, originalEdit, render, validateEdit } from './images.js';

export const photoSelect = 'SELECT p.*, a.username FROM stillroom.photos p JOIN stillroom.accounts a ON a.id=p.owner_id';
export function view(row, user) {
  const owner = row.owner_id === user;
  const { id, title, username, owner_id, width, height, format, bytes, captured, revision, created_at } = row;
  return {id, title, username, owner_id, width, height, format, bytes, captured, revision, created_at,
    variant_widths:row.variant_widths, public:row.public, owner, ...(owner && { original_width:row.original_width, original_height:row.original_height,
    edit:row.edit, latitude:row.latitude, longitude:row.longitude })};
}
const sourceKey = id => id+'/original';
const key = (id, rev, variant) => id+'/'+rev+'/'+variant;
const variants = (id, rev) => displayVariants.map(({name}) => key(id,rev,name));
const previousKeys = row => Object.keys(row.variant_widths ?? {thumb:0,preview:0})
  .map(name => key(row.id,row.revision,name));
async function retire(db, keys, staging = false) {
  for (const k of keys) await db.query(
    "INSERT INTO stillroom.garbage(key,after_at) VALUES ($1,now()+$2::interval) ON CONFLICT(key) DO NOTHING",
    [k, staging ? '24 hours' : '0 seconds']);
}
async function accept(tx, keys) {
  for (const k of keys) await tx.query('DELETE FROM stillroom.garbage WHERE key=$1',[k]);
}
export async function sweep(db, store) {
  const {rows} = await db.query('SELECT key FROM stillroom.garbage WHERE after_at <= now() LIMIT 100');
  for (const {key:k} of rows) {
    await store.remove(k);
    await db.query('DELETE FROM stillroom.garbage WHERE key=$1',[k]);
  }
}
export function photoService(db, store) {
  async function writeVariants(id, rev, media) {
    for (const {name} of displayVariants) await store.put(key(id,rev,name), media.files[name]);
  }
  async function upload(user, files, visible) {
    if (!files?.length || files.length > 5) fail(400,'Select 1 to 5 photos.');
    const items = [];
    for (const file of files) {
      const meta = await inspect(file.buffer);
      const id = randomUUID(), rev = randomUUID();
      const keys = [sourceKey(id), ...variants(id,rev)];
      let media;
      try { media = await render(file.buffer, originalEdit); } catch { fail(400,'This image could not be decoded.'); }
      await retire(db,keys,true);
      await store.put(keys[0],file.buffer);
      await writeVariants(id,rev,media);
      items.push({id,rev,meta,keys,widths:media.widths,title:file.originalname.replace(/\.[^.]+$/,'').slice(0,160) || 'Untitled'});
    }
    await db.transaction(async tx => {
      for (const {id,rev,meta:m,keys,title,widths} of items) {
        await tx.query(`INSERT INTO stillroom.photos
          (id,owner_id,title,public,format,bytes,original_width,original_height,width,height,captured,latitude,longitude,edit,revision,variant_widths)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$7,$8,$9,$10,$11,$12,$13,$14)`,
          [id,user,title,visible,m.format,m.bytes,m.width,m.height,m.captured,m.latitude,m.longitude,JSON.stringify(originalEdit),rev,JSON.stringify(widths)]);
        await accept(tx,keys);
      }
    });
    return items.map(p => p.id);
  }
  async function read(id,user,ownerOnly = false) {
    const {rows} = await db.query(photoSelect + ' WHERE p.id=$1 AND (p.owner_id=$2 OR (p.public AND $3))',[id,user,!ownerOnly]);
    if (!rows.length) fail(404,'Photo unavailable.');
    return rows[0];
  }
  async function save(row, body) {
    const edit = validateEdit(body.edit,row.original_width,row.original_height);
    if (body.revision !== row.revision) fail(409,'This photo changed. Reopen it before editing.');
    const revision = randomUUID(), keys = variants(row.id,revision);
    const media = await render(await store.get(sourceKey(row.id)),edit);
    await retire(db,keys,true);
    await writeVariants(row.id,revision,media);
    let w = edit.crop?.width ?? row.original_width, h = edit.crop?.height ?? row.original_height;
    if (edit.rotation % 180) [w,h] = [h,w];
    await db.transaction(async tx => {
      const updated = await tx.query('UPDATE stillroom.photos SET edit=$1, revision=$2, width=$3,height=$4,variant_widths=$7 WHERE id=$5 AND revision=$6 RETURNING id',
        [JSON.stringify(edit),revision,w,h,row.id,row.revision,JSON.stringify(media.widths)]);
      if (!updated.rows.length) fail(409,'This photo changed. Reopen it before editing.');
      await accept(tx,keys);
      await retire(tx,previousKeys(row));
    });
  }
  async function remove(row) {
    await db.transaction(async tx => {
      const { rows } = await tx.query('DELETE FROM stillroom.photos WHERE id=$1 AND owner_id=$2 RETURNING id,revision,variant_widths',[row.id,row.owner_id]);
      if (rows.length) await retire(tx,[sourceKey(row.id),...previousKeys(rows[0])]);
    });
  }
  async function bytes(row, variant) {
    if (variant === 'source') {
      const sharp = (await import('sharp')).default;
      return sharp(await store.get(sourceKey(row.id))).autoOrient().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).webp().toBuffer();
    }
    return store.get(key(row.id,row.revision,variant));
  }
  return {upload,read,save,remove,bytes};
}

// Rebuild old two-file revisions from the original, preserving any saved crop and rotation.
export async function upgradeDisplayVariants(db, store) {
  const service = photoService(db,store);
  for (;;) {
    const {rows} = await db.query('SELECT * FROM stillroom.photos WHERE variant_widths IS NULL LIMIT 1');
    if (!rows.length) return;
    const row = rows[0];
    try { await service.save(row,{edit:row.edit,revision:row.revision}); }
    catch (error) { if (error.status !== 409) throw error; }
  }
}
