/**
 * Remotion CLI configuration. Applies to `remotion studio`, `render`, `still`
 * and `bundle`. See docs/DECISIONS.md for the reasoning behind each setting.
 */
import {Config} from '@remotion/cli/config';

// Software ANGLE (SwiftShader) gives WebGL without a GPU and identical
// pixels across runs on the same machine.
Config.setChromiumOpenGlRenderer('swangle');

// Lossless intermediate frames before H.264 encoding.
Config.setVideoImageFormat('png');
Config.setCodec('h264');
Config.setPixelFormat('yuv420p');
Config.setOverwriteOutput(true);

// Optional: point at a pre-installed headless Chromium instead of letting
// Remotion download its own (useful in offline / CI containers).
if (process.env.REMOTION_BROWSER_EXECUTABLE) {
	Config.setBrowserExecutable(process.env.REMOTION_BROWSER_EXECUTABLE);
}
