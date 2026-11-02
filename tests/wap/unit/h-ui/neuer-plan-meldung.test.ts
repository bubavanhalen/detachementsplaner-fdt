// @vitest-environment jsdom
// H-UI, Befund CR-H-U-09 (R-11-06; Beschrieb 5.7 «Meldungen nennen Ursache und nächsten Schritt»; UI-Richtlinie 12):
// Scheitert «Neuer Plan aus Vorlage» beim Anlegen, nennt der Dialog die Ursache und den nächsten Schritt des Fehlers
// statt nur «Die Angaben prüfen …». Fiktive Daten.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { beforeAll, describe, expect, it } from 'vitest';
import { NewPlanDialog } from '../../../../src/components/wap/i2/I2Application';
import { WapError } from '../../../../src/model/wap/errors';

beforeAll(() => {
  // jsdom kennt showModal/close nicht in jeder Fassung; der Dialog braucht nur «open».
  const proto = HTMLDialogElement.prototype as unknown as {
    showModal?: () => void;
    close?: () => void;
  };
  if (typeof proto.showModal !== 'function')
    proto.showModal = function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
  if (typeof proto.close !== 'function')
    proto.close = function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    };
});

function fillAndSubmit(): void {
  fireEvent.change(screen.getByRole('textbox', { name: 'Planname' }), {
    target: { value: 'Übungsplan Alpha' },
  });
  fireEvent.change(screen.getByRole('textbox', { name: 'Startdatum' }), {
    target: { value: '05.10.2026' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Anlegen' }));
}

describe('H-UI CR-H-U-09: Meldung beim Anlegen eines neuen Plans', () => {
  it('[R-11-06] Fehler beim Anlegen: Meldung mit Ursache und nächstem Schritt des Fehlers', async () => {
    render(
      createElement(NewPlanDialog, {
        busy: false,
        onClose: () => undefined,
        onCreate: () =>
          Promise.reject(
            new WapError('storageFull', {
              cause: 'Der Browserspeicher ist voll.',
              nextStep: 'Ältere Pläne als Datei sichern und löschen, dann erneut anlegen.',
            }),
          ),
      }),
    );
    fillAndSubmit();
    const alert = await waitFor(() => screen.getByRole('alert'));
    expect(alert.textContent).toContain('Der Browserspeicher ist voll.');
    expect(alert.textContent).toContain(
      'Ältere Pläne als Datei sichern und löschen, dann erneut anlegen.',
    );
  });

  it('[R-11-06] unbekannter Fehler beim Anlegen: Meldung nennt trotzdem eine Ursache und den nächsten Schritt', async () => {
    render(
      createElement(NewPlanDialog, {
        busy: false,
        onClose: () => undefined,
        onCreate: () => Promise.reject(new Error('intern')),
      }),
    );
    fillAndSubmit();
    const alert = await waitFor(() => screen.getByRole('alert'));
    expect(alert.textContent).toBe(
      'Der Plan konnte nicht angelegt werden. Die Angaben prüfen und erneut anlegen.',
    );
    expect(alert.textContent).not.toContain('intern');
  });
});
