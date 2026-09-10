/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";
import { enableTailwind } from '@remotion/tailwind-v4';

Config.setVideoImageFormat("jpeg");
// three.js needs a real GL backend in headless Chrome. On Windows "angle" is
// the renderer Remotion documents for WebGL scenes; without it the canvas
// renders black.
Config.setChromiumOpenGlRenderer("angle");
Config.setOverwriteOutput(true);
Config.overrideWebpackConfig(enableTailwind);
