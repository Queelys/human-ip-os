#!/usr/bin/env bash
# C005 TASK 01/02 technical QC of the actual final master. Every step's exit
# code is logged to out/c005-qc.log; exits non-zero if any step fails.
#   REMOTION_BROWSER_EXECUTABLE=<headless chromium> bash scripts/c005-qc.sh
set -u
cd "$(dirname "$0")/.."
LOG=out/c005-qc.log
: "${REMOTION_BROWSER_EXECUTABLE:?set REMOTION_BROWSER_EXECUTABLE}"
export REMOTION_BROWSER_EXECUTABLE
mkdir -p out/c005
: > "$LOG"
FAILED=0
step() {
	echo "===== $* ($(date -u +%Y-%m-%dT%H:%M:%SZ))" | tee -a "$LOG"
	"$@" >> "$LOG" 2>&1
	local rc=$?
	echo "EXIT $rc :: $*" | tee -a "$LOG"
	[ $rc -eq 0 ] || FAILED=1
}
step bash -c 'git rev-parse HEAD; git status --short | head -20; node --version; ffmpeg -version | head -1'
step bash -c 'sha256sum renders/masters/mi-final-1080p.mp4 renders/mi-visual-master-1080p.mp4 renders/audio/mi-audio-master.wav renders/audio/mi-audio-final.m4a'
step bash -c 'ffprobe -v error -count_frames -show_format -show_streams -of json renders/masters/mi-final-1080p.mp4 > out/c005/ffprobe.json && cat out/c005/ffprobe.json'
step npm run test:log
step npm run build
step npm run test:integration
step npm run qc:final
step node scripts/qc-c005-frames.mjs
step node scripts/c005-identity-check.mjs
step node scripts/c005-keyframes.mjs
step node scripts/collect-evidence-c005.mjs
echo "C005 QC $([ $FAILED -eq 0 ] && echo PASS || echo FAIL)" | tee -a "$LOG"
exit $FAILED
