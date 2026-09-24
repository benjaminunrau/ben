import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { contactLabel, contactLink } from "../../src/capabilities/contact-links.ts";
import { contactChannel, phoneNumber } from "../../src/schemas/contact.ts";

const issuePaths = (input: unknown) => {
  const result = contactChannel.safeParse(input);
  assert.ok(!result.success, "expected the channel to be rejected");
  return result.error.issues.map((issue) => issue.path.join("."));
};

describe("phoneNumber", () => {
  it("normalizes common separators to E.164", () => {
    assert.equal(phoneNumber.parse("+595 (986) 361-808"), "+595986361808");
    assert.equal(phoneNumber.parse("+49.30.1234567"), "+49301234567");
  });

  it("rejects numbers without a country code or with letters", () => {
    for (const value of ["0986 361808", "+0 986361808", "+595 98 CALL ME", "+1"]) {
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

describe("contactLink", () => {
  it("links email in the same tab", () => {
    const channel = contactChannel.parse({ id: "email", type: "email", address: "me@example.com" });
    assert.deepEqual(contactLink(channel), { href: "mailto:me@example.com" });
    assert.equal(contactLabel(channel), "me@example.com");
  });

  it("links WhatsApp by its normalized number in a new, isolated tab", () => {
    const channel = contactChannel.parse({ id: "whatsapp", type: "whatsapp", phone: "+595 986 361808" });
    assert.deepEqual(contactLink(channel), { href: "https://wa.me/595986361808", target: "_blank", rel: "noopener noreferrer" });
    assert.equal(contactLabel(channel), "WhatsApp");
  });

  it("links profiles to their URL and names the network", () => {
    const channel = contactChannel.parse({ id: "in", type: "profile", network: "linkedin", url: "https://www.linkedin.com/in/me/" });
    assert.equal(contactLink(channel).href, "https://www.linkedin.com/in/me/");
    assert.equal(contactLabel(channel), "LinkedIn");
  });
});
