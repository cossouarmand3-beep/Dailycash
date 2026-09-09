import { describe, expect, it } from 'vitest';
import { relanceMessage } from './relance';

describe('relanceMessage', () => {
  it("quotes the freelancer's own number when it is on file", () => {
    const msg = relanceMessage({
      clientName: 'Restaurant Teranga',
      amount: 60000,
      phone: '77 123 45 67',
    });
    expect(msg).toContain('Restaurant Teranga');
    expect(msg).toContain('60 000 FCFA');
    expect(msg).toContain('Wave ou Orange Money au 77 123 45 67');
  });

  it('NEVER invents a payment number when none is on file', () => {
    // The regression this guards: the prototype's placeholder "77 000 00 00"
    // shipped into production text, so every reminder sent a paying client
    // to a number that belongs to nobody.
    for (const phone of [undefined, null, '', '   ']) {
      const msg = relanceMessage({ clientName: 'Boutique Awa', amount: 25000, phone });
      expect(msg).not.toContain('77 000 00 00');
      expect(msg).not.toMatch(/Wave ou Orange Money au/);
      expect(msg).toContain('Dites-moi comment vous préférez régler');
    }
  });

  it('still states the client and the amount without a number', () => {
    const msg = relanceMessage({ clientName: 'Sokhna', amount: 180000, phone: null });
    expect(msg).toContain('Bonjour Sokhna');
    expect(msg).toContain('180 000 FCFA');
  });

  it('trims a padded number', () => {
    const msg = relanceMessage({ clientName: 'X', amount: 1000, phone: '  770000000  ' });
    expect(msg).toContain('au 770000000.');
  });
});
