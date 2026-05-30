import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  consumeGuestCredit,
  getGuestCreditStatus,
  GUEST_SESSION_LIMIT,
  refundGuestCredit,
} from "./guestCredits.js";

function installSessionStorage() {
  const store = new Map();
  vi.stubGlobal("sessionStorage", {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => { store.set(key, String(value)); },
    removeItem: (key) => { store.delete(key); },
    clear: () => { store.clear(); },
  });
}

describe("guestCredits", () => {
  beforeEach(() => {
    installSessionStorage();
    sessionStorage.clear();
  });

  it("starts with one free generation", () => {
    const status = getGuestCreditStatus();
    expect(status.remaining).toBe(GUEST_SESSION_LIMIT);
    expect(status.used).toBe(0);
  });

  it("consumes credit only when generation succeeds", () => {
    expect(consumeGuestCredit()).toBe(true);
    expect(getGuestCreditStatus().remaining).toBe(0);
    expect(consumeGuestCredit()).toBe(false);
  });

  it("refunds credit after a failed generation", () => {
    consumeGuestCredit();
    expect(getGuestCreditStatus().remaining).toBe(0);
    refundGuestCredit();
    expect(getGuestCreditStatus().remaining).toBe(GUEST_SESSION_LIMIT);
  });

  it("does not refund below zero", () => {
    refundGuestCredit();
    expect(getGuestCreditStatus().used).toBe(0);
  });
});
