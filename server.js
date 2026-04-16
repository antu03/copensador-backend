const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// ── Obtener token de Azure AD ──────────────────────────────────────
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

// ── Ejecutar DAX ───────────────────────────────────────────────────
app.post('/dax', async (req, res) => {
  try {
    const { query, workspaceId, datasetId } = req.body;
    if (!query) return res.status(400).json({ error: 'query requerida' });

    // Usa los IDs del request si vienen, sino los del .env como fallback
    const wsId = workspaceId || process.env.WORKSPACE_ID;
    const dsId = datasetId || process.env.DATASET_ID;

    if (!wsId || !dsId) return res.status(400).json({ error: 'workspaceId y datasetId requeridos' });

    const token = await getAccessToken();
    const url = `https://api.powerbi.com/v1.0/myorg/groups/${wsId}/datasets/${dsId}/executeQueries`;

    const response = await axios.post(url,
      { queries: [{ query }], serializerSettings: { includeNulls: true } },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );

    res.json(response.data);
  } catch (error) {
    console.error(error?.response?.data || error.message);
    res.status(500).json({ error: error?.response?.data || error.message });
  }
});

// ── Health check ───────────────────────────────────────────────────
app.get('/', (req, res) => res.json({ status: 'ok', service: 'Copensador DAX API' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));