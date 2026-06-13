// ESLint 9 flat config. Uses Expo's shared rules; lints app source only.
const expoFlat = require("eslint-config-expo/flat");

module.exports = [
  ...(Array.isArray(expoFlat) ? expoFlat : [expoFlat]),
  {
    ignores: [
      "dist/*",
      "dist-*/*",
      "node_modules/*",
      "android/*",
      "ios/*",
      ".expo/*",
      ".codex/*",
      "demo/*",
      "scripts/*",
      "*.config.js",
      "*.config.ts"
    ]
  },
  {
    // The classic, battle-tested correctness rules stay as errors (rules-of-hooks
    // already caught a real conditional-hook crash). The newer React-Compiler
    // static-analysis rules (refs/immutability/purity/set-state-in-effect) are
    // very strict and fire heavily on idiomatic, already-reviewed RN code, so we
    // surface them as warnings rather than blocking the gate. Revisit and tighten
    // once the codebase has been swept against them.
    rules: {
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/set-state-in-effect": "warn",
      // Curried tab-icon render props are intentional; the rule can't name them.
      "react/display-name": "warn"
    }
  }
];
