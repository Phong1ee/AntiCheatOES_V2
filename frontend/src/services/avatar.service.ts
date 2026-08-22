import { apiClient } from "./api-client";

/** The signed-in user's avatar. Every call acts on the caller's own row - the
 *  server reads the school_id from the token, so no id is ever passed here. */
export const avatarService = {
  /** Fetches the avatar as an object URL, or null when none is set.
   *
   *  The API is Bearer-authenticated, so a plain <img src> would be rejected;
   *  the bytes have to come through apiClient. The caller owns the returned URL
   *  and must revoke it, or the blob is held for the life of the document. */
  async fetchMyAvatar(): Promise<string | null> {
    try {
      const { data } = await apiClient.get(`/api/profile/me/avatar`, { responseType: "blob" });
      return URL.createObjectURL(data as Blob);
    } catch (error) {
      // 404 is the ordinary "this user has not uploaded one" case, not a fault.
      if ((error as { status?: number }).status === 404) return null;
      throw error;
    }
  },

  async uploadMyAvatar(file: File): Promise<{ content_type: string; size: number }> {
    const formData = new FormData();
    formData.append("file", file);
    const { data } = await apiClient.put<{ content_type: string; size: number }>(
      `/api/profile/me/avatar`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return data;
  },

  async deleteMyAvatar(): Promise<void> {
    await apiClient.delete(`/api/profile/me/avatar`);
  },
};
