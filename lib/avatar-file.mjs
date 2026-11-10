const TYPES = {
  'image/jpeg': { ext: 'jpg', test: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/png': { ext: 'png', test: (b) => b.length >= 8 && [137,80,78,71,13,10,26,10].every((v,i) => b[i] === v) },
  'image/webp': { ext: 'webp', test: (b) => b.length >= 12 && String.fromCharCode(...b.slice(0,4)) === 'RIFF' && String.fromCharCode(...b.slice(8,12)) === 'WEBP' }
};

export function avatarExtension(bytes, mime) {
  const type = TYPES[mime];
  return type && type.test(bytes) ? type.ext : null;
}
