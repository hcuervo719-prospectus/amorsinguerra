// Netlify Function to create a PayPal order and return approval URL
// Expects environment variables: PAYPAL_CLIENT_ID, PAYPAL_SECRET (and optional PAYPAL_MODE='live' or 'sandbox')

exports.handler = async function(event, context) {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const { price = '9', fullname = '', email = '', whatsapp = '', stage = '' } = body;

    const CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
    const SECRET = process.env.PAYPAL_SECRET;
    const MODE = (process.env.PAYPAL_MODE || 'sandbox').toLowerCase();

    if(!CLIENT_ID || !SECRET){
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Missing PAYPAL_CLIENT_ID or PAYPAL_SECRET environment variables' })
      };
    }

    const base = MODE === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

    // Determine origin to set return/cancel URLs
    const origin = (event.headers && (event.headers.origin || (event.headers['x-forwarded-proto'] && event.headers.host ? `${event.headers['x-forwarded-proto'] || 'https'}://${event.headers.host}` : null))) || `https://${process.env.URL || 'example.com'}`;

    // Get access token
    const tokenRes = await fetch(base + '/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(CLIENT_ID + ':' + SECRET).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    if(!tokenRes.ok){
      const text = await tokenRes.text();
      return { statusCode: tokenRes.status, body: JSON.stringify({ error: text }) };
    }

    const tokenJson = await tokenRes.json();
    const accessToken = tokenJson.access_token;

    // Create order
    const orderRes = await fetch(base + '/v2/checkout/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: 'USD',
              value: String(price)
            },
            custom_id: `${stage}`
          }
        ],
        application_context: {
          return_url: origin + '/confirmacion.html',
          cancel_url: origin + '/checkout.html'
        }
      })
    });

    if(!orderRes.ok){
      const text = await orderRes.text();
      return { statusCode: orderRes.status, body: JSON.stringify({ error: text }) };
    }

    const orderJson = await orderRes.json();
    // Find approval link
    const approveLink = (orderJson.links || []).find(l => l.rel === 'approve');
    const approval_url = approveLink ? approveLink.href : null;

    return {
      statusCode: 200,
      body: JSON.stringify({ id: orderJson.id, approval_url })
    };
  } catch(err){
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
