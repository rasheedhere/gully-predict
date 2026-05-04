import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../client';
import { useAuthStore } from '../../store/auth';

export const useUpdateProfile = () => {
  const updateUserStore = useAuthStore((state) => state.updateUser);

  return useMutation({
    mutationFn: async (payload: { alias?: string; use_alias?: boolean }) => {
      const response = await apiClient.put('/user/profile', payload);
      return response.data;
    },
    onSuccess: (data) => {
      if (data.status === 'success') {
        updateUserStore(data.user);
      }
    },
  });
};
