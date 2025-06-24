export interface AuthSession {
  userId: string;
  token: string;
}

export interface OAuthProviderConfig {
  provider: string;
  clientId: string;
  clientSecret: string;
}
