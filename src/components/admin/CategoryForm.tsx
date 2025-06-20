import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Category, ScoringCriteria } from '../../types';

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
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            {category ? 'Edit Category' : 'Create New Category'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Time Slot
                </label>
                <input
                  type="text"
                  value={formData.timeSlot}
                  onChange={(e) => setFormData({ ...formData, timeSlot: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 9:00 AM - 12:00 PM"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
                Active category
              </label>
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Scoring Criteria</h3>
                <button
                  type="button"
                  onClick={addCriterion}
                  className="inline-flex items-center px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Criterion
                </button>
              </div>

              <div className="space-y-4">
                {criteria.map((criterion, index) => (
                  <div key={criterion.id} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Name
                        </label>
                        <input
                          type="text"
                          value={criterion.name}
                          onChange={(e) => updateCriterion(criterion.id, 'name', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Weight (%)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={criterion.weight}
                          onChange={(e) => updateCriterion(criterion.id, 'weight', parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Max Score
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={criterion.maxScore}
                          onChange={(e) => updateCriterion(criterion.id, 'maxScore', parseInt(e.target.value) || 100)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        />
                      </div>

                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={() => removeCriterion(criterion.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                          disabled={criteria.length <= 1}
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <input
                        type="text"
                        value={criterion.description}
                        onChange={(e) => updateCriterion(criterion.id, 'description', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Description of scoring criterion"
                        required
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  Total Weight: <span className={`font-semibold ${totalWeight === 100 ? 'text-green-600' : 'text-red-600'}`}>
                    {totalWeight}%
                  </span>
                  {totalWeight !== 100 && (
                    <span className="text-red-600 ml-2">
                      (Must equal 100%)
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-piano-wine text-white rounded-lg hover:bg-piano-wine/90 focus:ring-2 focus:ring-piano-wine focus:ring-offset-2"
              >
                {category ? 'Update' : 'Create'} Category
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}