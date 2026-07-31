const SECRET_PATTERNS = [
  /(Bearer\s+)[A-Za-z0-9._~+\/-]+/gi,
  /((?:api[_-]?key|token|secret|password|passwd|cookie|authorization)\s*[:=]\s*)(?!Bearer\b)[^\s,;]+/gi,
  /(postgres(?:ql)?:\/\/[^:]+:)[^@\s]+(@)/gi,
  /([?&](?:key|token|secret|password|signature)=)[^&\s]+/gi
];

export function redactSecrets(value: string): string {
  let result = value;
  result = result.replace(SECRET_PATTERNS[0], "$1[REDACTED]");
  result = result.replace(SECRET_PATTERNS[1], "$1[REDACTED]");
  result = result.replace(SECRET_PATTERNS[2], "$1[REDACTED]$2");
  result = result.replace(SECRET_PATTERNS[3], "$1[REDACTED]");
  return result;
}

export function limitText(value: string, maxBytes: number): { content: string; truncated: boolean } {
  const buffer = Buffer.from(value, "utf8");
  if (buffer.byteLength <= maxBytes) return { content: redactSecrets(value), truncated: false };
  const half = Math.max(1, Math.floor(maxBytes / 2));
  const start = buffer.subarray(0, half).toString("utf8");
  const end = buffer.subarray(-half).toString("utf8");
  return { content: redactSecrets(`${start}\n... [RECORTADO POR TAMAÑO] ...\n${end}`), truncated: true };
}
