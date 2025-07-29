import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

interface Song {
  id: number;
  name: string;
  index: number;
}

export function useSongs() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSongs();
  }, []);

  const fetchSongs = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("songs")
        .select("id, name, index")
        .order("index", { ascending: true });

      if (fetchError) throw fetchError;

      setSongs(data || []);
    } catch (err) {
      console.error("Error fetching songs:", err);
      setError("Failed to fetch songs");
    } finally {
      setLoading(false);
    }
  };

  // Normalize both song.name and songTitle by removing all apostrophes (both straight and curly) and lowercasing for comparison
  const getSongWithIndex = (songTitle: string): string => {
    const normalize = (str: string) => {
      // Use Unicode escapes to be explicit about apostrophe-like characters
      // \u0027 = ' (straight apostrophe)
      // \u2019 = ' (curly apostrophe)
      // \u0060 = ` (grave accent)
      // \u00B4 = ´ (acute accent)
      // \u02BC = ʼ (modifier letter apostrophe)
      // \u02BB = ʻ (modifier letter turned comma)
      const result = str
        .replace(/[\u0027\u2019\u0060\u00B4\u02BC\u02BB]/g, "")
        .toLowerCase();
      return result;
    };
    const matchedSong = songs.find(
      (song) => normalize(song.name) === normalize(songTitle)
    );

    return matchedSong ? `${songTitle} (${matchedSong.index})` : songTitle;
  };

  return { songs, loading, error, refetch: fetchSongs, getSongWithIndex };
}
