import React, { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, Save, X } from "lucide-react";
import { EventScoringAspect } from "../../types";
import { supabase } from "../../lib/supabase";
import { Eyebrow } from "../shared/StateCard";

interface ScoringAspectsManagerProps {
  eventId: string;
  eventTitle: string;
  onClose: () => void;
}

export default function ScoringAspectsManager({
  eventId,
  eventTitle,
  onClose,
}: ScoringAspectsManagerProps) {
  const [aspects, setAspects] = useState<EventScoringAspect[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingAspect, setEditingAspect] = useState<EventScoringAspect | null>(
    null
  );
  const [newAspect, setNewAspect] = useState({
    name: "",
    description: "",
    weight: 25,
    max_score: 100,
    order_index: 0,
  });

  useEffect(() => {
    fetchAspects();
  }, [eventId]);

  const fetchAspects = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("event_scoring_aspects")
        .select("*")
        .eq("event_id", eventId)
        .order("order_index", { ascending: true });

      if (error) throw error;
      setAspects(data || []);
    } catch (err) {
      console.error("Error fetching aspects:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAspect = async () => {
    if (!newAspect.name.trim()) return;

    // Calculate what the total weight would be after adding this aspect
    const currentTotalWeight = aspects.reduce(
      (sum, aspect) => sum + aspect.weight,
      0
    );
    const newTotalWeight = currentTotalWeight + newAspect.weight;

    if (newTotalWeight > 100) {
      alert(
        `Cannot add aspect: Total weight would be ${newTotalWeight}%. Maximum allowed is 100%.`
      );
      return;
    }

    try {
      const { error } = await supabase.from("event_scoring_aspects").insert({
        event_id: eventId,
        ...newAspect,
        order_index: aspects.length,
      });

      if (error) throw error;

      setNewAspect({
        name: "",
        description: "",
        weight: 25,
        max_score: 100,
        order_index: 0,
      });
      fetchAspects();
    } catch (err) {
      console.error("Error creating aspect:", err);
    }
  };

  const handleUpdateAspect = async (aspect: EventScoringAspect) => {
    if (!aspect.name.trim()) return;

    // Calculate what the total weight would be after updating
    const otherAspectsWeight = aspects
      .filter((a) => a.id !== aspect.id)
      .reduce((sum, a) => sum + a.weight, 0);
    const newTotalWeight = otherAspectsWeight + aspect.weight;

    if (newTotalWeight > 100) {
      alert(
        `Cannot update aspect: Total weight would be ${newTotalWeight}%. Maximum allowed is 100%.`
      );
      return;
    }

    try {
      const { error } = await supabase
        .from("event_scoring_aspects")
        .update({
          name: aspect.name,
          description: aspect.description,
          weight: aspect.weight,
          max_score: aspect.max_score,
          order_index: aspect.order_index,
        })
        .eq("id", aspect.id);

      if (error) throw error;

      setEditingAspect(null);
      fetchAspects();
    } catch (err) {
      console.error("Error updating aspect:", err);
    }
  };

  const handleDeleteAspect = async (aspectId: string) => {
    if (!window.confirm("Are you sure you want to delete this scoring aspect?"))
      return;

    try {
      const { error } = await supabase
        .from("event_scoring_aspects")
        .delete()
        .eq("id", aspectId);

      if (error) throw error;
      fetchAspects();
    } catch (err) {
      console.error("Error deleting aspect:", err);
    }
  };

  const totalWeight =
    aspects.reduce((sum, aspect) => sum + aspect.weight, 0) +
    (editingAspect ? 0 : newAspect.weight);

  return (
    <div className="overlay">
      <div className="sheet sm:max-w-4xl" role="dialog" aria-modal="true">
        <div className="flex items-start justify-between px-6 pt-6">
          <div>
            <Eyebrow>Scoring Aspects</Eyebrow>
            <h2 className="mt-3 text-[1.5rem]">
              Manage Scoring Aspects - {eventTitle}
            </h2>
          </div>
          <button onClick={onClose} className="icon-btn" aria-label="Close" title="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 pb-6 pt-6">
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <div className="spinner" />
            </div>
          ) : (
            <>
              <div className="mb-6 space-y-4">
                <h3 className="text-[1.25rem]">Existing Aspects</h3>

                {aspects.length === 0 ? (
                  <p className="text-ink-muted">
                    No scoring aspects defined yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {aspects.map((aspect, index) => (
                      <div
                        key={aspect.id}
                        className="border border-rule-hairline bg-surface-warm p-4"
                      >
                        {editingAspect?.id === aspect.id ? (
                          <div className="space-y-3">
                            <input
                              type="text"
                              value={editingAspect.name}
                              onChange={(e) =>
                                setEditingAspect({
                                  ...editingAspect,
                                  name: e.target.value,
                                })
                              }
                              className="field"
                              placeholder="Aspect name"
                            />
                            <textarea
                              value={editingAspect.description || ""}
                              onChange={(e) =>
                                setEditingAspect({
                                  ...editingAspect,
                                  description: e.target.value,
                                })
                              }
                              className="field"
                              placeholder="Description (optional)"
                              rows={2}
                            />
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="field-label">Weight (%)</label>
                                <input
                                  type="number"
                                  value={editingAspect.weight}
                                  onChange={(e) =>
                                    setEditingAspect({
                                      ...editingAspect,
                                      weight: parseInt(e.target.value) || 0,
                                    })
                                  }
                                  className="field"
                                  min="0"
                                  max="100"
                                />
                              </div>
                              <div>
                                <label className="field-label">Max Score</label>
                                <input
                                  type="number"
                                  value={editingAspect.max_score}
                                  onChange={(e) =>
                                    setEditingAspect({
                                      ...editingAspect,
                                      max_score:
                                        parseInt(e.target.value) || 100,
                                    })
                                  }
                                  className="field"
                                  min="1"
                                />
                              </div>
                            </div>
                            <div className="flex flex-wrap justify-end gap-2">
                              <button
                                onClick={() => setEditingAspect(null)}
                                className="btn-ghost btn-sm"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() =>
                                  handleUpdateAspect(editingAspect)
                                }
                                className="btn-primary btn-sm"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium text-ink-primary">
                                {aspect.name}
                              </h4>
                              {aspect.description && (
                                <p className="mt-1 text-sm text-ink-muted">
                                  {aspect.description}
                                </p>
                              )}
                              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-muted">
                                <span>Weight: {aspect.weight}%</span>
                                <span>Max Score: {aspect.max_score}</span>
                                <span>Order: {index + 1}</span>
                              </div>
                            </div>
                            <div className="ml-4 flex items-center gap-1">
                              <button
                                onClick={() => setEditingAspect(aspect)}
                                className="icon-btn"
                                aria-label="Edit aspect"
                                title="Edit aspect"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteAspect(aspect.id)}
                                className="icon-btn text-status-error-fg hover:text-status-error-fg"
                                aria-label="Delete aspect"
                                title="Delete aspect"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-rule-hairline pt-6">
                <h3 className="mb-4 text-[1.25rem]">Add New Aspect</h3>

                <div className="space-y-3">
                  <input
                    type="text"
                    value={newAspect.name}
                    onChange={(e) =>
                      setNewAspect({ ...newAspect, name: e.target.value })
                    }
                    className="field"
                    placeholder="Aspect name"
                  />
                  <textarea
                    value={newAspect.description}
                    onChange={(e) =>
                      setNewAspect({
                        ...newAspect,
                        description: e.target.value,
                      })
                    }
                    className="field"
                    placeholder="Description (optional)"
                    rows={2}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="field-label">Weight (%)</label>
                      <input
                        type="number"
                        value={newAspect.weight}
                        onChange={(e) =>
                          setNewAspect({
                            ...newAspect,
                            weight: parseInt(e.target.value) || 0,
                          })
                        }
                        className="field"
                        min="0"
                        max="100"
                      />
                    </div>
                    <div>
                      <label className="field-label">Max Score</label>
                      <input
                        type="number"
                        value={newAspect.max_score}
                        onChange={(e) =>
                          setNewAspect({
                            ...newAspect,
                            max_score: parseInt(e.target.value) || 100,
                          })
                        }
                        className="field"
                        min="1"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleSaveAspect}
                    disabled={!newAspect.name.trim()}
                    className="btn-primary w-full"
                  >
                    <Plus className="h-4 w-4" />
                    Add Aspect
                  </button>
                </div>
              </div>

              <div className="mt-6 border border-rule-hairline bg-surface-warm p-3">
                <p className="text-sm text-ink-primary">
                  Total Weight:{" "}
                  <span
                    className={`font-semibold ${
                      totalWeight === 100
                        ? "text-status-open-fg"
                        : "text-status-error-fg"
                    }`}
                  >
                    {totalWeight}%
                  </span>
                  <span className="ml-2 text-ink-muted">
                    (Must equal 100% for proper score calculation)
                  </span>
                </p>
                {totalWeight !== 100 && (
                  <p className="mt-1 text-xs text-status-error-fg">
                    Weights must sum to exactly 100%. Current total:{" "}
                    {totalWeight}%
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
