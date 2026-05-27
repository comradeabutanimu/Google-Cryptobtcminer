import nodemailer from 'nodemailer';

async function main() {
  const envHost = process.env.SMTP_HOST || 'mail.spacemail.com';
  const envPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const rawUser = process.env.SMTP_USER || 'support@cyptobtcminer.com';
  const pass = process.env.SMTP_PASS || 'Dauda@2026';
  const user = rawUser.replace(/cryptobtcminer\.com/gi, 'cyptobtcminer.com');

  console.log(`Testing SMTP Connection...`);
  const transporter = nodemailer.createTransport({
    host: envHost,
    port: envPort,
    secure: false,
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: false
    },
    connectionTimeout: 10000
  });

  try {
    const info = await transporter.sendMail({
      from: `"Crypto BTC Miner" <${user}>`,
      to: 'aishausmandauda2020@gmail.com',
      subject: "Verify Your Crypto BTC Miner Registration",
      text: "Your code is: 994411",
      html: "<p>Your 6-digit test code is: <b>994411</b></p>"
    });
    console.log("✅ Email sent successfully!", info.messageId);
  } catch (err) {
    console.error("❌ SMTP test failed:", err);
  }
}

main();
