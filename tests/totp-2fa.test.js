const path = require("path");
const crypto = require("crypto");
const { laadFuncties } = require("./extractie");
const { sectie, test } = require("./testhulp");

const BESTAND = path.join(__dirname, "..", "lib", "auth.js");
const { BASE32_ALFABET, base32Encode, base32Decode, hotp, verifyTotpCode } = laadFuncties(
  BESTAND,
  [/^const BASE32_ALFABET/m, /^function base32Encode\(/m, /^function base32Decode\(/m, /^function hotp\(/m, /^function verifyTotpCode\(/m],
  { crypto }
);

sectie("2FA — RFC 6238 officiële testvector (Appendix B)");
{
  // Testvector uit de RFC: geheim = ASCII "12345678901234567890", tijdstap
  // T=1 (Unix-tijd 59, 30s-stappen) hoort een code te geven die eindigt op
  // "287082" (bij 6-cijferige afkapping).
  const rfcSecret = Buffer.from("12345678901234567890", "ascii");
  const code = hotp(rfcSecret, 1);
  test("berekende code komt exact overeen met de RFC-testvector", code === "287082");
}

sectie("2FA — base32 heen-en-terug-conversie (zoals echt gebruikt bij het instellen)");
{
  const rfcSecret = Buffer.from("12345678901234567890", "ascii");
  const alsBase32 = base32Encode(rfcSecret);
  const terugGedecodeerd = base32Decode(alsBase32);
  const code = hotp(terugGedecodeerd, 1);
  test("code klopt nog steeds na encode/decode round-trip (dit is hoe de QR-code echt werkt)", code === "287082");
}

sectie("2FA — verifyTotpCode accepteert geldige code, weigert ongeldige");
{
  const secretBuffer = crypto.randomBytes(20);
  const secret = base32Encode(secretBuffer);
  const geldigeCode = hotp(base32Decode(secret), Math.floor(Date.now() / 1000 / 30));
  test("een correct berekende, actuele code wordt geaccepteerd", verifyTotpCode(secret, geldigeCode));
  test("een willekeurige, foute code wordt geweigerd", verifyTotpCode(secret, "000000") === false || geldigeCode === "000000");
  test("een niet-6-cijferige invoer wordt altijd geweigerd", verifyTotpCode(secret, "12345") === false);
  test("lege invoer crasht niet en wordt geweigerd", verifyTotpCode(secret, "") === false);
}
