/** Where a Link lives: its Code at the root, handled by the Redirect route. */
export function linkPath(code: string) {
  return `/${code}`;
}

export function linkUrl(opts: { code: string; origin: string }) {
  return new URL(linkPath(opts.code), opts.origin).href;
}
