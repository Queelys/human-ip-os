#!/bin/sh
# Launch the real headless Chromium (MI_CHROME_BIN) with an explicit opt-in to
# SwiftShader software WebGL. Chrome deprecates the implicit fallback and warns
# without this flag; Remotion 4.0.525 does not add it for the `swangle` renderer.
# See docs/DECISIONS.md D-013.
if [ -z "$MI_CHROME_BIN" ]; then
	echo "MI_CHROME_BIN is not set" >&2
	exit 1
fi
exec "$MI_CHROME_BIN" --enable-unsafe-swiftshader "$@"
