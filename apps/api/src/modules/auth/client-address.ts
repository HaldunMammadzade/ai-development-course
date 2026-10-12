const SAFE_ADDRESS = /^[A-Za-z0-9:._-]{1,64}$/;

export function clientAddress(request: {
  ip?: string;
  socket?: { remoteAddress?: string | undefined };
  header(name: string): string | undefined;
}): string {
  const peer = request.socket?.remoteAddress ?? request.ip ?? "unknown";
  const loopback = peer === "127.0.0.1" || peer === "::1" || peer === "::ffff:127.0.0.1";
  const forwarded = request.header("x-platform-client-ip")?.trim() ?? "";
  if (loopback && SAFE_ADDRESS.test(forwarded)) {
    return forwarded;
  }
  return SAFE_ADDRESS.test(peer) ? peer : "unknown";
}
