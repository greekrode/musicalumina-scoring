import React, { useMemo, useState } from 'react';
import {
  Calendar,
  MapPin,
  Users,
  ToggleLeft,
  ToggleRight,
  Settings,
  Award,
  EyeOff,
  Eye,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useEvents } from '../../hooks/useEvents';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import ScoringAspectsManager from './ScoringAspectsManager';
import PrizeConfigurationManager from './PrizeConfigurationManager';
import { Eyebrow } from '../shared/StateCard';

export default function EventsManager() {
  const [selectedEvent, setSelectedEvent] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [prizeManagerEvent, setPrizeManagerEvent] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [hideInactive, setHideInactive] = useState(false);

  // Fetch all events including inactive
  const { events, loading: eventsLoading, error, refetch } = useEvents({
    includeInactive: true,
  });

  // Fetch participant counts in a single query
  const { data: participantCounts } = useSupabaseQuery<
    Record<string, number>
  >(
    async () => {
      if (events.length === 0) return {};

      const eventIds = events.map((e) => e.id);
      const { data, error } = await supabase
        .from('registrations')
        .select('event_id')
        .in('event_id', eventIds);

      if (error) throw error;

      const counts: Record<string, number> = {};
      for (const id of eventIds) counts[id] = 0;
      data?.forEach((row) => {
        counts[row.event_id] = (counts[row.event_id] || 0) + 1;
      });

      return counts;
    },
    [events],
    {},
    { enabled: events.length > 0 }
  );

  const filteredEvents = useMemo(
    () => (hideInactive ? events.filter((e) => e.active) : events),
    [events, hideInactive]
  );

  const toggleEventActive = async (eventId: string, currentActive: boolean) => {
    try {
      const { error } = await supabase
        .from('events')
        .update({ active: !currentActive })
        .eq('id', eventId);

      if (error) throw error;
      refetch();
    } catch (err) {
      console.error('Error toggling event active status:', err);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming':
        return 'pill-wait';
      case 'ongoing':
        return 'pill-ok';
      case 'completed':
        return 'pill-muted';
      default:
        return 'pill-muted';
    }
  };

  if (eventsLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 text-center">
        <p className="text-status-error-fg">{error}</p>
        <button onClick={refetch} className="btn-primary mt-4">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow>Events</Eyebrow>
          <h2 className="mt-3 text-[1.5rem]">Events Management</h2>
          <p className="mt-1 text-ink-muted">Manage competition and festival events</p>
        </div>
        <button
          onClick={() => setHideInactive((prev) => !prev)}
          className="btn-outline btn-sm"
        >
          {hideInactive ? (
            <Eye className="h-4 w-4" />
          ) : (
            <EyeOff className="h-4 w-4" />
          )}
          {hideInactive ? 'Show Inactive' : 'Hide Inactive'}
        </button>
      </div>

      <div className="space-y-4">
        {filteredEvents.map((event) => (
          <div key={event.id} className="card p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-3">
                  <h3 className="text-[1.25rem]">{event.title}</h3>
                  <span className={getStatusColor(event.status)}>
                    {event.status}
                  </span>
                </div>

                <div className="space-y-2 text-sm text-ink-muted">
                  <div className="flex items-center">
                    <MapPin className="mr-2 h-4 w-4 text-ink-accent" />
                    {event.location}
                  </div>
                  <div className="flex items-center">
                    <Calendar className="mr-2 h-4 w-4 text-ink-accent" />
                    {formatDate(event.start_date)} -{' '}
                    {formatDate(event.end_date)}
                  </div>
                  <div className="flex items-center">
                    <Users className="mr-2 h-4 w-4 text-ink-accent" />
                    Total participants:{' '}
                    {participantCounts[event.id] ?? 0}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    onClick={() =>
                      setSelectedEvent({ id: event.id, title: event.title })
                    }
                    className="btn-outline btn-sm"
                  >
                    <Settings className="h-4 w-4" />
                    Manage Scoring Aspects
                  </button>
                  <button
                    onClick={() =>
                      setPrizeManagerEvent({
                        id: event.id,
                        title: event.title,
                      })
                    }
                    className="btn-outline btn-sm"
                  >
                    <Award className="h-4 w-4" />
                    Configure Prizes
                  </button>
                </div>
              </div>

              <div className="flex items-center">
                <label className="flex cursor-pointer items-center">
                  <span className="type-label mr-3 text-ink-muted">
                    {event.active ? 'Active' : 'Inactive'}
                  </span>
                  <button
                    onClick={() => toggleEventActive(event.id, event.active)}
                    role="switch"
                    aria-checked={event.active}
                    aria-label={event.active ? 'Deactivate event' : 'Activate event'}
                    className={`relative inline-flex h-6 w-11 items-center rounded-sm transition-colors ${
                      event.active ? 'bg-marigold' : 'bg-rule-strong'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-sm bg-offWhite transition-transform ${
                        event.active ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                    {event.active ? (
                      <ToggleRight className="absolute left-1 h-3 w-3 text-burgundy" />
                    ) : (
                      <ToggleLeft className="absolute right-1 h-3 w-3 text-ink-muted" />
                    )}
                  </button>
                </label>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredEvents.length === 0 && (
        <div className="py-12 text-center">
          <Calendar className="mx-auto h-12 w-12 text-ink-subtle" />
          <h3 className="mt-2 text-[1.25rem]">No events found</h3>
          <p className="mt-1 text-sm text-ink-muted">
            {hideInactive
              ? 'No active events. Toggle to show inactive events.'
              : 'No competition or festival events available.'}
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
