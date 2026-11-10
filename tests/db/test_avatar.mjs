import { avatarExtension } from '../../lib/avatar-file.mjs';
import assert from 'node:assert/strict';

assert.equal(avatarExtension(Uint8Array.from([0xff,0xd8,0xff,0x00]),'image/jpeg'),'jpg');
assert.equal(avatarExtension(Uint8Array.from([137,80,78,71,13,10,26,10]),'image/png'),'png');
assert.equal(avatarExtension(Uint8Array.from([...Buffer.from('RIFF'),0,0,0,0,...Buffer.from('WEBP')]),'image/webp'),'webp');
assert.equal(avatarExtension(Uint8Array.from([0xff,0xd8,0xff]),'image/png'),null);
assert.equal(avatarExtension(Uint8Array.from([0x3c,0x73,0x76,0x67]),'image/svg+xml'),null);
console.log('PASS  server avatar MIME/signature allowlist rejects spoofed and unsupported uploads');
