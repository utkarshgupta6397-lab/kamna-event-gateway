const http = require('http');

const options = {
  hostname: '127.0.0.1',
  port: 3004,
  path: '/api/v1/webhook-inspector?page=1&limit=50',
  method: 'GET',
  headers: {
    'Authorization': 'Bearer mocktoken'
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Status:', res.statusCode, 'Body:', data));
});
req.on('error', console.error);
req.end();
