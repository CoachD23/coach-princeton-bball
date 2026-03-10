// exit-lead.js
// Handles exit-intent popup submissions from coachprincetonbasketball.com/book/
// 1. Writes lead to Airtable
// 2. Creates/updates GHL contact with tags
// 3. Sends GHL email with Chin Set PDF download link

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE   = process.env.AIRTABLE_TABLE_NAME || 'Exit Intent Leads';

const GHL_API_KEY      = process.env.GHL_API_KEY || 'pit-7b89fafc-4dc4-4f93-bb7b-11c2fb99c53a';
const GHL_LOCATION_ID  = process.env.GHL_LOCATION_ID || 'jBDUi7Sma6tCl3eXKBmX';
const GHL_BASE_URL     = 'https://services.leadconnectorhq.com';

const PDF_URL = 'https://coachprincetonbasketball.com/files/princeton-chin-set.pdf';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': 'https://coachprincetonbasketball.com',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function ghlFetch(method, path, body) {
  return fetch(`${GHL_BASE_URL}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${GHL_API_KEY}`,
      'Version': '2021-07-28',
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

const EMAIL_HTML = (pdfUrl) => `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #2d3748;">
  <div style="background-color: #1a365d; padding: 24px 32px;">
    <h1 style="color: #ffffff; margin: 0; font-size: 22px;">Florida Coastal Prep</h1>
    <p style="color: #bee3f8; margin: 4px 0 0; font-size: 13px;">Princeton Offense System</p>
  </div>

  <div style="padding: 32px;">
    <h2 style="color: #1a365d; margin-top: 0;">Your Free Princeton Chin Set Breakdown</h2>

    <p>Thanks for your interest in Coach DeForest's Princeton Offense system.</p>

    <p>The <strong>Chin Set</strong> is one of the core actions we use at FCP — it creates read-and-react
    opportunities off the high post and teaches players to process the defense in real time.</p>

    <p style="text-align: center; margin: 36px 0;">
      <a href="${pdfUrl}"
         style="background-color: #2b6cb0; color: #ffffff; padding: 16px 32px;
                text-decoration: none; border-radius: 6px; font-size: 16px;
                font-weight: bold; display: inline-block;">
        📄 Download the Chin Set PDF
      </a>
    </p>

    <p>If you have questions about the Princeton system, our program, or how FCP develops players —
    just reply to this email. We read every one.</p>

    <p style="margin-bottom: 0;">– Coach DeForest<br>
    <strong>Florida Coastal Prep</strong></p>
  </div>

  <div style="background-color: #f7fafc; padding: 16px 32px; border-top: 1px solid #e2e8f0;">
    <p style="font-size: 12px; color: #718096; margin: 0;">
      Florida Coastal Prep &nbsp;|&nbsp; coachprincetonbasketball.com<br>
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

  // ── 2. GHL: create/update contact ───────────────────────────────────────────
  let contactId = null;
  try {
    // Search for existing contact by email (POST /contacts/search)
    const searchRes = await ghlFetch('POST', '/contacts/search', {
      locationId: GHL_LOCATION_ID,
      query: email,
      pageLimit: 5,
    });
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.contacts && searchData.contacts.length > 0) {
        // Match exact email since query does a loose search
        const match = searchData.contacts.find(
          (c) => (c.email || '').toLowerCase() === email
        );
        if (match) {
          contactId = match.id;
          // Tag existing contact
          await ghlFetch('POST', `/contacts/${contactId}/tags`, {
            tags: ['exit-intent-popup', 'book-page', 'chin-set-downloaded'],
          });
        }
      }
    }

    // Create new contact if not found
    if (!contactId) {
      const createRes = await ghlFetch('POST', '/contacts/', {
        locationId: GHL_LOCATION_ID,
        email,
        tags: ['exit-intent-popup', 'book-page', 'chin-set-downloaded'],
        source: 'exit-intent-popup',
      });
      if (createRes.ok) {
        const createData = await createRes.json();
        contactId = createData.contact?.id;
      } else {
        const errText = await createRes.text().catch(() => '');
        console.error('GHL create contact error:', createRes.status, errText);
        errors.push('ghl-contact');
      }
    }
  } catch (e) {
    console.error('GHL contact exception:', e.message);
    errors.push('ghl-contact');
  }

  // ── 3. GHL: send email with PDF link ────────────────────────────────────────
  if (contactId) {
    try {
      const msgRes = await ghlFetch('POST', '/conversations/messages', {
        type: 'Email',
        contactId,
        subject: 'Your Princeton Chin Set Breakdown (Free PDF)',
        html: EMAIL_HTML(PDF_URL),
      });
      if (!msgRes.ok) {
        const errText = await msgRes.text().catch(() => '');
        console.error('GHL email error:', msgRes.status, errText);
        errors.push('ghl-email');
      }
    } catch (e) {
      console.error('GHL email exception:', e.message);
      errors.push('ghl-email');
    }
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
