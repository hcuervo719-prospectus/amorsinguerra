// Netlify Function to create Mercado Pago preference
// Requires environment variable MP_ACCESS_TOKEN (Mercado Pago Access Token)

exports.handler = async function(event, context) {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const { fullname = '', email = '', whatsapp = '', price = '9', stage = '' } = body;

    // Support multiple possible env var names for the Mercado Pago access token
    // Prefer MP_ACCESS_TOKEN but fall back to other common names if present
    const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || process.env.MERCADOPAGO_ACCESS_TOKEN || process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if(!ACCESS_TOKEN){
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Missing MP_ACCESS_TOKEN environment variable' })
      };
    }

    // Determine origin to set back_urls
    const origin = (event.headers && (event.headers.origin || event.headers['x-forwarded-proto'] && event.headers.host ? `${event.headers['x-forwarded-proto'] || 'https'}://${event.headers.host}` : null)) || `https://${process.env.URL || 'example.com'}`;

    const preference = {
      items: [
        {
          title: 'Serie Amor Sin Guerra - Acceso Digital',
          quantity: 1,
          unit_price: Number(price)
        }
      ],
      payer: {
        email: email || undefined
      },
      back_urls: {
        success: origin + '/confirmacion.html',
        failure: origin + '/checkout.html',
        pending: origin + '/confirmacion.html'
      },
      auto_return: 'approved',
      external_reference: `${fullname}|${email}|stage:${stage}`
    };

    const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ACCESS_TOKEN}`
      },
      body: JSON.stringify(preference)
    });

    if(!res.ok){
      const text = await res.text();
      return { statusCode: res.status, body: JSON.stringify({ error: text }) };
    }

    const data = await res.json();
    return {
      statusCode: 200,
      body: JSON.stringify({ id: data.id, init_point: data.init_point })
    };
  } catch(err){
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
