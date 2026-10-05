import React, { useState, useEffect } from 'react';
import { X, Plus, Edit2, Trash2, Save, Trophy, Award, ChevronDown } from 'lucide-react';
import { useEventCategories } from '../../hooks/useEventCategories';
import { usePrizeConfigurations } from '../../hooks/usePrizeConfigurations';
import { PrizeConfiguration } from '../../types';
import { useEvents } from '../../hooks/useEvents';
import { supabase } from '../../lib/supabase';
import { Eyebrow } from '../shared/StateCard';

interface PrizeConfigurationManagerProps {
  eventId: string;
  eventTitle: string;
  onClose: () => void;
}

export default function PrizeConfigurationManager({ eventId, eventTitle, onClose }: PrizeConfigurationManagerProps) {
  const [selectedCategoryCombo, setSelectedCategoryCombo] = useState<string>('');
  const [sourceCategoryCombo, setSourceCategoryCombo] = useState<string>('');
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [copyInProgress, setCopyInProgress] = useState(false);
  const [editingConfig, setEditingConfig] = useState<Partial<PrizeConfiguration> | null>(null);
  const [formData, setFormData] = useState({
    prize_level: '',
    max_winners: 1,
    min_score: '',
    max_score: '',
    display_order: 1
  });

  const { categories, loading: categoriesLoading } = useEventCategories(eventId);
  
  // Parse selected category combo to get categoryId and subcategoryId
  const [categoryId, subcategoryId] = selectedCategoryCombo ? selectedCategoryCombo.split('|') : ['', ''];
  
  const { 
    prizeConfigurations, 
    loading: configsLoading, 
    createPrizeConfiguration, 
    updatePrizeConfiguration, 
    deletePrizeConfiguration,
    refetch 
  } = usePrizeConfigurations(eventId, categoryId || undefined, subcategoryId || undefined);

  // Get source configurations for copying
  const [sourceCategoryId, sourceSubcategoryId] = sourceCategoryCombo ? sourceCategoryCombo.split('|') : ['', ''];
  const { 
    prizeConfigurations: sourceConfigurations 
  } = usePrizeConfigurations(eventId, sourceCategoryId || undefined, sourceSubcategoryId || undefined);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedCategoryCombo) {
      alert('Please select category/subcategory');
      return;
    }

    // Validate score range
    const minScore = formData.min_score ? parseFloat(formData.min_score) : null;
    const maxScore = formData.max_score ? parseFloat(formData.max_score) : null;
    
    if (minScore !== null && maxScore !== null && minScore > maxScore) {
      alert('Minimum score cannot be greater than maximum score');
      return;
    }

    // Check for overlapping score ranges (excluding current editing item)
    const hasOverlap = prizeConfigurations.some(config => {
      if (editingConfig && config.id === editingConfig.id) return false;
      
      const configMin = config.min_score;
      const configMax = config.max_score;
      
      if (!configMin || !configMax || !minScore || !maxScore) return false;
      
      return (
        (minScore >= configMin && minScore <= configMax) ||
        (maxScore >= configMin && maxScore <= configMax) ||
        (minScore <= configMin && maxScore >= configMax)
      );
    });

    if (hasOverlap) {
      alert('Score range overlaps with existing prize configuration');
      return;
    }

    const configData = {
      event_id: eventId,
      category_id: categoryId,
      subcategory_id: subcategoryId,
      prize_level: formData.prize_level,
      max_winners: formData.max_winners,
      min_score: minScore,
      max_score: maxScore,
      display_order: formData.display_order,
      active: true
    };

    try {
      if (editingConfig && editingConfig.id) {
        await updatePrizeConfiguration(editingConfig.id, configData);
      } else {
        await createPrizeConfiguration(configData);
      }
      
      // Reset form
      setFormData({
        prize_level: '',
        max_winners: 1,
        min_score: '',
        max_score: '',
        display_order: prizeConfigurations.length + 1
      });
      setEditingConfig(null);
    } catch (error) {
      console.error('Error saving prize configuration:', error);
      alert('Failed to save prize configuration');
    }
  };

  const handleEdit = (config: PrizeConfiguration) => {
    setEditingConfig(config);
    setFormData({
      prize_level: config.prize_level,
      max_winners: config.max_winners,
      min_score: config.min_score?.toString() || '',
      max_score: config.max_score?.toString() || '',
      display_order: config.display_order
    });
  };

  const handleDelete = async (config: PrizeConfiguration) => {
    if (!confirm(`Are you sure you want to delete the "${config.prize_level}" prize configuration?`)) {
      return;
    }

    try {
      await deletePrizeConfiguration(config.id);
    } catch (error) {
      console.error('Error deleting prize configuration:', error);
      alert('Failed to delete prize configuration');
    }
  };

  const cancelEdit = () => {
    setEditingConfig(null);
    setFormData({
      prize_level: '',
      max_winners: 1,
      min_score: '',
      max_score: '',
      display_order: prizeConfigurations.length + 1
    });
  };

  const handleCopyToAll = async () => {
    if (!sourceCategoryCombo || sourceConfigurations.length === 0) {
      alert('Please select a source category with existing configurations');
      return;
    }

    const targetCategories = categories.filter(cat => 
      `${cat.categoryId}|${cat.subcategoryId}` !== sourceCategoryCombo
    );

    if (targetCategories.length === 0) {
      alert('No target categories available to copy to');
      return;
    }

    const confirmMessage = `This will copy ${sourceConfigurations.length} prize configuration(s) from the source category to ${targetCategories.length} remaining categories. Existing configurations in target categories will be deleted first. Continue?`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    setCopyInProgress(true);
    try {
      for (const targetCategory of targetCategories) {
        const [targetCategoryId, targetSubcategoryId] = targetCategory.categoryId.includes('|') 
          ? targetCategory.categoryId.split('|') 
          : [targetCategory.categoryId, targetCategory.subcategoryId];

        // First, delete existing configurations in target category
        const { data: existingConfigs, error: fetchError } = await supabase
          .from('event_prize_configurations')
          .select('id')
          .eq('event_id', eventId)
          .eq('category_id', targetCategoryId)
          .eq('subcategory_id', targetSubcategoryId);

        if (fetchError) throw fetchError;

        if (existingConfigs && existingConfigs.length > 0) {
          const { error: deleteError } = await supabase
            .from('event_prize_configurations')
            .delete()
            .eq('event_id', eventId)
            .eq('category_id', targetCategoryId)
            .eq('subcategory_id', targetSubcategoryId);

          if (deleteError) throw deleteError;
        }

        // Then, copy configurations from source
        for (const sourceConfig of sourceConfigurations) {
          const newConfig = {
            event_id: eventId,
            category_id: targetCategoryId,
            subcategory_id: targetSubcategoryId,
            prize_level: sourceConfig.prize_level,
            max_winners: sourceConfig.max_winners,
            min_score: sourceConfig.min_score,
            max_score: sourceConfig.max_score,
            display_order: sourceConfig.display_order,
            active: sourceConfig.active
          };

          await createPrizeConfiguration(newConfig);
        }
      }

      alert(`Successfully copied configurations to ${targetCategories.length} categories!`);
      setShowCopyDialog(false);
      setSourceCategoryCombo('');
      
      // Refresh current configurations if we're viewing a target category
      if (selectedCategoryCombo) {
        refetch();
      }
    } catch (error) {
      console.error('Error copying configurations:', error);
      alert('Failed to copy configurations. Please try again.');
    } finally {
      setCopyInProgress(false);
    }
  };

  return (
    <div className="overlay">
      <div className="sheet sm:max-w-6xl" role="dialog" aria-modal="true">
        <div className="flex items-start justify-between px-6 pt-6">
          <div>
            <Eyebrow>Prizes</Eyebrow>
            <h2 className="mt-3 flex items-center text-[1.5rem]">
              <Trophy className="mr-2 h-5 w-5 text-ink-accent" />
              Prize Configuration - {eventTitle}
            </h2>
          </div>
          <button onClick={onClose} className="icon-btn" aria-label="Close" title="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 pb-6 pt-6">
          {/* Category/Subcategory Selection */}
          <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div>
              <label className="field-label">Category & Subcategory</label>
              <div className="relative">
                <select
                  value={selectedCategoryCombo}
                  onChange={(e) => setSelectedCategoryCombo(e.target.value)}
                  className="field"
                  disabled={categoriesLoading}
                >
                  <option value="">Select Category & Subcategory</option>
                  {categories.map((category) => (
                    <option key={`${category.categoryId}|${category.subcategoryId}`} value={`${category.categoryId}|${category.subcategoryId}`}>
                      {category.displayName}
                    </option>
                  ))}
                </select>
                <ChevronDown aria-hidden className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              </div>
            </div>

            {/* Copy Configuration Section */}
            <div>
              <label className="field-label">Copy From Category</label>
              <div className="relative">
                <select
                  value={sourceCategoryCombo}
                  onChange={(e) => setSourceCategoryCombo(e.target.value)}
                  className="field"
                  disabled={categoriesLoading}
                >
                  <option value="">Select source to copy from</option>
                  {categories.map((category) => (
                    <option key={`source-${category.categoryId}|${category.subcategoryId}`} value={`${category.categoryId}|${category.subcategoryId}`}>
                      {category.displayName}
                    </option>
                  ))}
                </select>
                <ChevronDown aria-hidden className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              </div>
            </div>

            <div className="flex items-end">
              <button
                onClick={handleCopyToAll}
                disabled={!sourceCategoryCombo || copyInProgress || sourceConfigurations.length === 0}
                className="btn-secondary w-full"
              >
                {copyInProgress ? 'Copying...' : `Copy to All Others (${categories.length - 1})`}
              </button>
            </div>
          </div>

          {/* Show copy information */}
          {sourceCategoryCombo && (
            <div className="mb-4 border border-rule-hairline bg-surface-warm p-3">
              <p className="text-sm text-ink-primary">
                <strong>Ready to copy:</strong> {sourceConfigurations.length} prize configuration(s) from the selected source to {categories.length - 1} remaining categories.
                {sourceConfigurations.length === 0 && (
                  <span className="text-status-error-fg"> No configurations found in source category.</span>
                )}
              </p>
            </div>
          )}

          {selectedCategoryCombo && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Prize Configuration Form */}
              <div className="card border-t-2 border-t-marigold p-4">
                <h3 className="mb-4 text-[1.25rem]">
                  {editingConfig ? 'Edit Prize Configuration' : 'Add New Prize Configuration'}
                </h3>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="field-label">Prize Level Name *</label>
                    <input
                      type="text"
                      value={formData.prize_level}
                      onChange={(e) => setFormData({ ...formData, prize_level: e.target.value })}
                      placeholder="e.g., Gold Medal, First Place, Honorable Mention"
                      className="field"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="field-label">Max Winners *</label>
                      <input
                        type="number"
                        min="1"
                        value={formData.max_winners}
                        onChange={(e) => setFormData({ ...formData, max_winners: parseInt(e.target.value) || 1 })}
                        className="field"
                        required
                      />
                    </div>

                    <div>
                      <label className="field-label">Display Order *</label>
                      <input
                        type="number"
                        min="1"
                        value={formData.display_order}
                        onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 1 })}
                        className="field"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="field-label">Min Score</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={formData.min_score}
                        onChange={(e) => setFormData({ ...formData, min_score: e.target.value })}
                        placeholder="e.g., 95.00"
                        className="field"
                      />
                    </div>

                    <div>
                      <label className="field-label">Max Score</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={formData.max_score}
                        onChange={(e) => setFormData({ ...formData, max_score: e.target.value })}
                        placeholder="e.g., 100.00"
                        className="field"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button type="submit" className="btn-primary flex-1">
                      {editingConfig ? 'Update Configuration' : 'Add Configuration'}
                    </button>

                    {editingConfig && (
                      <button type="button" onClick={cancelEdit} className="btn-outline">
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Existing Configurations List */}
              <div>
                <h3 className="mb-4 text-[1.25rem]">Current Prize Configurations</h3>

                {configsLoading ? (
                  <div className="py-8 text-center">
                    <div className="spinner mx-auto" />
                    <p className="mt-2 text-ink-muted">Loading configurations...</p>
                  </div>
                ) : prizeConfigurations.length === 0 ? (
                  <div className="py-8 text-center text-ink-muted">
                    No prize configurations found for this category/subcategory.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {prizeConfigurations
                      .sort((a, b) => a.display_order - b.display_order)
                      .map((config) => (
                        <div
                          key={config.id}
                          className="card p-4 transition-colors hover:bg-surface-warm/60"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-semibold text-ink-primary">{config.prize_level}</h4>
                              <div className="mt-1 text-sm text-ink-muted">
                                <p>Max Winners: {config.max_winners}</p>
                                {config.min_score !== null && config.max_score !== null && (
                                  <p>Score Range: {config.min_score} - {config.max_score}</p>
                                )}
                                <p>Display Order: {config.display_order}</p>
                              </div>
                            </div>

                            <div className="ml-4 flex gap-1">
                              <button
                                onClick={() => handleEdit(config)}
                                className="icon-btn"
                                title="Edit configuration"
                                aria-label="Edit configuration"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(config)}
                                className="icon-btn text-status-error-fg hover:text-status-error-fg"
                                title="Delete configuration"
                                aria-label="Delete configuration"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {!selectedCategoryCombo && (
            <div className="py-12 text-center">
              <Award className="mx-auto h-12 w-12 text-ink-subtle" />
              <h3 className="mt-2 text-[1.25rem]">No category selected</h3>
              <p className="mt-1 text-sm text-ink-muted">
                Please select a category/subcategory to manage prize configurations.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
