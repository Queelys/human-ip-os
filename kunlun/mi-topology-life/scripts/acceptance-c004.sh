#!/usr/bin/env bash
# C004 acceptance: clean install, all gates (C001–C003 regression, C004),
# audio + final renders, QC and evidence. The frozen C003 deliverables in
# renders/*.mp4|png are NOT deleted or re-rendered; their hashes are checked
# before and after. Every step's exit code is logged.
#   REMOTION_BROWSER_EXECUTABLE=<headless chromium> bash scripts/acceptance-c004.sh
set -u
LOG=${LOG:-out/acceptance-c004.log}
: "${REMOTION_BROWSER_EXECUTABLE:?set REMOTION_BROWSER_EXECUTABLE}"
export REMOTION_BROWSER_EXECUTABLE
rm -rf node_modules build build-debugger out renders/audio renders/masters
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
frozen() { sha256sum renders/mi-visual-master-1080p.mp4 renders/mi-preview-540p.mp4 renders/mi-storyboard-contact-sheet.png; }
step frozen
step bash -c 'node --version; npm --version; ffmpeg -version | head -1; "$REMOTION_BROWSER_EXECUTABLE" --version'
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
# C003 regression (frozen renders are verified, not re-rendered)
step npm run verify:film:video
step npm run verify:film
# C004
step npm run audio:master
step node scripts/audio-determinism.mjs
step npm run render:final:picture
step npm run final:mux
step npm run qc:final
step bash -c 'ffprobe -v error -show_format -show_streams -of json renders/masters/mi-final-1080p.mp4 > out/logs/ffprobe-final.json && cat out/logs/ffprobe-final.json'
step frozen
step node scripts/collect-evidence-c004.mjs
echo "ACCEPTANCE $([ $FAILED -eq 0 ] && echo PASS || echo FAIL)" | tee -a "$LOG"
exit $FAILED
