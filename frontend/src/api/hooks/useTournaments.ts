import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';

export interface Tournament {
  id: string;
  name: string;
  starts_at: string | null;
  ends_at: string | null;
  status: 'upcoming' | 'active' | 'completed';
}

export function useTournaments() {
  const query = useQuery({
    queryKey: ['tournaments'],
    queryFn: async () => {
      const response = await apiClient.get<Tournament[]>('/tournaments');
      return response.data;
    },
  });

  return query;
}
