export function truncateMiddle(value: string, front = 6, back = 4): string {
  if (!value || value.length <= front + back + 3) return value;
  return `${value.slice(0, front)}...${value.slice(-back)}`;
}

export function truncateHash(value: string, front = 10, back = 8): string {
  return truncateMiddle(value, front, back);
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function formatAmount(amount: number, asset: string): string {
  return `${amount} ${asset}`;
}

export function padEscrowId(id: string, length = 6): string {
  return id.padStart(length, '0');
}
