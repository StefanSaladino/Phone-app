import { generateKeyPairSync } from 'node:crypto';

function base64UrlToBuffer(value) {
  return Buffer.from(value, 'base64url');
}

const { publicKey, privateKey } = generateKeyPairSync('ec', {
  namedCurve: 'P-256',
});

const publicJwk = publicKey.export({ format: 'jwk' });
const privateJwk = privateKey.export({ format: 'jwk' });

if (!publicJwk.x || !publicJwk.y || !privateJwk.d) {
  throw new Error('Unable to export the generated P-256 VAPID key pair.');
}

// Web Push expects the uncompressed public point: 0x04 || X || Y.
const publicBytes = Buffer.concat([
  Buffer.from([0x04]),
  base64UrlToBuffer(publicJwk.x),
  base64UrlToBuffer(publicJwk.y),
]);

const privateBytes = base64UrlToBuffer(privateJwk.d);

console.log(
  JSON.stringify(
    {
      publicKey: publicBytes.toString('base64url'),
      privateKey: privateBytes.toString('base64url'),
    },
    null,
    2,
  ),
);
