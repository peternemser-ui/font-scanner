#!/bin/bash
# PostToolUse hook for Write/Edit — runs eslint on edited .js files
# Informational only (always exits 0)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Extract file_path from tool input JSON
if [ -n "$1" ]; then
  FILE_PATH=$(echo "$1" | node -e "
    let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{
      try { const j=JSON.parse(d); console.log(j.file_path||j.filePath||''); }
      catch(e) { console.log(''); }
    });
  " 2>/dev/null)
else
  FILE_PATH=""
fi

# Skip if no file path or not a .js file
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

case "$FILE_PATH" in
  *.js) ;;
  *) exit 0 ;;
esac

# Skip node_modules, vendor, etc.
case "$FILE_PATH" in
  *node_modules*|*vendor*|*.min.js) exit 0 ;;
esac

# Run eslint (informational — never block)
cd "$PROJECT_ROOT" 2>/dev/null
npx eslint --no-error-on-unmatched-pattern "$FILE_PATH" 2>/dev/null
exit 0
