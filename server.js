const express = require('express');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Securely load Bybit API keys from environment
const apiKey = process.env.BYBIT_API_KEY;
const apiSecret = process.env.BYBIT_API_SECRET;

// 🔁 Fetch server time from Bybit
const fetchServerTime = async () => {
  const response = await axios.get('https://api.bybit.com/v5/market/time');
  const serverTimeNano = response.data.result.timeNano;
  return Math.floor(parseInt(serverTimeNano) / 1000000); // Convert to ms
};

// 🔐 Generate signature
const createSignature = (timestamp, body, secret) => {
  const rawRequestBody = JSON.stringify(body);
  const str = `${timestamp}${apiKey}5000${rawRequestBody}`;
  return crypto.createHmac('sha256', secret).update(str).digest('hex');
};

// 🧾 Fetch P2P ads from Bybit
const fetchAdList = async () => {
  const timestamp = await fetchServerTime();

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

  const ads = response.data?.result?.items;
  if (!ads || !Array.isArray(ads)) throw new Error('Invalid ad list');

  return ads.map(ad => ({
    price: ad.price,
    quantity: ad.quantity,
    maxAmount: ad.maxAmount,
    minAmount: ad.minAmount,
  }));
};

// ✅ API Endpoint
app.get('/fetch-price', async (req, res) => {
  try {
    const sellRates = await fetchAdList();
    res.json({ sellRates });
  } catch (err) {
    console.error('❌ Error:', err.response?.data || err.message);
    res.status(500).send('Failed to fetch sell rates');
  }
});

// Health check route
app.get('/', (req, res) => {
  res.send('✅ Server is running!');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
