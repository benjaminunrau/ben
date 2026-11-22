import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { contactLabel, contactLink } from "../../src/capabilities/contact-links.ts";
import { contactChannel, phoneNumber } from "../../src/schemas/contact.ts";

/** Parses a channel that has its own name (everything but the form). */
const namedChannel = (input: unknown) => {
  const channel = contactChannel.parse(input);
  assert.notEqual(channel.type, "form");
  return channel as Exclude<typeof channel, { type: "form" }>;
};

const issuePaths = (input: unknown) => {
  const result = contactChannel.safeParse(input);
  assert.ok(!result.success, "expected the channel to be rejected");
  return result.error.issues.map((issue) => issue.path.join("."));
};

describe("phoneNumber", () => {
  it("normalizes common separators to E.164", () => {
    assert.equal(phoneNumber.parse("+595 (981) 000-111"), "+595981000111");
    assert.equal(phoneNumber.parse("+49.30.1234567"), "+49301234567");
  });

  it("rejects numbers without a country code or with letters", () => {
    for (const value of ["0981 000111", "+0 981000111", "+595 98 CALL ME", "+1"]) {
      assert.equal(phoneNumber.safeParse(value).success, false, value);
    }
  });
});

describe("contactChannel", () => {
  it("rejects a profile URL on another domain", () => {
    assert.deepEqual(issuePaths({ id: "github", type: "profile", network: "github", url: "https://github.com.evil.example/me" }), ["url"]);
  });

  it("rejects an unknown channel type", () => {
    assert.deepEqual(issuePaths({ id: "fax", type: "fax", number: "+1 555 0100" }), ["type"]);
  });

  it("rejects fields that belong to another channel type", () => {
    assert.ok(issuePaths({ id: "email", type: "email", address: "me@example.com", phone: "+1 555 010 0100" }).length > 0);
  });
});

describe("form channel", () => {
  const form = { id: "message", type: "form" };

  it("carries no address", () => {
    assert.deepEqual(contactChannel.parse(form), form);
    assert.ok(issuePaths({ ...form, address: "me@example.com" }).length > 0);
  });

  it("links to the contact section on the same page", () => {
    assert.deepEqual(contactLink(contactChannel.parse(form)), { href: "#contact" });
  });
});

describe("whatsapp-reveal channel", () => {
  const reveal = { id: "whatsapp", type: "whatsapp-reveal" };

  it("holds no phone number, and rejects one", () => {
    assert.deepEqual(contactChannel.parse(reveal), reveal);
    assert.ok(issuePaths({ ...reveal, phone: "+595 981 000 111" }).length > 0);
  });

  it("is named WhatsApp and links to the contact section where its button is", () => {
    const channel = namedChannel(reveal);
    assert.equal(contactLabel(channel), "WhatsApp");
    assert.deepEqual(contactLink(channel), { href: "#contact" });
  });
});

describe("contactLink", () => {
  it("links email in the same tab", () => {
    const channel = namedChannel({ id: "email", type: "email", address: "me@example.com" });
    assert.deepEqual(contactLink(channel), { href: "mailto:me@example.com" });
    assert.equal(contactLabel(channel), "me@example.com");
  });

  it("links WhatsApp by its normalized number in a new, isolated tab", () => {
    const channel = namedChannel({ id: "whatsapp", type: "whatsapp", phone: "+595 981 000 111" });
    assert.deepEqual(contactLink(channel), { href: "https://wa.me/595981000111", target: "_blank", rel: "noopener noreferrer" });
    assert.equal(contactLabel(channel), "WhatsApp");
  });

  it("links profiles to their URL and names the network", () => {
    const channel = namedChannel({ id: "in", type: "profile", network: "linkedin", url: "https://www.linkedin.com/in/me/" });
    assert.equal(contactLink(channel).href, "https://www.linkedin.com/in/me/");
    assert.equal(contactLabel(channel), "LinkedIn");
  });
});
