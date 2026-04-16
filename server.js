const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.options('*', cors());
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
async function executeDAX(query, workspaceId, datasetId) {
  const wsId = workspaceId || process.env.WORKSPACE_ID;
  const dsId = datasetId || process.env.DATASET_ID;
  const token = await getAccessToken();
  const url = `https://api.powerbi.com/v1.0/myorg/groups/${wsId}/datasets/${dsId}/executeQueries`;
  const response = await axios.post(url,
    { queries: [{ query }], serializerSettings: { includeNulls: true } },
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );
  return response.data;
}

// ── REST endpoint original ─────────────────────────────────────────
app.post('/dax', async (req, res) => {
  try {
    const { query, workspaceId, datasetId } = req.body;
    if (!query) return res.status(400).json({ error: 'query requerida' });
    const result = await executeDAX(query, workspaceId, datasetId);
    res.json(result);
  } catch (error) {
    console.error(error?.response?.data || error.message);
    res.status(500).json({ error: error?.response?.data || error.message });
  }
});

// ── MCP endpoint ───────────────────────────────────────────────────
app.get('/mcp', (req, res) => {
  res.json({
    name: 'Copensador DAX API',
    version: '1.0.0',
    description: 'Ejecuta queries DAX contra modelos semánticos de Power BI',
    tools: [
      {
        name: 'ejecutar_dax',
        description: 'Ejecuta una query DAX contra el modelo semántico de Power BI y retorna los resultados',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Query DAX a ejecutar' },
            workspaceId: { type: 'string', description: 'ID del workspace de Power BI' },
            datasetId: { type: 'string', description: 'ID del dataset de Power BI' }
          },
          required: ['query']
        }
      }
    ]
  });
});

app.post('/mcp', async (req, res) => {
  try {
    const { tool, input } = req.body;
    if (tool !== 'ejecutar_dax') {
      return res.status(400).json({ error: 'Herramienta no reconocida' });
    }
    const { query, workspaceId, datasetId } = input;
    if (!query) return res.status(400).json({ error: 'query requerida' });
    const result = await executeDAX(query, workspaceId, datasetId);
    res.json({ result });
  } catch (error) {
    console.error(error?.response?.data || error.message);
    res.status(500).json({ error: error?.response?.data || error.message });
  }
});

// ── Health check ───────────────────────────────────────────────────
app.get('/', (req, res) => res.json({ status: 'ok', service: 'Copensador DAX API' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));