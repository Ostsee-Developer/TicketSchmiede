import { createHash, createPublicKey, randomBytes, verify as verifySignature } from "crypto";

type CborValue = number | bigint | string | Buffer | CborValue[] | Map<CborValue, CborValue>;

export interface WebAuthnRequestInfo {
  origin: string;
  rpId: string;
  rpName: string;
}

export interface RegistrationCredentialJson {
  rawId: string;
  response: {
    clientDataJSON: string;
    attestationObject: string;
    transports?: string[];
  };
}

export interface AuthenticationCredentialJson {
  rawId: string;
  response: {
    clientDataJSON: string;
    authenticatorData: string;
    signature: string;
  };
}

export function toBase64url(value: Buffer | Uint8Array | string): string {
  const buffer = typeof value === "string" ? Buffer.from(value) : Buffer.from(value);
  return buffer.toString("base64url");
}

export function fromBase64url(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

export function newChallenge(): string {
  return randomBytes(32).toString("base64url");
}

export function getWebAuthnRequestInfo(request: Request): WebAuthnRequestInfo {
  const url = new URL(request.url);
  const origin = process.env.WEBAUTHN_ORIGIN ?? url.origin;
  const rpId = process.env.WEBAUTHN_RP_ID ?? new URL(origin).hostname;
  const rpName = process.env.WEBAUTHN_RP_NAME ?? process.env.NEXT_PUBLIC_APP_NAME ?? "Ticket Schmiede";
  return { origin, rpId, rpName };
}

export function publicKeyCredentialCreationOptions(params: {
  challenge: string;
  userId: string;
  userName: string;
  userDisplayName: string;
  rp: WebAuthnRequestInfo;
  excludeCredentialIds: string[];
}) {
  return {
    challenge: params.challenge,
    rp: { name: params.rp.rpName, id: params.rp.rpId },
    user: {
      id: toBase64url(params.userId),
      name: params.userName,
      displayName: params.userDisplayName,
    },
    pubKeyCredParams: [{ type: "public-key", alg: -7 }],
    timeout: 60000,
    attestation: "none",
    authenticatorSelection: {
      userVerification: "preferred",
      residentKey: "preferred",
    },
    excludeCredentials: params.excludeCredentialIds.map((id) => ({
      type: "public-key",
      id,
      transports: ["internal", "hybrid", "usb", "nfc", "ble"],
    })),
  };
}

export function publicKeyCredentialRequestOptions(params: {
  challenge: string;
  allowCredentialIds: string[];
  rpId: string;
}) {
  return {
    challenge: params.challenge,
    rpId: params.rpId,
    timeout: 60000,
    userVerification: "preferred",
    allowCredentials: params.allowCredentialIds.map((id) => ({
      type: "public-key",
      id,
      transports: ["internal", "hybrid", "usb", "nfc", "ble"],
    })),
  };
}

export function verifyRegistrationResponse(params: {
  credential: RegistrationCredentialJson;
  expectedChallenge: string;
  expectedOrigin: string;
  rpId: string;
}) {
  const clientData = parseClientData(params.credential.response.clientDataJSON);
  assertClientData(clientData, "webauthn.create", params.expectedChallenge, params.expectedOrigin);

  const attestationObject = decodeCbor(fromBase64url(params.credential.response.attestationObject));
  if (!(attestationObject instanceof Map)) throw new Error("Invalid attestation object");

  const authData = attestationObject.get("authData");
  if (!Buffer.isBuffer(authData)) throw new Error("Missing authenticator data");

  verifyRpIdHash(authData, params.rpId);
  if ((authData[32] & 0x01) !== 0x01) throw new Error("User presence is required");
  if ((authData[32] & 0x40) !== 0x40) throw new Error("Attested credential data is missing");

  const credentialData = parseAttestedCredentialData(authData);
  const rawId = fromBase64url(params.credential.rawId);
  if (!credentialData.credentialId.equals(rawId)) throw new Error("Credential ID mismatch");

  return {
    credentialId: toBase64url(credentialData.credentialId),
    publicKey: toBase64url(credentialData.publicKeyCose),
    counter: credentialData.counter,
    transports: params.credential.response.transports ?? [],
  };
}

export function verifyAuthenticationResponse(params: {
  credential: AuthenticationCredentialJson;
  expectedChallenge: string;
  expectedOrigin: string;
  rpId: string;
  storedCredentialId: string;
  publicKey: string;
  counter: number;
}) {
  const clientData = parseClientData(params.credential.response.clientDataJSON);
  assertClientData(clientData, "webauthn.get", params.expectedChallenge, params.expectedOrigin);

  const credentialId = toBase64url(fromBase64url(params.credential.rawId));
  if (credentialId !== params.storedCredentialId) throw new Error("Credential ID mismatch");

  const authData = fromBase64url(params.credential.response.authenticatorData);
  verifyRpIdHash(authData, params.rpId);
  if ((authData[32] & 0x01) !== 0x01) throw new Error("User presence is required");

  const clientDataHash = createHash("sha256").update(fromBase64url(params.credential.response.clientDataJSON)).digest();
  const signedData = Buffer.concat([authData, clientDataHash]);
  const spki = createPublicKey({
    key: coseEc2ToSpki(fromBase64url(params.publicKey)),
    format: "der",
    type: "spki",
  });
  const isValid = verifySignature("sha256", signedData, spki, fromBase64url(params.credential.response.signature));
  if (!isValid) throw new Error("Invalid WebAuthn signature");

  const newCounter = authData.readUInt32BE(33);
  if (params.counter > 0 && newCounter > 0 && newCounter <= params.counter) {
    throw new Error("Authenticator counter did not increase");
  }

  return { credentialId, counter: newCounter };
}

function parseClientData(clientDataJson: string) {
  return JSON.parse(fromBase64url(clientDataJson).toString("utf8")) as {
    type?: string;
    challenge?: string;
    origin?: string;
  };
}

function assertClientData(
  clientData: { type?: string; challenge?: string; origin?: string },
  expectedType: string,
  expectedChallenge: string,
  expectedOrigin: string
) {
  if (clientData.type !== expectedType) throw new Error("Unexpected WebAuthn response type");
  if (clientData.challenge !== expectedChallenge) throw new Error("Challenge mismatch");
  if (clientData.origin !== expectedOrigin) throw new Error("Origin mismatch");
}

function verifyRpIdHash(authData: Buffer, rpId: string) {
  const expected = createHash("sha256").update(rpId).digest();
  if (!authData.subarray(0, 32).equals(expected)) throw new Error("RP ID hash mismatch");
}

function parseAttestedCredentialData(authData: Buffer) {
  let offset = 37;
  offset += 16;
  const credentialIdLength = authData.readUInt16BE(offset);
  offset += 2;
  const credentialId = authData.subarray(offset, offset + credentialIdLength);
  offset += credentialIdLength;
  const publicKeyCose = authData.subarray(offset);
  return {
    credentialId,
    publicKeyCose,
    counter: authData.readUInt32BE(33),
  };
}

function coseEc2ToSpki(coseKey: Buffer): Buffer {
  const decoded = decodeCbor(coseKey);
  if (!(decoded instanceof Map)) throw new Error("Invalid COSE key");

  const kty = decoded.get(1);
  const alg = decoded.get(3);
  const crv = decoded.get(-1);
  const x = decoded.get(-2);
  const y = decoded.get(-3);

  if (kty !== 2 || alg !== -7 || crv !== 1 || !Buffer.isBuffer(x) || !Buffer.isBuffer(y)) {
    throw new Error("Only ES256 P-256 passkeys are supported");
  }

  const uncompressedPoint = Buffer.concat([Buffer.from([0x04]), x, y]);
  const prefix = Buffer.from("3059301306072a8648ce3d020106082a8648ce3d030107034200", "hex");
  return Buffer.concat([prefix, uncompressedPoint]);
}

function decodeCbor(buffer: Buffer): CborValue {
  const decoder = new CborDecoder(buffer);
  return decoder.decode();
}

class CborDecoder {
  private offset = 0;

  constructor(private readonly buffer: Buffer) {}

  decode(): CborValue {
    const initial = this.readUInt8();
    const major = initial >> 5;
    const additional = initial & 0x1f;
    const length = this.readLength(additional);

    if (major === 0) return Number(length);
    if (major === 1) return Number(-1n - length);
    if (major === 2) return this.readBytes(Number(length));
    if (major === 3) return this.readBytes(Number(length)).toString("utf8");
    if (major === 4) return Array.from({ length: Number(length) }, () => this.decode());
    if (major === 5) {
      const map = new Map<CborValue, CborValue>();
      for (let i = 0; i < Number(length); i += 1) map.set(this.decode(), this.decode());
      return map;
    }

    throw new Error("Unsupported CBOR value");
  }

  private readLength(additional: number): bigint {
    if (additional < 24) return BigInt(additional);
    if (additional === 24) return BigInt(this.readUInt8());
    if (additional === 25) return BigInt(this.readBytes(2).readUInt16BE(0));
    if (additional === 26) return BigInt(this.readBytes(4).readUInt32BE(0));
    if (additional === 27) return this.readBytes(8).readBigUInt64BE(0);
    throw new Error("Unsupported CBOR length");
  }

  private readUInt8(): number {
    const value = this.buffer.readUInt8(this.offset);
    this.offset += 1;
    return value;
  }

  private readBytes(length: number): Buffer {
    const value = this.buffer.subarray(this.offset, this.offset + length);
    this.offset += length;
    return value;
  }
}
