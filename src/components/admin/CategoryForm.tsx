import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Category, ScoringCriteria } from '../../types';
import { Eyebrow } from '../shared/StateCard';

interface CategoryFormProps {
  category?: Category | null;
  onClose: () => void;
}

export default function CategoryForm({ category, onClose }: CategoryFormProps) {
  const { createCategory, updateCategory } = useApp();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    timeSlot: '',
    isActive: true,
  });
  const [criteria, setCriteria] = useState<ScoringCriteria[]>([]);

  useEffect(() => {
    if (category) {
      setFormData({
        name: category.name,
        description: category.description,
        timeSlot: category.timeSlot,
        isActive: category.isActive,
      });
      setCriteria(category.criteria);
    } else {
      // Default criteria for new categories
      setCriteria([
        { id: Date.now().toString(), name: 'Technical Skill', description: 'Technical execution and accuracy', weight: 30, maxScore: 100 },
        { id: (Date.now() + 1).toString(), name: 'Musical Expression', description: 'Interpretation and musicality', weight: 40, maxScore: 100 },
        { id: (Date.now() + 2).toString(), name: 'Stage Presence', description: 'Performance confidence and presentation', weight: 30, maxScore: 100 },
      ]);
    }
  }, [category]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate weights sum to 100
    const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);
    if (totalWeight !== 100) {
      alert('Scoring criteria weights must sum to 100%');
      return;
    }

    const categoryData = {
      ...formData,
      criteria,
    };

    if (category) {
      updateCategory({ ...category, ...categoryData });
    } else {
      createCategory(categoryData);
    }

    onClose();
  };

  const addCriterion = () => {
    const newCriterion: ScoringCriteria = {
      id: Date.now().toString(),
      name: '',
      description: '',
      weight: 0,
      maxScore: 100,
    };
    setCriteria([...criteria, newCriterion]);
  };

  const updateCriterion = (id: string, field: keyof ScoringCriteria, value: string | number) => {
    setCriteria(criteria.map(c => 
      c.id === id ? { ...c, [field]: value } : c
    ));
  };

  const removeCriterion = (id: string) => {
    setCriteria(criteria.filter(c => c.id !== id));
  };

  const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);

  return (
    <div className="overlay">
      <div className="sheet sm:max-w-4xl" role="dialog" aria-modal="true">
        <div className="flex items-start justify-between px-6 pt-6">
          <div>
            <Eyebrow>Category</Eyebrow>
            <h2 className="mt-3 text-[1.5rem]">
              {category ? 'Edit Category' : 'Create New Category'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="icon-btn"
            aria-label="Close"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 px-6 pb-6 pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="field-label">Category Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="field"
                required
              />
            </div>

            <div>
              <label className="field-label">Time Slot</label>
              <input
                type="text"
                value={formData.timeSlot}
                onChange={(e) => setFormData({ ...formData, timeSlot: e.target.value })}
                className="field"
                placeholder="e.g., 9:00 AM - 12:00 PM"
                required
              />
            </div>
          </div>

          <div>
            <label className="field-label">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="field"
              required
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="h-4 w-4 rounded-sm border-rule-subtle accent-burgundy focus:ring-marigold"
            />
            <label htmlFor="isActive" className="ml-2 block text-sm text-ink-primary">
              Active category
            </label>
          </div>

          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-[1.25rem]">Scoring Criteria</h3>
              <button
                type="button"
                onClick={addCriterion}
                className="btn-outline btn-sm"
              >
                <Plus className="h-4 w-4" />
                Add Criterion
              </button>
            </div>

            <div className="space-y-4">
              {criteria.map((criterion, index) => (
                <div key={criterion.id} className="border border-rule-hairline bg-surface-warm p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="field-label">Name</label>
                      <input
                        type="text"
                        value={criterion.name}
                        onChange={(e) => updateCriterion(criterion.id, 'name', e.target.value)}
                        className="field"
                        required
                      />
                    </div>

                    <div>
                      <label className="field-label">Weight (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={criterion.weight}
                        onChange={(e) => updateCriterion(criterion.id, 'weight', parseInt(e.target.value) || 0)}
                        className="field"
                        required
                      />
                    </div>

                    <div>
                      <label className="field-label">Max Score</label>
                      <input
                        type="number"
                        min="1"
                        value={criterion.maxScore}
                        onChange={(e) => updateCriterion(criterion.id, 'maxScore', parseInt(e.target.value) || 100)}
                        className="field"
                        required
                      />
                    </div>

                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => removeCriterion(criterion.id)}
                        className="icon-btn text-status-error-fg hover:text-status-error-fg"
                        disabled={criteria.length <= 1}
                        aria-label="Remove criterion"
                        title="Remove criterion"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3">
                    <label className="field-label">Description</label>
                    <input
                      type="text"
                      value={criterion.description}
                      onChange={(e) => updateCriterion(criterion.id, 'description', e.target.value)}
                      className="field"
                      placeholder="Description of scoring criterion"
                      required
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 border border-rule-hairline bg-surface-warm p-3">
              <p className="text-sm text-ink-body">
                Total Weight: <span className={`font-semibold ${totalWeight === 100 ? 'text-status-open-fg' : 'text-status-error-fg'}`}>
                  {totalWeight}%
                </span>
                {totalWeight !== 100 && (
                  <span className="ml-2 text-status-error-fg">
                    (Must equal 100%)
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-3 border-t border-rule-hairline pt-6">
            <button type="button" onClick={onClose} className="btn-ghost">
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              {category ? 'Update' : 'Create'} Category
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
