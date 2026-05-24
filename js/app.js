// ─────────────────────────────────────────────
//  APEX MOTOREN KENYA — Full Backend Server
//  Features:
//    ✓ Parts request form → Email + WhatsApp alert
//    ✓ M-Pesa STK Push
//    ✓ M-Pesa Callback
//    ✓ M-Pesa Status Query
//  Stack: Node.js + Express
//  Deploy: Render.com (free tier)
// ─────────────────────────────────────────────

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const nodemailerPkg = require('nodemailer');
const nodemailer = nodemailerPkg.default || nodemailerPkg;
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors({
  origin: ['https://apexmotoren.com', 'https://www.apexmotoren.com', 'http://localhost:3000'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

const {
  // M-Pesa
  CONSUMER_KEY,
  CONSUMER_SECRET,
  SHORTCODE,
  PASSKEY,
  CALLBACK_URL,
  NODE_ENV = 'sandbox',

  // Email (SMTP)
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  NOTIFY_EMAIL = 'apexmotor@apexmotoren.com',

  // WhatsApp via CallMeBot (free — no Twilio needed)
  // Sign up at callmebot.com to get your API key
  WHATSAPP_PHONE,   // your WhatsApp number e.g. 971521189377
  WHATSAPP_API_KEY, // from callmebot.com

  PORT = 3000
} = process.env;

const BASE_URL = NODE_ENV === 'production'
  ? 'https://api.safaricom.co.ke'
  : 'https://sandbox.safaricom.co.ke';


// ─────────────────────────────────────────────
//  HELPER: Send Email Notification
// ─────────────────────────────────────────────
async function sendEmail(subject, html) {
  try {
    const transporter = nodemailer.createTransporter({
      host: SMTP_HOST,
      port: parseInt(SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
      }
    });

    await transporter.sendMail({
      from: `"Apex Motoren Kenya" <${SMTP_USER}>`,
      to: NOTIFY_EMAIL,
      subject,
      html
    });

    console.log('✅ Email sent:', subject);
  } catch (err) {
    console.error('❌ Email error:', err.message);
  }
}


// ─────────────────────────────────────────────
//  HELPER: Send WhatsApp Notification (CallMeBot)
//  Free service — no Twilio account needed
//  Setup: wa.me/34644597958?text=I allow callmebot to send me messages
//  Then get your API key from callmebot.com
// ─────────────────────────────────────────────
async function sendWhatsApp(message) {
  try {
    if (!WHATSAPP_PHONE || !WHATSAPP_API_KEY) {
      console.log('WhatsApp not configured — skipping');
      return;
    }

    const encoded = encodeURIComponent(message);
    const url = `https://api.callmebot.com/whatsapp.php?phone=${WHATSAPP_PHONE}&text=${encoded}&apikey=${WHATSAPP_API_KEY}`;
    await axios.get(url);
    console.log('✅ WhatsApp sent');
  } catch (err) {
    console.error('❌ WhatsApp error:', err.message);
  }
}


// ─────────────────────────────────────────────
//  HELPER: Format parts request as HTML email
// ─────────────────────────────────────────────
function buildEmailHTML(data) {
  const { name, phone, email, country, vin, vehicle, parts, categories } = data;
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0a0a;color:#f9f7f2;padding:2rem;border-radius:8px">
      <div style="border-bottom:2px solid #B8952A;padding-bottom:1rem;margin-bottom:1.5rem">
        <h1 style="color:#B8952A;margin:0;font-size:1.5rem">APEX MOTOREN KENYA</h1>
        <p style="color:#888;margin:0.25rem 0 0;font-size:0.85rem">NEW PARTS REQUEST</p>
      </div>

      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="padding:0.6rem 0;border-bottom:1px solid #1a1a1a;color:#888;width:35%;font-size:0.85rem">CUSTOMER NAME</td>
          <td style="padding:0.6rem 0;border-bottom:1px solid #1a1a1a;color:#f9f7f2;font-weight:bold">${name || '—'}</td>
        </tr>
        <tr>
          <td style="padding:0.6rem 0;border-bottom:1px solid #1a1a1a;color:#888;font-size:0.85rem">WHATSAPP / PHONE</td>
          <td style="padding:0.6rem 0;border-bottom:1px solid #1a1a1a;color:#f9f7f2">${phone || '—'}</td>
        </tr>
        <tr>
          <td style="padding:0.6rem 0;border-bottom:1px solid #1a1a1a;color:#888;font-size:0.85rem">EMAIL</td>
          <td style="padding:0.6rem 0;border-bottom:1px solid #1a1a1a;color:#f9f7f2">${email || '—'}</td>
        </tr>
        <tr>
          <td style="padding:0.6rem 0;border-bottom:1px solid #1a1a1a;color:#888;font-size:0.85rem">COUNTRY</td>
          <td style="padding:0.6rem 0;border-bottom:1px solid #1a1a1a;color:#f9f7f2">${country || '—'}</td>
        </tr>
        <tr>
          <td style="padding:0.6rem 0;border-bottom:1px solid #1a1a1a;color:#888;font-size:0.85rem">VIN NUMBER</td>
          <td style="padding:0.6rem 0;border-bottom:1px solid #1a1a1a;color:#B8952A;font-family:monospace;font-size:1rem;letter-spacing:0.1em">${vin || '—'}</td>
        </tr>
        <tr>
          <td style="padding:0.6rem 0;border-bottom:1px solid #1a1a1a;color:#888;font-size:0.85rem">VEHICLE</td>
          <td style="padding:0.6rem 0;border-bottom:1px solid #1a1a1a;color:#f9f7f2">${vehicle || '—'}</td>
        </tr>
        <tr>
          <td style="padding:0.6rem 0;border-bottom:1px solid #1a1a1a;color:#888;font-size:0.85rem">CATEGORY</td>
          <td style="padding:0.6rem 0;border-bottom:1px solid #1a1a1a;color:#B8952A">${categories || '—'}</td>
        </tr>
        <tr>
          <td style="padding:0.6rem 0;color:#888;font-size:0.85rem;vertical-align:top;padding-top:1rem">PARTS NEEDED</td>
          <td style="padding:0.6rem 0;color:#f9f7f2;padding-top:1rem">${parts || '—'}</td>
        </tr>
      </table>

      <div style="margin-top:2rem;padding:1rem;background:#1a1a1a;border-left:3px solid #B8952A">
        <p style="margin:0;color:#888;font-size:0.8rem">Submitted: ${new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })} EAT</p>
        <p style="margin:0.25rem 0 0;color:#888;font-size:0.8rem">Reply to: <a href="mailto:${email}" style="color:#B8952A">${email || 'No email provided'}</a></p>
      </div>

      <div style="margin-top:1.5rem;text-align:center">
        <a href="https://wa.me/${(phone || '').replace(/\D/g,'')}" style="background:#25D366;color:#000;padding:0.75rem 1.5rem;text-decoration:none;font-weight:bold;border-radius:4px;display:inline-block">
          💬 Reply on WhatsApp
        </a>
      </div>
    </div>
  `;
}


// ─────────────────────────────────────────────
//  ROUTE 1: Health Check
// ─────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Apex Motoren Kenya Backend',
    environment: NODE_ENV,
    version: '2.0.0'
  });
});


// ─────────────────────────────────────────────
//  ROUTE 2: Parts Request Form Submission
//  POST /submit-request
//  Body: { name, phone, email, country, vin, vehicle, parts, categories }
// ─────────────────────────────────────────────
app.post('/submit-request', async (req, res) => {
  try {
    const { name, phone, email, country, vin, vehicle, parts, categories } = req.body;

    // Validate required fields
    if (!name || !phone || !parts) {
      return res.status(400).json({
        success: false,
        message: 'Name, phone and parts description are required'
      });
    }

    console.log('📥 New parts request from:', name, phone);

    // Build WhatsApp message
    const whatsappMsg = `
🚗 NEW PARTS REQUEST — APEX MOTOREN KENYA

👤 Name: ${name}
📞 Phone: ${phone}
📧 Email: ${email || 'Not provided'}
🌍 Country: ${country || 'Not specified'}
🔑 VIN: ${vin || 'Not provided'}
🚙 Vehicle: ${vehicle || 'Not specified'}
📦 Category: ${categories || 'Not selected'}

🔧 Parts Needed:
${parts}

⏰ ${new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })} EAT
    `.trim();

    // Send both notifications simultaneously
    await Promise.all([
      sendEmail(
        `🚗 New Parts Request — ${name} (${country || 'Unknown'})`,
        buildEmailHTML(req.body)
      ),
      sendWhatsApp(whatsappMsg)
    ]);

    // Send confirmation back to website
    return res.json({
      success: true,
      message: 'Request received! We will contact you within 48 hours.',
      reference: 'APX-' + Date.now().toString().slice(-6)
    });

  } catch (error) {
    console.error('Submit error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error. Please try again or contact us on WhatsApp.'
    });
  }
});


// ─────────────────────────────────────────────
//  ROUTE 3: M-Pesa OAuth Token
// ─────────────────────────────────────────────
async function getAccessToken() {
  const credentials = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');
  const response = await axios.get(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${credentials}` }
  });
  return response.data.access_token;
}

function getTimestamp() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function getPassword(timestamp) {
  return Buffer.from(`${SHORTCODE}${PASSKEY}${timestamp}`).toString('base64');
}


// ─────────────────────────────────────────────
//  ROUTE 4: STK Push
//  POST /stk-push
//  Body: { phone, amount, reference, description }
// ─────────────────────────────────────────────
app.post('/stk-push', async (req, res) => {
  try {
    const { phone, amount, reference, description } = req.body;

    if (!phone || !amount || !reference) {
      return res.status(400).json({ success: false, message: 'phone, amount and reference are required' });
    }

    const formattedPhone = phone.replace(/\s/g,'').replace(/^\+/,'').replace(/^0/,'254');

    if (!/^2547\d{8}$/.test(formattedPhone)) {
      return res.status(400).json({ success: false, message: 'Invalid Safaricom number. Use format 07XX XXX XXX' });
    }

    const parsedAmount = Math.ceil(parseFloat(amount));
    if (isNaN(parsedAmount) || parsedAmount < 1) {
      return res.status(400).json({ success: false, message: 'Amount must be at least KES 1' });
    }

    const token = await getAccessToken();
    console.log('✅ Got access token');
    const timestamp = getTimestamp();
    const password = getPassword(timestamp);
    console.log('📤 STK Push - Phone:', formattedPhone, 'Amount:', parsedAmount, 'Ref:', reference, 'Shortcode:', SHORTCODE);

    const response = await axios.post(
      `${BASE_URL}/mpesa/stkpush/v1/processrequest`,
      {
        BusinessShortCode: SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: parsedAmount,
        PartyA: formattedPhone,
        PartyB: SHORTCODE,
        PhoneNumber: formattedPhone,
        CallBackURL: CALLBACK_URL,
        AccountReference: reference.substring(0, 12),
        TransactionDesc: (description || 'Apex Motoren Parts').substring(0, 13)
      },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );

    const data = response.data;

    if (data.ResponseCode === '0') {
      return res.json({
        success: true,
        message: 'Payment prompt sent. Ask customer to check their phone.',
        checkoutRequestId: data.CheckoutRequestID,
        merchantRequestId: data.MerchantRequestID
      });
    } else {
      return res.status(400).json({ success: false, message: data.ResponseDescription || 'STK push failed' });
    }

  } catch (error) {
    const errData = error?.response?.data;
    const errMsg = error?.message;
    console.error('❌ STK Push error:', JSON.stringify(errData || errMsg));
    console.error('❌ CONSUMER_KEY set:', !!CONSUMER_KEY);
    console.error('❌ CONSUMER_SECRET set:', !!CONSUMER_SECRET);
    console.error('❌ SHORTCODE:', SHORTCODE);
    console.error('❌ NODE_ENV:', NODE_ENV);
    console.error('❌ BASE_URL:', BASE_URL);
    return res.status(500).json({ 
      success: false, 
      message: errData?.errorMessage || errData?.ResponseDescription || errMsg || 'Server error. Please try again.'
    });
  }
});


// ─────────────────────────────────────────────
//  ROUTE 5: M-Pesa Payment Callback
//  POST /callback
// ─────────────────────────────────────────────
app.post('/callback', async (req, res) => {
  try {
    const result = req.body?.Body?.stkCallback;
    if (!result) return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });

    const { ResultCode, ResultDesc, CallbackMetadata, CheckoutRequestID } = result;

    if (ResultCode === 0) {
      const items = CallbackMetadata?.Item || [];
      const get = name => items.find(i => i.Name === name)?.Value;

      const payment = {
        checkoutRequestId: CheckoutRequestID,
        amount: get('Amount'),
        receiptNumber: get('MpesaReceiptNumber'),
        phone: get('PhoneNumber'),
        transactionDate: get('TransactionDate'),
      };

      console.log('✅ M-Pesa payment received:', payment);

      // Notify you via WhatsApp + email
      const msg = `💰 PAYMENT RECEIVED — APEX MOTOREN\n\nAmount: KES ${payment.amount}\nM-Pesa Code: ${payment.receiptNumber}\nPhone: ${payment.phone}\nRef: ${CheckoutRequestID}`;

      await Promise.all([
        sendWhatsApp(msg),
        sendEmail(
          `💰 Payment Received — KES ${payment.amount} (${payment.receiptNumber})`,
          `<div style="font-family:Arial;padding:2rem;background:#0a0a0a;color:#f9f7f2">
            <h2 style="color:#25D366">Payment Confirmed</h2>
            <p><strong>Amount:</strong> KES ${payment.amount}</p>
            <p><strong>M-Pesa Code:</strong> <span style="color:#B8952A;font-family:monospace">${payment.receiptNumber}</span></p>
            <p><strong>Phone:</strong> ${payment.phone}</p>
            <p><strong>Reference:</strong> ${CheckoutRequestID}</p>
            <p><strong>Time:</strong> ${new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })}</p>
          </div>`
        )
      ]);
    } else {
      console.log('❌ Payment failed/cancelled:', ResultDesc);
    }
  } catch (err) {
    console.error('Callback error:', err.message);
  }

  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});


// ─────────────────────────────────────────────
//  ROUTE 6: M-Pesa Query Status
//  POST /query
// ─────────────────────────────────────────────
app.post('/query', async (req, res) => {
  try {
    const { checkoutRequestId } = req.body;
    if (!checkoutRequestId) return res.status(400).json({ success: false, message: 'checkoutRequestId required' });

    const token = await getAccessToken();
    const timestamp = getTimestamp();
    const password = getPassword(timestamp);

    const response = await axios.post(
      `${BASE_URL}/mpesa/stkpushquery/v1/query`,
      { BusinessShortCode: SHORTCODE, Password: password, Timestamp: timestamp, CheckoutRequestID: checkoutRequestId },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const data = response.data;
    res.json({ success: true, resultCode: data.ResultCode, resultDesc: data.ResultDesc, paid: data.ResultCode === '0' });

  } catch (error) {
    res.status(500).json({ success: false, message: error?.response?.data || error.message });
  }
});


// ─────────────────────────────────────────────
//  START SERVER
// ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
  ┌─────────────────────────────────────────┐
  │  Apex Motoren Kenya Backend v2.0        │
  │  Port: ${PORT}                              │
  │  Mode: ${NODE_ENV}                    │
  │                                         │
  │  Routes:                                │
  │  POST /submit-request  ← Form alerts    │
  │  POST /stk-push        ← M-Pesa STK     │
  │  POST /callback        ← M-Pesa result  │
  │  POST /query           ← Check status   │
  └─────────────────────────────────────────┘
  `);
});
