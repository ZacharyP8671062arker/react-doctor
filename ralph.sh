#!/bin/bash
MAX=20
for i in $(seq 1 $MAX); do
  echo "=== iteration $i/$MAX ==="
  OUTPUT=$(claude -p "study @PROMPT.md and follow the instructions there. check @progress.md for what's already done. do the next chunk of work and update progress.md. when ALL tasks in PROMPT.md are fully complete, output the exact tag <promise>TASKS COMPLETE</promise> on its own line. otherwise do not output that tag. DO NOT COMMIT ANY CODE, ONLY WORK IN THE WORKING TREE." \
    --dangerously-skip-permissions) || { echo "claude exited nonzero, stopping"; break; }

  echo "$OUTPUT"

  if echo "$OUTPUT" | grep -q "<promise>TASKS COMPLETE</promise>"; then
    echo "=== agent reported completion, halting ==="
    break
  fi
done
