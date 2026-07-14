// Root entry shim. Keeping the entry file inside the project root lets Metro
// serve worktrees whose node_modules is a symlink into the main checkout —
// "main": "expo-router/entry" resolves to a realpath outside the project root
// and breaks the dev-client bundle URL there. Identical behavior in prod builds.
import 'expo-router/entry';
