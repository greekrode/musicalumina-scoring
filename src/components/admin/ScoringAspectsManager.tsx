import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X } from 'lucide-react';
import { EventScoringAspect } from '../../types';
import { supabase } from '../../lib/supabase';

interface ScoringAspectsManagerProps {
  eventId: string;
  eventTitle: string;
  onClose: () => void;
}

export default function ScoringAspectsManager({ eventId, eventTitle, onClose }: ScoringAspectsManagerProps) {
  const [aspects, setAspects] = useState<EventScoringAspect[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingAspect, setEditingAspect] = useState<EventScoringAspect | null>(null);
  const [newAspect, setNewAspect] = useState({
    name: '',
    description: '',
    weight: 25,
    max_score: 100,
    order_index: 0
  });

  useEffect(() => {
    fetchAspects();
  }, [eventId]);

  const fetchAspects = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('event_scoring_aspects')
        .select('*')
        .eq('event_id', eventId)
        .order('order_index', { ascending: true });

      if (error) throw error;
      setAspects(data || []);
    } catch (err) {
      console.error('Error fetching aspects:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAspect = async () => {
    if (!newAspect.name.trim()) return;

    // Calculate what the total weight would be after adding this aspect
    const currentTotalWeight = aspects.reduce((sum, aspect) => sum + aspect.weight, 0);
    const newTotalWeight = currentTotalWeight + newAspect.weight;
    
    if (newTotalWeight > 100) {
      alert(`Cannot add aspect: Total weight would be ${newTotalWeight}%. Maximum allowed is 100%.`);
      return;
    }

    try {
      const { error } = await supabase
        .from('event_scoring_aspects')
        .insert({
          event_id: eventId,
          ...newAspect,
          order_index: aspects.length
        });

      if (error) throw error;

      setNewAspect({
        name: '',
        description: '',
        weight: 25,
        max_score: 100,
        order_index: 0
      });
      fetchAspects();
    } catch (err) {
      console.error('Error creating aspect:', err);
    }
  };

  const handleUpdateAspect = async (aspect: EventScoringAspect) => {
    if (!aspect.name.trim()) return;

    // Calculate what the total weight would be after updating
    const otherAspectsWeight = aspects
      .filter(a => a.id !== aspect.id)
      .reduce((sum, a) => sum + a.weight, 0);
    const newTotalWeight = otherAspectsWeight + aspect.weight;
    
    if (newTotalWeight > 100) {
      alert(`Cannot update aspect: Total weight would be ${newTotalWeight}%. Maximum allowed is 100%.`);
      return;
    }

    try {
      const { error } = await supabase
        .from('event_scoring_aspects')
        .update({
          name: aspect.name,
          description: aspect.description,
          weight: aspect.weight,
          max_score: aspect.max_score,
          order_index: aspect.order_index
        })
        .eq('id', aspect.id);

      if (error) throw error;

      setEditingAspect(null);
      fetchAspects();
    } catch (err) {
      console.error('Error updating aspect:', err);
    }
  };

  const handleDeleteAspect = async (aspectId: string) => {
    if (!window.confirm('Are you sure you want to delete this scoring aspect?')) return;

    try {
      const { error } = await supabase
        .from('event_scoring_aspects')
        .delete()
        .eq('id', aspectId);

      if (error) throw error;
      fetchAspects();
    } catch (err) {
      console.error('Error deleting aspect:', err);
    }
  };

  const totalWeight = aspects.reduce((sum, aspect) => sum + aspect.weight, 0) + 
    (editingAspect ? 0 : newAspect.weight);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-piano-wine">
            Manage Scoring Aspects - {eventTitle}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-piano-wine"></div>
            </div>
          ) : (
            <>
              <div className="space-y-4 mb-6">
                <h3 className="text-lg font-semibold text-piano-wine">Existing Aspects</h3>
                
                {aspects.length === 0 ? (
                  <p className="text-gray-500">No scoring aspects defined yet.</p>
                ) : (
                  <div className="space-y-3">
                    {aspects.map((aspect, index) => (
                      <div key={aspect.id} className="p-4 border border-piano-gold/30 rounded-lg bg-piano-cream/30">
                        {editingAspect?.id === aspect.id ? (
                          <div className="space-y-3">
                            <input
                              type="text"
                              value={editingAspect.name}
                              onChange={(e) => setEditingAspect({ ...editingAspect, name: e.target.value })}
                              className="w-full px-3 py-2 border border-piano-gold/30 rounded-lg"
                              placeholder="Aspect name"
                            />
                            <textarea
                              value={editingAspect.description || ''}
                              onChange={(e) => setEditingAspect({ ...editingAspect, description: e.target.value })}
                              className="w-full px-3 py-2 border border-piano-gold/30 rounded-lg"
                              placeholder="Description (optional)"
                              rows={2}
                            />
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Weight (%)
                                </label>
                                <input
                                  type="number"
                                  value={editingAspect.weight}
                                  onChange={(e) => setEditingAspect({ ...editingAspect, weight: parseInt(e.target.value) || 0 })}
                                  className="w-full px-3 py-2 border border-piano-gold/30 rounded-lg"
                                  min="0"
                                  max="100"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Max Score
                                </label>
                                <input
                                  type="number"
                                  value={editingAspect.max_score}
                                  onChange={(e) => setEditingAspect({ ...editingAspect, max_score: parseInt(e.target.value) || 100 })}
                                  className="w-full px-3 py-2 border border-piano-gold/30 rounded-lg"
                                  min="1"
                                />
                              </div>
                            </div>
                            <div className="flex justify-end space-x-2">
                              <button
                                onClick={() => setEditingAspect(null)}
                                className="px-3 py-1 text-gray-600 hover:text-gray-800"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleUpdateAspect(editingAspect)}
                                className="px-3 py-1 bg-piano-wine text-white rounded-lg hover:bg-piano-wine/90"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium text-piano-wine">{aspect.name}</h4>
                              {aspect.description && (
                                <p className="text-sm text-gray-600 mt-1">{aspect.description}</p>
                              )}
                              <div className="flex items-center mt-2 space-x-4 text-sm text-gray-500">
                                <span>Weight: {aspect.weight}%</span>
                                <span>Max Score: {aspect.max_score}</span>
                                <span>Order: {index + 1}</span>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 ml-4">
                              <button
                                onClick={() => setEditingAspect(aspect)}
                                className="p-1 text-piano-gold hover:text-piano-gold/80"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteAspect(aspect.id)}
                                className="p-1 text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-piano-gold/30 pt-6">
                <h3 className="text-lg font-semibold text-piano-wine mb-4">Add New Aspect</h3>
                
                <div className="space-y-3">
                  <input
                    type="text"
                    value={newAspect.name}
                    onChange={(e) => setNewAspect({ ...newAspect, name: e.target.value })}
                    className="w-full px-3 py-2 border border-piano-gold/30 rounded-lg"
                    placeholder="Aspect name"
                  />
                  <textarea
                    value={newAspect.description}
                    onChange={(e) => setNewAspect({ ...newAspect, description: e.target.value })}
                    className="w-full px-3 py-2 border border-piano-gold/30 rounded-lg"
                    placeholder="Description (optional)"
                    rows={2}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Weight (%)
                      </label>
                      <input
                        type="number"
                        value={newAspect.weight}
                        onChange={(e) => setNewAspect({ ...newAspect, weight: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-piano-gold/30 rounded-lg"
                        min="0"
                        max="100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Max Score
                      </label>
                      <input
                        type="number"
                        value={newAspect.max_score}
                        onChange={(e) => setNewAspect({ ...newAspect, max_score: parseInt(e.target.value) || 100 })}
                        className="w-full px-3 py-2 border border-piano-gold/30 rounded-lg"
                        min="1"
                      />
                    </div>
                  </div>
                  
                  <button
                    onClick={handleSaveAspect}
                    disabled={!newAspect.name.trim()}
                    className={`w-full py-2 rounded-lg font-medium transition-colors ${
                      newAspect.name.trim()
                        ? 'bg-piano-wine text-white hover:bg-piano-wine/90'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    <Plus className="w-4 h-4 inline mr-2" />
                    Add Aspect
                  </button>
                </div>
              </div>

              <div className="mt-6 p-3 bg-piano-cream rounded-lg border border-piano-gold/30">
                <p className="text-sm text-piano-wine">
                  Total Weight: <span className={`font-semibold ${totalWeight === 100 ? 'text-green-600' : 'text-red-600'}`}>
                    {totalWeight}%
                  </span>
                  <span className="text-gray-600 ml-2">
                    (Must equal 100% for proper score calculation)
                  </span>
                </p>
                {totalWeight !== 100 && (
                  <p className="text-xs text-red-600 mt-1">
                    ⚠️ Weights must sum to exactly 100%. Current total: {totalWeight}%
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