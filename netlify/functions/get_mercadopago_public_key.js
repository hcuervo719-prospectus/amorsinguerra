// Netlify Function to expose public Mercado Pago key to the client
// This is safe to expose since it's a public key used by the client-side SDK

exports.handler = async function(event, context) {
  try {
    const PUBLIC_KEY = process.env.MERCADOPAGO_PUBLIC_KEY || '';
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicKey: PUBLIC_KEY })
    };
  } catch(err){
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
