import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Clock, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Category, ScoringCriteria } from '../../types';
import CategoryForm from './CategoryForm';

export default function CategoryManager() {
  const { state, deleteCategory } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setShowForm(true);
  };

  const handleDelete = (categoryId: string) => {
    if (window.confirm('Are you sure you want to delete this category? This action cannot be undone.')) {
      deleteCategory(categoryId);
    }
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingCategory(null);
  };

  const toggleExpand = (categoryId: string) => {
    setExpandedCategory(expandedCategory === categoryId ? null : categoryId);
  };

  const getParticipantCount = (categoryId: string) => {
    return state.participants.filter(p => p.categoryId === categoryId).length;
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Competition Categories</h2>
          <p className="text-gray-600">Manage scoring categories and criteria</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center px-4 py-2 bg-piano-wine text-white rounded-lg hover:bg-piano-wine/90 focus:ring-2 focus:ring-piano-wine focus:ring-offset-2 transition-all duration-200"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Category
        </button>
      </div>

      <div className="space-y-4">
        {state.categories.map((category) => (
          <div
            key={category.id}
            className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden"
          >
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{category.name}</h3>
                    <span
                      className={`ml-3 px-2 py-1 text-xs font-medium rounded-full ${
                        category.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {category.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-gray-600 mb-3">{category.description}</p>
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 mr-1" />
                      {category.timeSlot}
                    </div>
                    <div className="flex items-center">
                      <Users className="w-4 h-4 mr-1" />
                      {getParticipantCount(category.id)} participants
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => toggleExpand(category.id)}
                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors duration-200"
                  >
                    {expandedCategory === category.id ? (
                      <ChevronUp className="w-5 h-5" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
                    )}
                  </button>
                  <button
                    onClick={() => handleEdit(category)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(category.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {expandedCategory === category.id && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h4 className="text-md font-semibold text-gray-900 mb-4">Scoring Criteria</h4>
                  <div className="grid gap-3">
                    {category.criteria.map((criterion) => (
                      <div
                        key={criterion.id}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                      >
                        <div className="flex-1">
                          <h5 className="font-medium text-gray-900">{criterion.name}</h5>
                          <p className="text-sm text-gray-600">{criterion.description}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium text-gray-900">
                            Weight: {criterion.weight}%
                          </div>
                          <div className="text-xs text-gray-500">
                            Max: {criterion.maxScore} points
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <CategoryForm
          category={editingCategory}
          onClose={closeForm}
        />
      )}
    </div>
  );
}