export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // SSE handshake
  if (req.method === 'GET') {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send server info
    res.write(`data: ${JSON.stringify({
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        serverInfo: { name: 'Copensador DAX API', version: '1.0.0' },
        capabilities: { tools: {} }
      }
    })}\n\n`);

    // Send tools list
    res.write(`data: ${JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/list',
      result: {
        tools: [{
          name: 'ejecutar_dax',
          description: 'Ejecuta una query DAX contra Power BI y retorna los resultados',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Query DAX a ejecutar' },
              workspaceId: { type: 'string', description: 'ID del workspace' },
              datasetId: { type: 'string', description: 'ID del dataset' }
            },
            required: ['query']
          }
        }]
      }
    })}\n\n`);

    req.on('close', () => res.end());
    return;
  }

  // Handle tool calls
  if (req.method === 'POST') {
    const { method, params, id } = req.body;

    if (method === 'tools/call' && params?.name === 'ejecutar_dax') {
      const axios = (await import('axios')).default;
      const { query, workspaceId, datasetId } = params.arguments;

      try {
        const tokenUrl = `https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/token`;
        const tokenParams = new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: process.env.CLIENT_ID,
          client_secret: process.env.CLIENT_SECRET,
          scope: 'https://analysis.windows.net/powerbi/api/.default'
        });
        const tokenRes = await axios.post(tokenUrl, tokenParams);
        const token = tokenRes.data.access_token;

        const wsId = workspaceId || process.env.WORKSPACE_ID;
        const dsId = datasetId || process.env.DATASET_ID;
        const daxUrl = `https://api.powerbi.com/v1.0/myorg/groups/${wsId}/datasets/${dsId}/executeQueries`;

        const daxRes = await axios.post(daxUrl,
          { queries: [{ query }], serializerSettings: { includeNulls: true } },
          { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
        );

        return res.json({
          jsonrpc: '2.0',
          id,
          result: { content: [{ type: 'text', text: JSON.stringify(daxRes.data) }] }
        });
      } catch (error) {
        return res.json({
          jsonrpc: '2.0',
          id,
          error: { code: -32000, message: error?.response?.data || error.message }
        });
      }
    }

    return res.json({
      jsonrpc: '2.0',
      id,
      result: { content: [{ type: 'text', text: 'OK' }] }
    });
  }
}