export function go(to: string) {
  if (to.startsWith('#/')) {
    window.location.hash = to.slice(1);
  } else {
    window.location.assign(to);
  }
}
