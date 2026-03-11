// book-lead.js
// Handles inline form submissions from coachprincetonbasketball.com/book/
// 1. Creates contact in GoHighLevel (primary CRM)
// 2. Writes lead to Airtable (backup)

const GHL_API_KEY     = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE   = 'Book Page Leads';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': 'https://coachprincetonbasketball.com',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let name, email;
  try {
    const body = JSON.parse(event.body || '{}');
    email = (body.email || '').trim().toLowerCase();
    name  = (body.name  || '').trim();
  } catch (e) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  if (!email || !email.includes('@')) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Valid email required' }) };
  }

  // Parse first/last name
  const nameParts = name.split(' ').filter(Boolean);
  const firstName  = nameParts[0] || '';
  const lastName   = nameParts.slice(1).join(' ') || '';

  const timestamp = new Date().toISOString();
  const errors = [];

  // ── 1. GoHighLevel — create/update contact ───────────────────────────────────
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
          firstName,
          lastName,
          source: 'book-page-inline-form',
          tags: ['book-page-lead', 'inline-form', 'playbook-interest'],
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

  // ── 2. Airtable — backup store ───────────────────────────────────────────────
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
              Name:  name || email,
              Email: email,
              Source: 'book-page-inline-form',
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
