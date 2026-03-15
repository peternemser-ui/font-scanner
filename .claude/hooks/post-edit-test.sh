#!/bin/bash
# PostToolUse hook for Write/Edit — runs related tests for critical files
# Only triggers for files with known test mappings. Informational only (always exits 0).

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

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Normalize path separators
NORM_PATH=$(echo "$FILE_PATH" | sed 's|\\|/|g')

# Map source files to their test files
TEST_PATH=""
case "$NORM_PATH" in
  */utils/entitlements.js)
    TEST_PATH="tests/utils/entitlements" ;;
  */routes/webhooks.js)
    TEST_PATH="tests/integration/webhooks" ;;
  */services/stripeService.js)
    TEST_PATH="tests/services/stripeService" ;;
  */services/authService.js)
    TEST_PATH="tests/services/authService" ;;
  */middleware/scanQuota.js)
    TEST_PATH="tests/middleware/scanQuota" ;;
  */middleware/auth*.js)
    TEST_PATH="tests/middleware/auth" ;;
  */utils/validators.js)
    TEST_PATH="tests/utils/validators" ;;
esac

# Only run tests if we have a mapping
if [ -z "$TEST_PATH" ]; then
  exit 0
fi

cd "$PROJECT_ROOT" 2>/dev/null
echo "[hooks] Running related tests: $TEST_PATH"
npx jest "$TEST_PATH" --passWithNoTests --silent 2>/dev/null
exit 0
