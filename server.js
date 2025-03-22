const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const { RestClientV5 } = require('bybit-api');


const app = express();
const PORT = process.env.PORT || 3000;

// Securely load API keys from environment variables
const apiKey = process.env.BYBIT_API_KEY;
const apiSecret = process.env.BYBIT_API_SECRET;

const client = new RestClientV5({
  testnet: true
});



const createSignature = (timestamp, body, secret) => {
  const rawRequestBody = JSON.stringify(body);
  const str = `${timestamp}${apiKey}5000${rawRequestBody}`;
  return crypto.createHmac('sha256', secret).update(str).digest('hex');
};

const fetchAdList = async () => {
  const serverTimeResponse = await client.getServerTime();
  const serverTimeNano = parseInt(serverTimeResponse.result.timeNano);
  const timestamp = Math.floor(serverTimeNano / 1000000);

  const body = {
    tokenId: 'USDT',
    currencyId: 'NGN',
    side: '1',
  };

  const headers = {
    'Content-Type': 'application/json',
    'X-BAPI-API-KEY': apiKey,
    'X-BAPI-TIMESTAMP': timestamp.toString(),
    'X-BAPI-RECV-WINDOW': '5000',
    'X-BAPI-SIGN': createSignature(timestamp.toString(), body, apiSecret),
  };

  const response = await axios.post(
    'https://api.bybit.com/v5/p2p/item/online',
    body,
    { headers }
  );

  if (response.data.result && Array.isArray(response.data.result.items)) {
    return response.data.result.items.map(ad => ({
      price: ad.price,
      quantity: ad.quantity,
      maxAmount: ad.maxAmount,
      minAmount: ad.minAmount,
    }));
  } else {
    throw new Error('Invalid API response');
  }
};

app.get('/fetch-price', async (req, res) => {
  try {
    const sellRates = await fetchAdList();
    res.json({ sellRates });
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to fetch rates');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
