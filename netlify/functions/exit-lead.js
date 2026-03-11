// exit-lead.js
// Handles exit-intent popup submissions from coachprincetonbasketball.com/book/
// 1. Writes lead to Airtable
// 2. Creates contact in GoHighLevel
// 3. Sends email via Resend with Chin Set PDF download link

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE   = process.env.AIRTABLE_TABLE_NAME || 'Exit Intent Leads';

const RESEND_API_KEY   = process.env.RESEND_API_KEY;

const GHL_API_KEY     = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;

const PDF_URL = 'https://coachprincetonbasketball.com/files/princeton-chin-set.pdf';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': 'https://coachprincetonbasketball.com',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const EMAIL_HTML = (pdfUrl) => `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #2d3748;">
  <div style="background-color: #1a1a2e; padding: 24px 32px;">
    <h1 style="color: #ffffff; margin: 0; font-size: 22px;">Coach Princeton Basketball</h1>
    <p style="color: #a0aec0; margin: 4px 0 0; font-size: 13px;">The Princeton Offense System</p>
  </div>

  <div style="padding: 32px;">
    <h2 style="color: #1a365d; margin-top: 0;">Your Free Princeton Chin Set Breakdown</h2>

    <p>Thanks for your interest in the Princeton Offense system.</p>

    <p>The <strong>Chin Set</strong> is one of the core actions in the Princeton system — it creates
    read-and-react opportunities off the high post and teaches players to process the defense in real time.</p>

    <p style="text-align: center; margin: 36px 0;">
      <a href="${pdfUrl}"
         style="background-color: #2b6cb0; color: #ffffff; padding: 16px 32px;
                text-decoration: none; border-radius: 6px; font-size: 16px;
                font-weight: bold; display: inline-block;">
        📄 Download the Chin Set PDF
      </a>
    </p>

    <p>If you have questions about the Princeton system or the full playbook, just reply to this email.</p>

    <p style="margin-bottom: 0;">– Coach DeForest<br>
    <strong>coachprincetonbasketball.com</strong></p>
  </div>

  <div style="background-color: #f7fafc; padding: 16px 32px; border-top: 1px solid #e2e8f0;">
    <p style="font-size: 12px; color: #718096; margin: 0;">
      coachprincetonbasketball.com<br>
      You're receiving this because you requested a free resource from our website.
    </p>
  </div>
</div>`;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let email;
  try {
    const body = JSON.parse(event.body || '{}');
    email = (body.email || '').trim().toLowerCase();
  } catch (e) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  if (!email || !email.includes('@')) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Valid email required' }) };
  }

  const timestamp = new Date().toISOString();
  const errors = [];

  // ── 1. Airtable ─────────────────────────────────────────────────────────────
  if (AIRTABLE_API_KEY && AIRTABLE_BASE_ID) {
    try {
      const atRes = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE)}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${AIRTABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fields: {
              Email: email,
              Source: 'exit-intent-popup',
              Page: 'coachprincetonbasketball.com/book/',
              'Submitted At': timestamp,
            },
          }),
        }
      );
      if (!atRes.ok) {
        const errText = await atRes.text().catch(() => '');
        console.error('Airtable error:', atRes.status, errText);
        errors.push('airtable');
      }
    } catch (e) {
      console.error('Airtable exception:', e.message);
      errors.push('airtable');
    }
  }

  // ── 2. GoHighLevel — create/update contact ────────────────────────────────────
  if (GHL_API_KEY && GHL_LOCATION_ID) {
    try {
      const ghlRes = await fetch('https://services.leadconnectorhq.com/contacts/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GHL_API_KEY}`,
          'Version': '2021-07-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          locationId: GHL_LOCATION_ID,
          email,
          source: 'exit-intent-popup',
          tags: ['exit-intent', 'book-page', 'free-pdf-request'],
        }),
      });
      if (!ghlRes.ok) {
        const errText = await ghlRes.text().catch(() => '');
        console.error('GHL error:', ghlRes.status, errText);
        errors.push('ghl');
      } else {
        const ghlData = await ghlRes.json().catch(() => ({}));
        console.log('GHL contact created/updated:', ghlData?.contact?.id || 'ok');
      }
    } catch (e) {
      console.error('GHL exception:', e.message);
      errors.push('ghl');
    }
  } else {
    console.error('GHL env vars not set — skipping GHL');
    errors.push('ghl-config');
  }

  // ── 3. Resend: send email with PDF link ──────────────────────────────────────
  if (RESEND_API_KEY) {
    try {
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Coach Princeton Basketball <coach@coachprincetonbasketball.com>',
          to: [email],
          subject: 'Your Princeton Chin Set Breakdown (Free PDF)',
          html: EMAIL_HTML(PDF_URL),
        }),
      });
      if (!emailRes.ok) {
        const errText = await emailRes.text().catch(() => '');
        console.error('Resend error:', emailRes.status, errText);
        errors.push('resend-email');
      }
    } catch (e) {
      console.error('Resend exception:', e.message);
      errors.push('resend-email');
    }
  } else {
    console.error('RESEND_API_KEY not set — email not sent');
    errors.push('resend-email');
  }

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      ok: true,
      email,
      ...(errors.length ? { warnings: errors } : {}),
    }),
  };
};
