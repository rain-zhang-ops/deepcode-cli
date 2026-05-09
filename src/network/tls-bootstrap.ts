import * as fs from "node:fs";
import * as tls from "node:tls";
import * as https from "node:https";
import { Agent, setGlobalDispatcher } from "undici";

let bootstrapped = false;

function readExtraCaPems(): string[] {
  const extra = process.env.NODE_EXTRA_CA_CERTS;
  if (!extra) {
    return [];
  }
  try {
    const raw = fs.readFileSync(extra, "utf8");
    const matches = raw.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g);
    return matches ?? [];
  } catch {
    return [];
  }
}

/**
 * Force every outbound HTTPS connection (https.request, undici/fetch used by
 * the OpenAI SDK) to validate against an explicit, predictable CA list:
 * Node's bundled Mozilla roots plus any NODE_EXTRA_CA_CERTS the user provides.
 *
 * This works around environments where Node's default trust resolution differs
 * from the bundled root list and produces SELF_SIGNED_CERT_IN_CHAIN /
 * UNABLE_TO_GET_LOCAL_ISSUER_CERT errors even though the underlying chain is
 * valid against the same Mozilla bundle.
 */
export function bootstrapTrustedTls(): void {
  if (bootstrapped) {
    return;
  }
  bootstrapped = true;

  const ca = [...tls.rootCertificates, ...readExtraCaPems()];

  try {
    https.globalAgent.options.ca = ca;
  } catch {
    // Non-fatal: keep going so undici fix below still applies.
  }

  try {
    setGlobalDispatcher(new Agent({ connect: { ca } }));
  } catch {
    // Non-fatal: undici may be unavailable on very old runtimes.
  }
}
