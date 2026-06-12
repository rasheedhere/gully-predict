import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';

export interface Announcement {
  id: number;
  title: string;
  content: string;
  action_label?: string | null;
  action_url?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useAnnouncements() {
  return useQuery({
    queryKey: ['announcements'],
    queryFn: async () => {
      const response = await apiClient.get('/announcements');
      return response.data as Announcement[];
    },
  });
}

export function useMarkAnnouncementsRead() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/announcements/mark-read');
      return response.data;
    },
    onSuccess: () => {
      // Invalidate current user query to refetch last_read_announcements_at
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
    },
  });
}

export function useAdminAnnouncements() {
  return useQuery({
    queryKey: ['admin_announcements'],
    queryFn: async () => {
      const response = await apiClient.get('/announcements/admin');
      return response.data as Announcement[];
    },
  });
}

export function useCreateAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Announcement>) => {
      const response = await apiClient.post('/announcements/admin', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_announcements'] });
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
    },
  });
}

export function useUpdateAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Announcement> }) => {
      const response = await apiClient.put(`/announcements/admin/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_announcements'] });
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
    },
  });
}

export function useDeleteAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await apiClient.delete(`/announcements/admin/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_announcements'] });
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
    },
  });
}
