export const apiClient = {
  get: async (url: string) => fetch(url),
  post: async (url: string, data: any) => fetch(url, { method: 'POST', body: JSON.stringify(data) }),
};
