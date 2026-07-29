export const DAILY_ADMIN_PATH = '/admin/daily';
export const DAILY_ADMIN_AUTH_PATH = '/admin/auth';

export function getBasicAuthProtectionSpace(pathname: string): string {
  return pathname.slice(0, pathname.lastIndexOf('/') + 1);
}
