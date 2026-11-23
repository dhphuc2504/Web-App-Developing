import { readFile } from 'node:fs/promises';
import { photoService } from './photos.js';

const collections = [
  ['alba.field', ['Alpine stillness','Into the pines','On the road']],
  ['mira.light', ['Wind lines','Lemon season','Pink passage']],
  ['ren.blue', ['Blue hour','Last train','Tide line']]
];
export async function seed(db,store) {
  const service = photoService(db,store);
  for (const [i,[name,titles]] of collections.entries()) {
    const user = '5ffdfac6-3a5e-4097-81c7-01b00000000'+i;
    await db.query('INSERT INTO stillroom.accounts(id,username) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING',[user,name]);
    const existing = await db.query('SELECT id FROM stillroom.photos WHERE owner_id=$1 LIMIT 1',[user]);
    if (existing.rows.length) continue;
    const files = await Promise.all(titles.map(async title => ({originalname:title+'.jpg',
      buffer:await readFile(new URL('../fixtures/'+title+'.jpg',import.meta.url))})));
    await service.upload(user,files,true);
  }
}
