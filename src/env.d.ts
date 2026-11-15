declare namespace App {
  // `import` statements don't work in a .d.ts that declares globals, hence import types.
  interface Locals {
    user: import('better-auth').User | null;
    session: import('better-auth').Session | null;
  }
}
