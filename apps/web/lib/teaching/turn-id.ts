export function createClientTurnId(): string {
  return crypto.randomUUID();
}
