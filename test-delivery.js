import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.error("❌ BREVO_API_KEY environment variable is not defined");
    process.exit(1);
  }

  console.log(`Testing Brevo API Transactional Email...`);
  
  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sender: {
          name: 'CryptoBTC Miner',
          email: 'support@cyptobtcminer.com'
        },
        to: [
          {
            email: 'aishausmandauda2020@gmail.com'
          }
        ],
        subject: "Verify Your Crypto BTC Miner Registration [Brevo API Test]",
        htmlContent: "<p>Your 6-digit test code is: <b>994411</b></p>"
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log("✅ Email sent successfully via Brevo!", data);
    } else {
      const errText = await response.text();
      console.error(`❌ Brevo API status ${response.status}:`, errText);
    }
  } catch (err) {
    console.error("❌ Brevo test request failed:", err);
  }
}

main();
