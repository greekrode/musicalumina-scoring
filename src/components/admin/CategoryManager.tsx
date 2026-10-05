import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Clock, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Category, ScoringCriteria } from '../../types';
import CategoryForm from './CategoryForm';
import { Eyebrow } from '../shared/StateCard';

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
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow>Setup</Eyebrow>
          <h2 className="mt-3 text-[1.5rem]">Competition Categories</h2>
          <p className="mt-1 text-ink-muted">Manage scoring categories and criteria</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          <Plus className="h-4 w-4" />
          Add Category
        </button>
      </div>

      <div className="space-y-4">
        {state.categories.map((category) => (
          <div key={category.id} className="card overflow-hidden">
            <div className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-3">
                    <h3 className="text-[1.25rem]">{category.name}</h3>
                    <span className={category.isActive ? 'pill-ok' : 'pill-muted'}>
                      {category.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="mb-3 text-ink-muted">{category.description}</p>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-ink-muted">
                    <div className="flex items-center">
                      <Clock className="mr-1 h-4 w-4" />
                      {category.timeSlot}
                    </div>
                    <div className="flex items-center">
                      <Users className="mr-1 h-4 w-4" />
                      {getParticipantCount(category.id)} participants
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleExpand(category.id)}
                    className="icon-btn"
                    aria-label={expandedCategory === category.id ? 'Collapse criteria' : 'Expand criteria'}
                    title={expandedCategory === category.id ? 'Collapse criteria' : 'Expand criteria'}
                  >
                    {expandedCategory === category.id ? (
                      <ChevronUp className="h-5 w-5" />
                    ) : (
                      <ChevronDown className="h-5 w-5" />
                    )}
                  </button>
                  <button
                    onClick={() => handleEdit(category)}
                    className="icon-btn"
                    aria-label="Edit category"
                    title="Edit category"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(category.id)}
                    className="icon-btn text-status-error-fg hover:text-status-error-fg"
                    aria-label="Delete category"
                    title="Delete category"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {expandedCategory === category.id && (
                <div className="mt-6 border-t border-rule-hairline pt-6">
                  <h4 className="type-label mb-4 text-ink-muted">Scoring Criteria</h4>
                  <div className="grid gap-3">
                    {category.criteria.map((criterion) => (
                      <div
                        key={criterion.id}
                        className="flex flex-wrap items-center justify-between gap-3 border border-rule-hairline bg-surface-warm p-4"
                      >
                        <div className="flex-1">
                          <h5 className="font-medium text-ink-primary">{criterion.name}</h5>
                          <p className="text-sm text-ink-muted">{criterion.description}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium text-ink-primary">
                            Weight: {criterion.weight}%
                          </div>
                          <div className="text-xs text-ink-muted">
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
