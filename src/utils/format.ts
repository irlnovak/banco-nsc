import { formatBRL } from './money';

/** yyyy-mm-dd → dd/mm/aaaa */
export function formatDateBR(iso: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export { formatBRL };
