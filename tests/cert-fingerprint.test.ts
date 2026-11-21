import { describe, expect, it } from "vitest";
import { normalizeCertFingerprint, parseCertFingerprint } from "@/lib/quick-share/api-settings";

// openssl / PowerShell(GetCertHashString(SHA256)) / sha256(DER) の3通りで一致を確認した CN=choko1229 のテスト証明書の値
const plain = "5B7DACD2F79C38EBFC615951170BD485FF6D86494E24E3154E641EB0AFF9B925";
const colon = "5B:7D:AC:D2:F7:9C:38:EB:FC:61:59:51:17:0B:D4:85:FF:6D:86:49:4E:24:E3:15:4E:64:1E:B0:AF:F9:B9:25";
const sha1Thumbprint = "B1FE8E314989010AFA0A1B2C8D3E841C46C65FD2";

describe("certificate fingerprint input (admin: 署名証明書のフィンガープリント)", () => {
  it.each([
    ["64 hex without separators (PowerShell / certutil)", plain],
    ["colon separated pairs (openssl -fingerprint -sha256)", colon],
    ["lower case", plain.toLowerCase()],
    ["surrounding whitespace", `  ${colon}\n`],
  ])("accepts %s and normalizes to AB:CD:…", (_label, input) => {
    expect(parseCertFingerprint(input)).toEqual({ ok: true, value: colon });
  });

  it.each([
    ["Windows' SHA-1 thumbprint (40 hex)", sha1Thumbprint],
    ["SHA-1 with colons", (sha1Thumbprint.match(/.{2}/g) ?? []).join(":")],
  ])("rejects %s with a dedicated reason", (_label, input) => {
    expect(parseCertFingerprint(input)).toEqual({ ok: false, reason: "sha1" });
  });

  it.each([
    ["63 hex", plain.slice(1)],
    ["65 hex", `${plain}0`],
    ["non-hex", `${plain.slice(1)}G`],
    ["colons in irregular places", `${plain.slice(0, 4)}:${plain.slice(4)}`],
    ["space separated pairs", colon.replace(/:/g, " ")],
    ["trailing colon", `${colon}:`],
    ["the publisher name instead of a fingerprint", "CN=choko1229"],
  ])("rejects %s", (_label, input) => {
    expect(parseCertFingerprint(input)).toEqual({ ok: false, reason: "format" });
  });

  it("returns null from the settings reader for stored invalid values", () => {
    expect(normalizeCertFingerprint(sha1Thumbprint)).toBeNull();
    expect(normalizeCertFingerprint(plain)).toBe(colon);
  });
});
