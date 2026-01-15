/*
 * Audits frontend API calls to ensure deterministic scan identity.
 * Prints POST /api/* fetch calls that appear to be missing scanStartedAt in the request body.
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', 'src', 'public');

const interestingApi = /\/api\/(scan|scan\/best-in-class|seo|performance|performance-snapshot|security|accessibility|core-web-vitals|competitive-analysis|hosting|mobile|ip-reputation|tag-intelligence|local-seo|brand-consistency|broken-links|cro|gdpr)/;

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (path.extname(p) === '.js') out.push(p);
  }
  return out;
}

function getRequestTargetsFromLine(line) {
  // Handles:
  // - fetch('/api/foo' ...) fetch("/api/foo" ...) fetch(`/api/foo` ...)
  // - axios.post('/api/foo', ...) axios.post(`/api/foo`, ...)
  // - xhr.open('POST','/api/foo') xhr.open("POST", "/api/foo")

  const fetchMatch = line.match(/\bfetch\(\s*(['"`])(\/api\/[^'"`]+)\1/);
  if (fetchMatch) return { kind: 'fetch', api: fetchMatch[2] };

  const axiosPostMatch = line.match(/\baxios\.post\(\s*(['"`])(\/api\/[^'"`]+)\1/);
  if (axiosPostMatch) return { kind: 'axios.post', api: axiosPostMatch[2] };

  const xhrOpenMatch = line.match(/\.open\(\s*(['"])POST\1\s*,\s*(['"`])(\/api\/[^'"`]+)\2/);
  if (xhrOpenMatch) return { kind: 'xhr.open', api: xhrOpenMatch[3] };

  return null;
}

const files = walk(root);
const findings = [];

for (const filePath of files) {
  const text = fs.readFileSync(filePath, 'utf8');
  // Fast pre-filter: only parse files that look like they call our APIs.
  if (!text.includes('/api/')) continue;

  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const target = getRequestTargetsFromLine(lines[i]);
    if (!target) continue;
    const api = target.api;
    if (!interestingApi.test(api)) continue;

    const windowText = lines.slice(i, Math.min(lines.length, i + 50)).join('\n');
    const isPostFetch = /method\s*:\s*['\"]POST['\"]/.test(windowText);
    const hasFetchBody = /body\s*:\s*JSON\.stringify\(/.test(windowText);
    const hasAxiosData = /\baxios\.post\(/.test(windowText);
    const isXhrPost = /\.open\(\s*(['"])POST\1\s*,/.test(windowText);

    // Only flag calls that look like POST-ish request flows.
    if (target.kind === 'fetch' && (!isPostFetch || !hasFetchBody)) continue;
    if (target.kind === 'axios.post' && !hasAxiosData) continue;
    if (target.kind === 'xhr.open' && !isXhrPost) continue;

    // Simple heuristic: scanStartedAt appears as a property or shorthand within the JSON.stringify object.
    const hasScanStartedAt = /\bscanStartedAt\b\s*:/.test(windowText) || /\bscanStartedAt\b\s*[,}\]]/.test(windowText);

    if (!hasScanStartedAt) {
      findings.push({
        file: path.relative(path.resolve(__dirname, '..'), filePath).replace(/\\/g, '/'),
        line: i + 1,
        api,
      });
    }
  }
}

if (!findings.length) {
  console.log('✅ No missing scanStartedAt found for interesting POST /api/* fetch calls.');
  process.exit(0);
}

console.log('⚠️ Potential missing scanStartedAt in POST bodies:');
for (const f of findings) {
  console.log(`- ${f.file}:${f.line}  ${f.api}`);
}
console.log(`Total: ${findings.length}`);
