export type UserRole = 'admin' | 'operator' | 'viewer';

export interface AuthProviders {
  readonly emailPassword: boolean;
  readonly microsoft: boolean;
  readonly google: boolean;
  readonly allowedEmailDomains: readonly string[];
}

export interface LoginResponseUser {
  readonly id: string;
  readonly email: string;
  readonly role: UserRole;
}

export interface LoginResponse {
  readonly accessToken: string;
  readonly expiresIn: string;
  readonly user: LoginResponseUser;
}
