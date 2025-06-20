import React, { useState, useEffect } from 'react';
import { X, Plus, Edit2, Trash2, Save, Trophy, Award } from 'lucide-react';
import { useEventCategories } from '../../hooks/useEventCategories';
import { usePrizeConfigurations } from '../../hooks/usePrizeConfigurations';
import { PrizeConfiguration } from '../../types';
import { useEvents } from '../../hooks/useEvents';
import { supabase } from '../../lib/supabase';

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
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden border border-piano-gold/20">
        <div className="flex items-center justify-between p-6 border-b border-piano-gold/30 bg-piano-cream/20">
          <h2 className="text-2xl font-bold text-piano-wine flex items-center">
            <Trophy className="w-6 h-6 mr-2" />
            Prize Configuration - {eventTitle}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-piano-gold/20 rounded-lg transition-colors duration-200 text-piano-wine"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Category/Subcategory Selection */}
          <div className="mb-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category & Subcategory
              </label>
              <select
                value={selectedCategoryCombo}
                onChange={(e) => setSelectedCategoryCombo(e.target.value)}
                className="w-full px-3 py-2 border border-piano-gold/30 rounded-lg focus:ring-2 focus:ring-piano-gold focus:border-transparent"
                disabled={categoriesLoading}
              >
                <option value="">Select Category & Subcategory</option>
                {categories.map((category) => (
                  <option key={`${category.categoryId}|${category.subcategoryId}`} value={`${category.categoryId}|${category.subcategoryId}`}>
                    {category.displayName}
                  </option>
                ))}
              </select>
            </div>

            {/* Copy Configuration Section */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Copy From Category
              </label>
              <select
                value={sourceCategoryCombo}
                onChange={(e) => setSourceCategoryCombo(e.target.value)}
                className="w-full px-3 py-2 border border-piano-gold/30 rounded-lg focus:ring-2 focus:ring-piano-gold focus:border-transparent"
                disabled={categoriesLoading}
              >
                <option value="">Select source to copy from</option>
                {categories.map((category) => (
                  <option key={`source-${category.categoryId}|${category.subcategoryId}`} value={`${category.categoryId}|${category.subcategoryId}`}>
                    {category.displayName}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={handleCopyToAll}
                disabled={!sourceCategoryCombo || copyInProgress || sourceConfigurations.length === 0}
                className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${
                  !sourceCategoryCombo || copyInProgress || sourceConfigurations.length === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-piano-wine text-white hover:bg-piano-wine/90'
                }`}
              >
                {copyInProgress ? 'Copying...' : `Copy to All Others (${categories.length - 1})`}
              </button>
            </div>
          </div>

          {/* Show copy information */}
          {sourceCategoryCombo && (
            <div className="mb-4 p-3 bg-piano-cream/50 border border-piano-gold/30 rounded-lg">
              <p className="text-sm text-piano-wine">
                <strong>Ready to copy:</strong> {sourceConfigurations.length} prize configuration(s) from the selected source to {categories.length - 1} remaining categories.
                {sourceConfigurations.length === 0 && (
                  <span className="text-red-600"> No configurations found in source category.</span>
                )}
              </p>
            </div>
          )}

          {selectedCategoryCombo && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Prize Configuration Form */}
              <div className="bg-piano-cream/20 p-4 rounded-lg border border-piano-gold/30">
                <h3 className="text-lg font-semibold mb-4 text-piano-wine">
                  {editingConfig ? 'Edit Prize Configuration' : 'Add New Prize Configuration'}
                </h3>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Prize Level Name *
                    </label>
                    <input
                      type="text"
                      value={formData.prize_level}
                      onChange={(e) => setFormData({ ...formData, prize_level: e.target.value })}
                      placeholder="e.g., Gold Medal, First Place, Honorable Mention"
                      className="w-full px-3 py-2 border border-piano-gold/30 rounded-lg focus:ring-2 focus:ring-piano-gold focus:border-transparent"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Max Winners *
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={formData.max_winners}
                        onChange={(e) => setFormData({ ...formData, max_winners: parseInt(e.target.value) || 1 })}
                        className="w-full px-3 py-2 border border-piano-gold/30 rounded-lg focus:ring-2 focus:ring-piano-gold focus:border-transparent"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Display Order *
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={formData.display_order}
                        onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 1 })}
                        className="w-full px-3 py-2 border border-piano-gold/30 rounded-lg focus:ring-2 focus:ring-piano-gold focus:border-transparent"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Min Score
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={formData.min_score}
                        onChange={(e) => setFormData({ ...formData, min_score: e.target.value })}
                        placeholder="e.g., 95.00"
                        className="w-full px-3 py-2 border border-piano-gold/30 rounded-lg focus:ring-2 focus:ring-piano-gold focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Max Score
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={formData.max_score}
                        onChange={(e) => setFormData({ ...formData, max_score: e.target.value })}
                        placeholder="e.g., 100.00"
                        className="w-full px-3 py-2 border border-piano-gold/30 rounded-lg focus:ring-2 focus:ring-piano-gold focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="flex-1 bg-piano-wine text-white py-2 px-4 rounded-lg hover:bg-piano-wine/90 focus:outline-none focus:ring-2 focus:ring-piano-gold"
                    >
                      {editingConfig ? 'Update Configuration' : 'Add Configuration'}
                    </button>
                    
                    {editingConfig && (
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="px-4 py-2 border border-piano-gold/30 text-piano-wine rounded-lg hover:bg-piano-cream/20 focus:outline-none focus:ring-2 focus:ring-piano-gold"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Existing Configurations List */}
              <div>
                <h3 className="text-lg font-semibold mb-4 text-piano-wine">Current Prize Configurations</h3>
                
                                  {configsLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-piano-wine mx-auto"></div>
                      <p className="mt-2 text-gray-600">Loading configurations...</p>
                    </div>
                ) : prizeConfigurations.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No prize configurations found for this category/subcategory.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {prizeConfigurations
                      .sort((a, b) => a.display_order - b.display_order)
                      .map((config) => (
                        <div
                          key={config.id}
                          className="bg-white p-4 rounded-lg border border-piano-gold/20 hover:border-piano-gold/40 hover:bg-piano-cream/10 transition-colors"
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h4 className="font-semibold text-piano-wine">{config.prize_level}</h4>
                              <div className="text-sm text-gray-600 mt-1">
                                <p>Max Winners: {config.max_winners}</p>
                                {config.min_score !== null && config.max_score !== null && (
                                  <p>Score Range: {config.min_score} - {config.max_score}</p>
                                )}
                                <p>Display Order: {config.display_order}</p>
                              </div>
                            </div>
                            
                            <div className="flex gap-2 ml-4">
                              <button
                                onClick={() => handleEdit(config)}
                                className="p-2 text-piano-gold hover:text-piano-wine hover:bg-piano-gold/10 rounded-lg transition-colors"
                                title="Edit configuration"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(config)}
                                className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete configuration"
                              >
                                <Trash2 className="w-4 h-4" />
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
            <div className="text-center py-12">
              <Award className="mx-auto h-12 w-12 text-piano-wine/40" />
              <h3 className="mt-2 text-sm font-medium text-piano-wine">No category selected</h3>
              <p className="mt-1 text-sm text-gray-500">
                Please select a category/subcategory to manage prize configurations.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 