const fs = require('fs');

// Netlify Function to receive Mercado Pago webhooks (IPN)
// Configure your Mercado Pago webhook URL to: https://<your-site>/.netlify/functions/mercadopago_webhook
// Requires MERCADOPAGO_ACCESS_TOKEN env variable (server-side secret)

exports.handler = async function(event, context) {
  try{
    const ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if(!ACCESS_TOKEN){
      return { statusCode: 500, body: JSON.stringify({ error: 'Missing MERCADOPAGO_ACCESS_TOKEN' }) };
    }

    // Mercado Pago may send notifications as GET with query params or POST with JSON body
    const method = event.httpMethod;
    let paymentId = null;

    if(method === 'GET'){
      // Example: ?topic=payment&id=12345
      const q = event.queryStringParameters || {};
      if(q.id) paymentId = q.id;
      if(q['data.id']) paymentId = q['data.id'];
    } else if(method === 'POST'){
      // Parse body
      const body = event.body ? JSON.parse(event.body) : {};
      // Could be { 'type': 'payment', 'data': { 'id': '12345' } }
      if(body.data && (body.data.id || body.data['id'])) paymentId = body.data.id || body.data['id'];
      // Or body.id
      if(!paymentId && body.id) paymentId = body.id;

      // Some Mercado Pago webhooks include resource -> { resource: { id: 'xx' } }
      if(!paymentId && body.resource && body.resource.id) paymentId = body.resource.id;
    }

    if(!paymentId){
      // Nothing to do but acknowledge
      return { statusCode: 200, body: JSON.stringify({ ok: true, message: 'no payment id' }) };
    }

    // Fetch payment details from Mercado Pago API to confirm status
    const resp = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`
      }
    });

    if(!resp.ok){
      const txt = await resp.text();
      return { statusCode: resp.status, body: JSON.stringify({ error: 'MercadoPago fetch failed', details: txt }) };
    }

    const payment = await resp.json();
    const record = {
      id: payment.id || paymentId,
      status: payment.status || null,
      status_detail: payment.status_detail || null,
      amount: payment.transaction_amount || payment.amount || null,
      currency: payment.currency_id || null,
      date_created: payment.date_created || new Date().toISOString(),
      payer: (payment.payer && { email: payment.payer.email, first_name: payment.payer.first_name, last_name: payment.payer.last_name }) || null,
      raw: payment
    };

    // Persist record to data/orders.json (append)
    const ordersPath = './data/orders.json';
    let orders = [];
    try{
      if(fs.existsSync(ordersPath)){
        const content = fs.readFileSync(ordersPath, 'utf8');
        orders = content ? JSON.parse(content) : [];
      }
    }catch(e){
      // ignore parse errors and overwrite
      orders = [];
    }

    orders.push(record);
    fs.writeFileSync(ordersPath, JSON.stringify(orders, null, 2));

    // Optionally: If payment approved, you might want to send confirmation email or mark access.
    // This function just records the payment. You can extend it to call other services.

    return { statusCode: 200, body: JSON.stringify({ ok: true, payment: { id: record.id, status: record.status } }) };

  }catch(err){
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
