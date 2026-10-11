#!/usr/bin/env bash
# C003 acceptance: clean install, all gates (C001 + C002 regression, C003),
# deliverable renders and evidence. Every step's exit code is logged; the run
# continues after a failure so the log shows the full picture, and exits
# non-zero if any step failed.
#   REMOTION_BROWSER_EXECUTABLE=<headless chromium> bash scripts/acceptance-c003.sh
set -u
LOG=${LOG:-out/acceptance-c003.log}
: "${REMOTION_BROWSER_EXECUTABLE:?set REMOTION_BROWSER_EXECUTABLE}"
export REMOTION_BROWSER_EXECUTABLE
rm -rf node_modules build build-debugger out renders
mkdir -p out
: > "$LOG"
FAILED=0
step() {
	echo "===== $* ($(date -u +%H:%M:%S))" | tee -a "$LOG"
	"$@" >> "$LOG" 2>&1
	local rc=$?
	echo "EXIT $rc :: $*" | tee -a "$LOG"
	[ $rc -eq 0 ] || FAILED=1
}
step npm install
step npm run lint
step npm run typecheck
step npm run test:log
step npm run build
step npm run test:integration
# C001 regression
step npm run render:test -- --log=error
step npm run verify:video
step npm run verify:determinism
step npm run verify:preview
# C002 regression
step npm run verify:debugger
# C003 renders + smoke tests
step npm run render:film:preview
step npm run render:film:master
step npm run verify:film:video
step npm run verify:film
step npm run render:contact-sheet
step node scripts/collect-evidence-c003.mjs
echo "ACCEPTANCE $([ $FAILED -eq 0 ] && echo PASS || echo FAIL)" | tee -a "$LOG"
exit $FAILED
