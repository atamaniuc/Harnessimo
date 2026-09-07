// A resolver over an in-memory tree: every rule in src/ is pure, so its tests
// need no fixture directory and no cleanup.
export function fakeResolver({ files = {}, commands = {}, migrations = null } = {}) {
  return {
    fileExists: (path) => Object.hasOwn(files, path),
    readFile: (path) => files[path],
    commandNames: (kind) => commands[kind] ?? null,
    migrationNames: () => migrations,
  };
}
