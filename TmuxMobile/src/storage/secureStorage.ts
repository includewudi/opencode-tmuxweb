import * as SecureStore from 'expo-secure-store';

const PREFIX_PASSWORD = 'pwd_';
const PREFIX_HOST_KEY = 'hostkey_';

function generateStorageKey(prefix: string, host: string, port: number, user: string): string {
  const identifier = `${host}:${port}:${user}`;
  const safeKey = btoa(identifier).replace(/[^a-zA-Z0-9]/g, '_');
  return `${prefix}${safeKey}`;
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return hex + hex + hex + hex;
}

export async function storePassword(
  host: string,
  port: number,
  user: string,
  password: string
): Promise<void> {
  const key = generateStorageKey(PREFIX_PASSWORD, host, port, user);
  await SecureStore.setItemAsync(key, password, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function getPassword(
  host: string,
  port: number,
  user: string
): Promise<string | null> {
  const key = generateStorageKey(PREFIX_PASSWORD, host, port, user);
  return await SecureStore.getItemAsync(key);
}

export async function deletePassword(
  host: string,
  port: number,
  user: string
): Promise<void> {
  const key = generateStorageKey(PREFIX_PASSWORD, host, port, user);
  await SecureStore.deleteItemAsync(key);
}

export async function storeHostKey(
  host: string,
  port: number,
  user: string,
  fingerprint: string
): Promise<void> {
  const key = generateStorageKey(PREFIX_HOST_KEY, host, port, user);
  const hashedFingerprint = simpleHash(fingerprint);
  await SecureStore.setItemAsync(key, hashedFingerprint, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function getHostKey(
  host: string,
  port: number,
  user: string
): Promise<string | null> {
  const key = generateStorageKey(PREFIX_HOST_KEY, host, port, user);
  return await SecureStore.getItemAsync(key);
}

export type HostKeyVerifyResult = 'match' | 'mismatch' | 'not_found';

export async function verifyHostKey(
  host: string,
  port: number,
  user: string,
  fingerprint: string
): Promise<HostKeyVerifyResult> {
  const storedHash = await getHostKey(host, port, user);
  
  if (!storedHash) {
    return 'not_found';
  }
  
  const currentHash = simpleHash(fingerprint);
  
  if (storedHash === currentHash) {
    return 'match';
  }
  
  return 'mismatch';
}

export async function deleteHostKey(
  host: string,
  port: number,
  user: string
): Promise<void> {
  const key = generateStorageKey(PREFIX_HOST_KEY, host, port, user);
  await SecureStore.deleteItemAsync(key);
}

export function formatFingerprintForDisplay(fingerprint: string): string {
  const chunks = fingerprint.match(/.{1,4}/g) || [];
  return `SHA256:${chunks.slice(0, 4).join(':')}...`;
}
