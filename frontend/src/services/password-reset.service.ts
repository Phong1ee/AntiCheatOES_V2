import { apiClient } from "./api-client";

export interface VerifyOtpResult {
  resetToken: string;
  expiresAt: string;
  maxAttempts: number;
}

/** The forgot-password flow. None of these calls carry a bearer token - the
 *  caller is by definition someone who cannot sign in. */
export const passwordResetService = {
  /** Always resolves with the same generic message, registered or not. */
  async requestOtp(email: string): Promise<string> {
    const { data } = await apiClient.post<{ message: string }>(`/api/auth/forgot-password`, {
      email,
    });
    return data.message;
  },

  async verifyOtp(email: string, otp: string): Promise<VerifyOtpResult> {
    const { data } = await apiClient.post<VerifyOtpResult>(`/api/auth/verify-otp`, { email, otp });
    return data;
  },

  async resetPassword(resetToken: string, newPassword: string): Promise<string> {
    const { data } = await apiClient.post<{ message: string }>(`/api/auth/reset-password`, {
      resetToken,
      newPassword,
    });
    return data.message;
  },
};
