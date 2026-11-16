export default [{
  files: ["**/*.js"],
  languageOptions: { ecmaVersion: 2022, sourceType: "script", globals: { window:"readonly", document:"readonly", localStorage:"readonly", navigator:"readonly", console:"readonly", setInterval:"readonly", clearInterval:"readonly", setTimeout:"readonly", alert:"readonly", indexedDB:"readonly", Worker:"readonly", Response:"readonly", Blob:"readonly", CompressionStream:"readonly", DecompressionStream:"readonly", performance:"readonly", requestAnimationFrame:"readonly", URL:"readonly", FileReader:"readonly", module:"readonly" } },
  rules: { "no-unused-vars": ["warn", { vars: "local", args: "none", caughtErrors: "none" }], "no-undef": "error", "no-empty": ["warn",{allowEmptyCatch:true}], "no-dupe-keys":"error", "no-unreachable":"warn", "no-self-assign":"warn", "no-redeclare":"error", "no-shadow":"off" }
}];
