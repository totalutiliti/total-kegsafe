import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { api } from './api';

/**
 * Custom hook for GET requests using React Query
 */
export function useApiQuery<T = any>(
    key: string[],
    url: string,
    params?: Record<string, any>,
    options?: Omit<UseQueryOptions<T>, 'queryKey' | 'queryFn'>
) {
    return useQuery<T>({
        queryKey: [...key, params],
        queryFn: async () => {
            const { data } = await api.get(url, { params });
            return data;
        },
        ...options,
    });
}

/**
 * Custom hook for POST/PATCH/DELETE mutations
 */
export function useApiMutation<TData = any, TVariables = any>(
    url: string,
    method: 'post' | 'patch' | 'delete' = 'post',
    invalidateKeys?: string[][]
) {
    const queryClient = useQueryClient();

    return useMutation<TData, Error, TVariables>({
        mutationFn: async (variables) => {
            const { data } = method === 'delete'
                ? await api.delete(url, { data: variables })
                : await api[method](url, variables as any);
            return data;
        },
        onSuccess: () => {
            invalidateKeys?.forEach(key => {
                queryClient.invalidateQueries({ queryKey: key });
            });
        },
    });
}
