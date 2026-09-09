// The ready-made reminder the freelancer sends by WhatsApp or SMS.
//
// SAFETY: this text goes to a real client and tells them where to send money.
// The prototype hard-coded "77 000 00 00" as a mockup placeholder; shipping
// that meant every reminder pointed a paying client at a number belonging to
// nobody. The payment sentence is therefore emitted ONLY when the freelancer
// has actually recorded their own Wave / Orange Money number — never with a
// placeholder, never with a guess.

import { fcfa } from './format';

export interface RelanceInput {
  clientName: string;
  amount: number;
  /** The FREELANCER's own payment number, not the client's. */
  phone?: string | null | undefined;
}

export function relanceMessage({ clientName, amount, phone }: RelanceInput): string {
  const trimmed = phone?.trim();
  const payment = trimmed
    ? ` Vous pouvez régler par Wave ou Orange Money au ${trimmed}.`
    : // No number on file: ask rather than invent one.
      ' Dites-moi comment vous préférez régler (Wave, Orange Money ou espèces).';

  return `Bonjour ${clientName}, petit rappel pour la facture de ${fcfa(amount)} FCFA.${payment} Merci !`;
}
