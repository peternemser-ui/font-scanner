#!/bin/bash
# PreToolUse hook for Write/Edit — checks invariants on the target file
# Receives tool input JSON via $1 or stdin

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Extract file_path from the tool input JSON
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

# Skip if no file path extracted
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Run invariant checks
node "$SCRIPT_DIR/check-invariants.js" "$FILE_PATH"
