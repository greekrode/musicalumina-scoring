import React, { useState, useEffect } from "react";
import {
  Calendar,
  MapPin,
  Users,
  ToggleLeft,
  ToggleRight,
  Settings,
  Award,
} from "lucide-react";
import { Event } from "../../types";
import { supabase } from "../../lib/supabase";
import ScoringAspectsManager from "./ScoringAspectsManager";
import PrizeConfigurationManager from "./PrizeConfigurationManager";

interface EventWithCount extends Event {
  participantCount?: number;
}

export default function EventsManager() {
  const [events, setEvents] = useState<EventWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [prizeManagerEvent, setPrizeManagerEvent] = useState<{
    id: string;
    title: string;
  } | null>(null);

  // Fetch events from Supabase
  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch events - only competition and festival types, exclude completed
      const { data: eventsData, error: eventsError } = await supabase
        .from("events")
        .select("*")
        .in("type", ["competition", "festival"])
        .order("start_date", { ascending: true });

      if (eventsError) throw eventsError;

      // Fetch participant counts for each event
      const eventsWithCounts = await Promise.all(
        (eventsData || []).map(async (event) => {
          const { count, error: countError } = await supabase
            .from("registrations")
            .select("*", { count: "exact", head: true })
            .eq("event_id", event.id);

          if (countError) {
            console.error("Error fetching participant count:", countError);
          }

          return {
            ...event,
            participantCount: count || 0,
          };
        })
      );

      setEvents(eventsWithCounts);
    } catch (err) {
      setError("Failed to fetch events");
      console.error("Error fetching events:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleEventActive = async (eventId: string, currentActive: boolean) => {
    try {
      const { error } = await supabase
        .from("events")
        .update({ active: !currentActive })
        .eq("id", eventId);

      if (error) throw error;

      // Optimistic update
      setEvents(
        events.map((event) =>
          event.id === eventId ? { ...event, active: !currentActive } : event
        )
      );
    } catch (err) {
      console.error("Error toggling event active status:", err);
      // Revert on error
      fetchEvents();
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Not set";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "upcoming":
        return "bg-blue-100 text-blue-800";
      case "ongoing":
        return "bg-green-100 text-green-800";
      case "completed":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-piano-wine"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">{error}</p>
        <button
          onClick={fetchEvents}
          className="mt-4 px-4 py-2 bg-piano-wine text-white rounded-lg hover:bg-piano-wine/90"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-piano-wine">
          Events Management
        </h2>
        <p className="text-gray-600">Manage competition and festival events</p>
      </div>

      <div className="space-y-4">
        {events.map((event) => (
          <div
            key={event.id}
            className="bg-white border border-piano-gold/20 rounded-xl shadow-sm p-6"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center mb-2">
                  <h3 className="text-lg font-semibold text-piano-wine">
                    {event.title}
                  </h3>
                  <span
                    className={`ml-3 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                      event.status
                    )}`}
                  >
                    {event.status}
                  </span>
                </div>

                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center">
                    <MapPin className="w-4 h-4 mr-2 text-piano-wine/60" />
                    {event.location}
                  </div>

                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 mr-2 text-piano-wine/60" />
                    {formatDate(event.start_date)} -{" "}
                    {formatDate(event.end_date)}
                  </div>

                  <div className="flex items-center">
                    <Users className="w-4 h-4 mr-2 text-piano-wine/60" />
                    Total participants: {event.participantCount || 0}
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() =>
                      setSelectedEvent({ id: event.id, title: event.title })
                    }
                    className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-piano-wine bg-piano-cream hover:bg-piano-gold/20 rounded-lg transition-colors duration-200"
                  >
                    <Settings className="w-4 h-4 mr-1.5" />
                    Manage Scoring Aspects
                  </button>
                  <button
                    onClick={() =>
                      setPrizeManagerEvent({ id: event.id, title: event.title })
                    }
                    className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-piano-wine bg-piano-cream hover:bg-piano-gold/20 rounded-lg transition-colors duration-200"
                  >
                    <Award className="w-4 h-4 mr-1.5" />
                    Configure Prizes
                  </button>
                </div>
              </div>

              <div className="ml-6 flex items-center">
                <label className="flex items-center cursor-pointer">
                  <span className="mr-3 text-sm font-medium text-piano-wine">
                    {event.active ? "Active" : "Inactive"}
                  </span>
                  <button
                    onClick={() => toggleEventActive(event.id, event.active)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      event.active ? "bg-piano-gold" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        event.active ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                    {event.active ? (
                      <ToggleRight className="absolute right-1 w-3 h-3 text-white" />
                    ) : (
                      <ToggleLeft className="absolute left-1 w-3 h-3 text-gray-600" />
                    )}
                  </button>
                </label>
              </div>
            </div>
          </div>
        ))}
      </div>

      {events.length === 0 && (
        <div className="text-center py-12">
          <Calendar className="mx-auto h-12 w-12 text-piano-wine/40" />
          <h3 className="mt-2 text-sm font-medium text-piano-wine">
            No events found
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            No active competition or festival events available.
          </p>
        </div>
      )}

      {selectedEvent && (
        <ScoringAspectsManager
          eventId={selectedEvent.id}
          eventTitle={selectedEvent.title}
          onClose={() => setSelectedEvent(null)}
        />
      )}

      {prizeManagerEvent && (
        <PrizeConfigurationManager
          eventId={prizeManagerEvent.id}
          eventTitle={prizeManagerEvent.title}
          onClose={() => setPrizeManagerEvent(null)}
        />
      )}
    </div>
  );
}
