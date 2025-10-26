/**
 * Quick script to test rate limit headers and 429 response
 */

const http = require('http');

const makeRequest = (count) => {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/test',
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', (error) => {
      console.error('Request error:', error);
      resolve(null);
    });

    req.end();
  });
};

async function testRateLimit() {
  console.log('🧪 Testing Rate Limit Headers...\n');
  
  for (let i = 1; i <= 105; i++) {
    const result = await makeRequest(i);
    
    if (!result) continue;

    if (result.status === 429) {
      console.log(`\n✅ Rate limit triggered on request #${i}`);
      console.log(`Status Code: ${result.status}`);
      console.log(`\nResponse Headers:`);
      console.log(`  RateLimit-Limit: ${result.headers['ratelimit-limit'] || 'MISSING'}`);
      console.log(`  RateLimit-Remaining: ${result.headers['ratelimit-remaining'] || 'MISSING'}`);
      console.log(`  RateLimit-Reset: ${result.headers['ratelimit-reset'] || 'MISSING'}`);
      console.log(`  Retry-After: ${result.headers['retry-after'] || 'MISSING ⚠️'}`);
      console.log(`\nResponse Body:`);
      console.log(JSON.stringify(JSON.parse(result.body), null, 2));
      break;
    } else if (i % 20 === 0) {
      console.log(`Request #${i}: ${result.status} - Remaining: ${result.headers['ratelimit-remaining']}`);
    }
  }
}

testRateLimit().catch(console.error);
