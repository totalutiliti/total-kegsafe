/**
 * Interface for the AuthService.
 *
 * Defines the public contract for authentication operations.
 * Consumers should depend on this interface (via the AUTH_SERVICE token)
 * rather than on the concrete AuthService class.
 */
export interface IAuthService {
  login(
    email: string,
    password: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: string;
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
      tenantId: string;
      tenantName: string;
      mustChangePassword: boolean;
    };
  }>;

  refresh(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: string;
  }>;

  logout(refreshToken: string): Promise<{ message: string }>;

  changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<{ message: string }>;
}
