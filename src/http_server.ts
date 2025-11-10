import http from 'http';
import dotenv from 'dotenv';
import { handleCreatePointRule, handleListPointRules } from '../src/api/pointRules';
import { handleCreateTierRule, handleListTierRules } from '../src/api/tierRules';
//import { handleEnableLoyalty } from '../src/api/business';
import { handleCollectoAuth, handleCollectoAuthVerify } from '../src/api/collectoAuth';
dotenv.config();

const PORT = Number(process.env.PORT ?? 4000);

const server = http.createServer(async (req, res) => {
  
  if (req.method === 'POST' && req.url === '/point-rules') return handleCreatePointRule(req, res);
  if (req.method === 'GET' && req.url === '/point-rules') return handleListPointRules(req, res);

  if (req.method === 'POST' && req.url === '/tier-rules') return handleCreateTierRule(req, res);
  if (req.method === 'GET' && req.url === '/tier-rules') return handleListTierRules(req, res);

  //if (req.method === 'POST' && req.url === '/business/enable') return handleEnableLoyalty(req, res);

  // inside your existing server routing

// add:
if (req.method === 'POST' && req.url === '/collecto/auth') return handleCollectoAuth(req, res);
if (req.method === 'POST' && req.url === '/collecto/authVerify') return handleCollectoAuthVerify(req, res);


  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: 'not_found' }));
});

server.listen(PORT, () => console.log(`API server listening on http://localhost:${PORT}`));
