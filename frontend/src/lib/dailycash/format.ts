// Money formatting for Daily Cash. Framework-free on purpose: the reminder
// message builder (a pure string function) needs it, and so do the screens.

/** 487500 → "487 500". Mirrors the prototypes' `fmt()`. */
export function fcfa(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
