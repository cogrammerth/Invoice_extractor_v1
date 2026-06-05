import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosProgressEvent,
} from 'axios';

import type {
  GetExtractionResponse,
  ListExtractionsResponse,
  TokenUsageResponse,
  UploadResponse,
} from '../types/api.types';
import { ApiClientError } from '../types/api.types';
import type { AuthProviders, LoginResponse } from '../types/auth.types';
import { getApiBase } from '../config/api-base.js';

function createClient(getToken: () => string): AxiosInstance {
  const client = axios.create({
    baseURL: getApiBase(),
    timeout: 120_000,
    headers: {
      Accept: 'application/json',
    },
  });

  client.interceptors.request.use((config) => {
    const token = getToken();
    if (token.length > 0) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  client.interceptors.response.use(
    (res) => res,
    (error: AxiosError<{ success?: boolean; error?: { code?: string; message?: string; fieldErrors?: ReadonlyArray<{ field: string; message: string }> } }>) => {
      const status = error.response?.status ?? 0;
      const body = error.response?.data;
      const code = body?.error?.code ?? 'NETWORK_ERROR';
      const message =
        body?.error?.message ??
        error.message ??
        'Request failed. Check your connection and try again.';
      throw new ApiClientError(
        status,
        code,
        message,
        body?.error?.fieldErrors,
      );
    },
  );

  return client;
}

export interface ApiService {
  getAuthProviders(): Promise<AuthProviders>;
  loginWithEmail(email: string, password: string): Promise<LoginResponse>;
  uploadInvoice(
    file: File,
    onProgress?: (percent: number) => void,
  ): Promise<UploadResponse['data']>;
  listExtractions(limit?: number): Promise<ListExtractionsResponse['data']>;
  getExtraction(id: string): Promise<GetExtractionResponse['data']>;
  getTokenUsage(days?: number): Promise<TokenUsageResponse['data']>;
  checkHealth(): Promise<boolean>;
  fetchExtractionFileObjectUrl(extractionId: string): Promise<string>;
}

export function createApiService(getToken: () => string): ApiService {
  const client = createClient(getToken);

  return {
    async getAuthProviders() {
      const { data } = await client.get<{
        success: boolean;
        data: AuthProviders;
      }>('/api/auth/providers');
      if (!data.success) {
        throw new ApiClientError(500, 'INVALID_RESPONSE', 'Unexpected API response');
      }
      return data.data;
    },

    async loginWithEmail(email, password) {
      const { data } = await client.post<{
        success: boolean;
        data: LoginResponse;
      }>('/api/auth/login', { email, password });
      if (!data.success) {
        throw new ApiClientError(500, 'INVALID_RESPONSE', 'Unexpected API response');
      }
      return data.data;
    },

    async uploadInvoice(file, onProgress) {
      const form = new FormData();
      form.append('file', file);
      const { data } = await client.post<UploadResponse>(
        '/api/thai-invoices/upload',
        form,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (evt: AxiosProgressEvent) => {
            if (onProgress === undefined || evt.total === undefined || evt.total <= 0) {
              return;
            }
            onProgress(Math.round((evt.loaded / evt.total) * 100));
          },
        },
      );
      if (!data.success) {
        throw new ApiClientError(500, 'INVALID_RESPONSE', 'Unexpected API response');
      }
      return data.data;
    },

    async listExtractions(limit) {
      const { data } = await client.get<ListExtractionsResponse>(
        '/api/thai-invoices/extractions',
        { params: limit !== undefined ? { limit } : undefined },
      );
      if (!data.success) {
        throw new ApiClientError(500, 'INVALID_RESPONSE', 'Unexpected API response');
      }
      return data.data;
    },

    async getExtraction(id) {
      const { data } = await client.get<GetExtractionResponse>(
        `/api/thai-invoices/extractions/${id}`,
      );
      if (!data.success) {
        throw new ApiClientError(500, 'INVALID_RESPONSE', 'Unexpected API response');
      }
      return data.data;
    },

    async getTokenUsage(days) {
      const { data } = await client.get<TokenUsageResponse>(
        '/api/thai-invoices/usage',
        { params: days !== undefined ? { days } : undefined },
      );
      if (!data.success) {
        throw new ApiClientError(500, 'INVALID_RESPONSE', 'Unexpected API response');
      }
      return data.data;
    },

    async checkHealth() {
      try {
        const { data } = await client.get<{ success?: boolean }>('/health');
        return data.success === true;
      } catch {
        return false;
      }
    },

    async fetchExtractionFileObjectUrl(extractionId) {
      const { data, headers } = await client.get<ArrayBuffer>(
        `/api/thai-invoices/files/${extractionId}`,
        { responseType: 'arraybuffer' },
      );
      const mime =
        (typeof headers['content-type'] === 'string'
          ? headers['content-type']
          : 'image/jpeg'
        ).split(';')[0] ?? 'image/jpeg';
      const blob = new Blob([data], { type: mime });
      return URL.createObjectURL(blob);
    },
  };
}

export { getApiBase };
