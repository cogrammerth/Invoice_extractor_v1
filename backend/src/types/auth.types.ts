/**
 * Authentication and authorization types.
 */

export const USER_ROLES = ['admin', 'operator', 'viewer'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const AUTH_PROVIDERS = ['local', 'microsoft', 'google'] as const;
export type AuthProvider = (typeof AUTH_PROVIDERS)[number];

export interface AuthUser {
  readonly id: string;
  readonly email: string;
  readonly role: UserRole;
  readonly authProvider: AuthProvider;
  readonly isActive: boolean;
}

export interface LoginSuccessPayload {
  readonly accessToken: string;
  readonly expiresIn: string;
  readonly user: {
    readonly id: string;
    readonly email: string;
    readonly role: UserRole;
  };
}

export interface AuthProvidersPayload {
  readonly emailPassword: boolean;
  readonly microsoft: boolean;
  readonly google: boolean;
  readonly allowedEmailDomains: readonly string[];
}
