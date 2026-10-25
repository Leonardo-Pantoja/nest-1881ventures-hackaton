const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? files(file) : /\.test\.(ts|cjs)$/.test(file) ? [file] : [];
  });
}
if (process.argv[2]) {
  const ts = require("typescript");
  const Module = require("node:module");
  const resolve = Module._resolveFilename;
  Module._resolveFilename = function (name, ...args) {
    return resolve.call(this, name.startsWith("@/") ? path.resolve("src", name.slice(2)) : name, ...args);
  };
  for (const extension of [".ts", ".tsx"]) {
    require.extensions[extension] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText, filename);
  }
  require(path.resolve(process.argv[2]));
} else {
  for (const file of [...files("src/lib"), ...files("tests")]) {
    console.log(`\nRunning ${file}`);
    const result = spawnSync(process.execPath, [__filename, file], { stdio: "inherit" });
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}
