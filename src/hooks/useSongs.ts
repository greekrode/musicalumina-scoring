import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useSupabaseQuery } from './useSupabaseQuery';

interface Song {
  id: number;
  name: string;
  index: number;
}

export function useSongs() {
  const { data: songs, isLoading, error, refetch } = useSupabaseQuery<Song[]>(
    async () => {
      const { data, error } = await supabase
        .from('songs')
        .select('id, name, index')
        .order('index', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    [],
    []
  );

  const getSongWithIndex = useCallback(
    (songTitle: string): string => {
      const normalize = (str: string) =>
        str.replace(/[\u0027\u2019\u0060\u00B4\u02BC\u02BB]/g, '').toLowerCase();

      const matchedSong = songs.find(
        (song) => normalize(song.name) === normalize(songTitle)
      );

      return matchedSong ? `${songTitle} (${matchedSong.index})` : songTitle;
    },
    [songs]
  );

  return { songs, loading: isLoading, error, refetch, getSongWithIndex };
}
