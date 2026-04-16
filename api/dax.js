const axios = require('axios');

async function getAccessToken() {
  const url = `https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/token`;
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.CLIENT_ID,
    client_secret: process.env.CLIENT_SECRET,
    scope: 'https://analysis.windows.net/powerbi/api/.default'
  });
  const response = await axios.post(url, params);
  return response.data.access_token;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { query, workspaceId, datasetId } = req.body;
  if (!query) return res.status(400).json({ error: 'query requerida' });

  const wsId = workspaceId || process.env.WORKSPACE_ID;
  const dsId = datasetId || process.env.DATASET_ID;

  try {
    const token = await getAccessToken();
    const url = `https://api.powerbi.com/v1.0/myorg/groups/${wsId}/datasets/${dsId}/executeQueries`;
    const response = await axios.post(url,
      { queries: [{ query }], serializerSettings: { includeNulls: true } },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error?.response?.data || error.message });
  }
}