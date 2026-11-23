import sharp from 'sharp';

export const originalEdit = { rotation: 0, crop: null };
export function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}

// TIFF offsets are relative to the TIFF header, even inside a JPEG EXIF block.
export function exifFields(exif) {
  const empty = { latitude: null, longitude: null, captured: null };
  if (!exif) return empty;
  const b = exif.subarray(exif.toString('ascii', 0, 4) === 'Exif' ? 6 : 0);
  const order = b.toString('ascii', 0, 2);
  if (!['II', 'MM'].includes(order)) return empty;
  const u16 = i => order === 'II' ? b.readUInt16LE(i) : b.readUInt16BE(i);
  const u32 = i => order === 'II' ? b.readUInt32LE(i) : b.readUInt32BE(i);
  function directory(start) {
    const tags = new Map();
    if (!start || start + 2 > b.length) return tags;
    const count = u16(start);
    if (start + 2 + count * 12 > b.length) return tags;
    for (let i = 0; i < count; i++) {
      const e = start + 2 + i * 12;
      const type = u16(e + 2), length = u32(e + 4);
      const size = ({2: 1, 4: 4, 5: 8})[type] * length;
      if (!size) continue;
      const offset = size <= 4 ? e + 8 : u32(e + 8);
      if (offset + size > b.length) continue;
      let value;
      if (type === 2) value = b.toString('ascii', offset, offset + size).replace(/\0.*$/s, '');
      if (type === 4 && length === 1) value = u32(offset);
      if (type === 5 && length === 3) value = [0, 8, 16].map(d => u32(offset+d) / u32(offset+d+4));
      tags.set(u16(e), value);
    }
    return tags;
  }
  try {
    if (u16(2) !== 42) return empty;
    const root = directory(u32(4));
    const gps = directory(root.get(0x8825));
    function coordinate(tag, positive, negative, max) {
      const ref = gps.get(tag), dms = gps.get(tag + 1);
      if (![positive, negative].includes(ref) || !Array.isArray(dms)) return null;
      const [d, m, s] = dms;
      const v = d + m/60 + s/3600;
      return Number.isFinite(v) && v <= max && m < 60 && s < 60 ? (ref === negative ? -v : v) : null;
    }
    const latitude = coordinate(1, 'N', 'S', 90), longitude = coordinate(3, 'E', 'W', 180);
    const captured = directory(root.get(0x8769)).get(0x9003);
    return { latitude: longitude == null ? null : latitude, longitude: latitude == null ? null : longitude,
      captured: typeof captured === 'string' ? captured : null };
  } catch { return empty; }
}

export async function inspect(buffer) {
  let meta;
  try { meta = await sharp(buffer, { limitInputPixels: 32_000_000 }).metadata(); }
  catch { fail(400, 'This image is damaged or exceeds 32 megapixels.'); }
  if (!['jpeg','webp','png'].includes(meta.format) || (meta.pages || 1) > 1)
    fail(400, 'Choose a still JPEG, PNG or WebP image.');
  return { format: meta.format, ...meta.autoOrient, bytes: buffer.length, ...exifFields(meta.exif) };
}

export function validateEdit(edit, w, h) {
  if (!edit || ![0,90,180,270].includes(edit.rotation)) fail(400, 'Choose a quarter-turn rotation.');
  const c = edit.crop;
  if (c !== null && (!c || !['left','top','width','height'].every(k => Number.isInteger(c[k])) ||
      c.left < 0 || c.top < 0 || c.width < 1 || c.height < 1 || c.left+c.width > w || c.top+c.height > h))
    fail(400, 'The crop must fit inside the original frame.');
  return { rotation: edit.rotation, crop: c && {left:c.left, top:c.top, width:c.width, height:c.height} };
}

export const displayVariants = [
  {name:'thumb', fraction:0.30, quality:78},
  {name:'medium', fraction:0.60, quality:82},
  {name:'preview', fraction:1, quality:85}
];

export async function render(buffer, edit) {
  const oriented = await sharp(buffer, {limitInputPixels:32_000_000}).autoOrient().toBuffer();
  let image = sharp(oriented);
  if (edit.crop) image = image.extract(edit.crop);
  const clipped = edit.crop ? await image.toBuffer() : oriented;
  const rotated = sharp(clipped).rotate(edit.rotation);
  const {width,height} = await sharp(clipped).metadata();
  const longest = Math.min(1600,Math.max(width,height));
  const files = {}, widths = {};
  for (const {name,fraction,quality} of displayVariants) {
    const edge = Math.max(1,Math.round(longest*fraction));
    const {data,info} = await rotated.clone()
      .resize({width:edge,height:edge,fit:'inside',withoutEnlargement:true})
      .webp({quality}).toBuffer({resolveWithObject:true});
    files[name] = data;
    widths[name] = info.width;
  }
  return {files,widths};
}
