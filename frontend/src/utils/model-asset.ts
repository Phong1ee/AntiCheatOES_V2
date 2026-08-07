import type { ProctoringModelDefinition } from "../config/proctoring-models";

export type VerifiedModelAsset = { bytes: Uint8Array; byteLength: number; sha256: string };

const digest = async (buffer: ArrayBuffer) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", buffer))).map((byte) => byte.toString(16).padStart(2, "0")).join("");

export async function loadAndVerifyModelAsset(model: ProctoringModelDefinition): Promise<VerifiedModelAsset> {
  const response = await fetch(model.modelPath, { cache: "no-store" });
  if (!response.ok) throw new Error(`MODEL_FETCH_HTTP_${response.status}`);
  const buffer = await response.arrayBuffer(); const bytes = new Uint8Array(buffer);
  const prefix = new TextDecoder().decode(bytes.slice(0, Math.min(bytes.length, 1024))).trimStart().toLowerCase();
  if (/^(<!doctype|<html|\{|\[|error\b)/.test(prefix)) throw new Error("MODEL_RESPONSE_NOT_BINARY");
  if (bytes.byteLength === 0) throw new Error("MODEL_EMPTY_RESPONSE");
  const contentLength = response.headers.get("content-length");
  if (contentLength && Number(contentLength) !== bytes.byteLength) throw new Error("MODEL_CONTENT_LENGTH_MISMATCH");
  if (bytes.byteLength < 8 || new TextDecoder().decode(bytes.slice(4, 8)) !== "TFL3") throw new Error("MODEL_TFLITE_MAGIC_INVALID");
  const sha256 = await digest(buffer);
  if (sha256 !== model.sha256) throw new Error("MODEL_SHA256_MISMATCH");
  return { bytes, byteLength: bytes.byteLength, sha256 };
}
