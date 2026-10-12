export function LoadError({ message }: { message: string }) {
  return <p className="text-sm text-destructive">{message}</p>;
}
