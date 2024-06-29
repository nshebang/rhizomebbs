import speakeasy from 'speakeasy';
import qrcode from 'qrcode';

(async () => {
  const secret = speakeasy.generateSecret({
    length: 20,
    name: 'Ichoria BBS',
  });

  console.log('Secret: ', secret.base32);
  console.log('OTP link:', secret.otpauth_url);

  const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);
  
  console.log('QR Code: ', qrCodeUrl);

  console.log('---');
  console.log('You should give both the OTP link and the QR link to the\n' +
    'new staff member and copy the "secret" to config.js -> "staff" ->\n' +
    '"<your admin username>" -> "secret"');
})();
