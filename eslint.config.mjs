import js from "@eslint/js";
import jsdoc from "eslint-plugin-jsdoc";
import globals from "globals";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs}"],
    plugins: {
      js,
      jsdoc
    },
    extends: ["js/recommended"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        THREE: "readonly",
        GPUComputationRenderer: "readonly",
        OrbitControls: "readonly"
      }
    },
    rules: {
      // Best Practices
      "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
      "no-console": ["warn", { 
        "allow": [
          "warn", 
          "error",
          "log"  // Allow console.log for startup messages
        ] 
      }],
      "no-debugger": "warn",
      "no-duplicate-imports": "error",
      "no-var": "error",
      "prefer-const": "error",
      
      // Code Style
      "indent": ["error", 4, { "SwitchCase": 1 }],
      "linebreak-style": ["error", "unix"],
      "quotes": ["error", "single", { "avoidEscape": true }],
      "semi": ["error", "always"],
      
      // Documentation
      "jsdoc/require-jsdoc": ["warn", {
        "require": {
          "FunctionDeclaration": true,
          "MethodDefinition": true,
          "ClassDeclaration": true
        }
      }],
      
      // Three.js specific
      "no-undef": ["error", { "typeof": true }],
      
      // Performance
      "no-constant-condition": ["error", { "checkLoops": false }]
    }
  }
]);