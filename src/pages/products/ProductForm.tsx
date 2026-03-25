import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { productSchema, ProductFormValues } from '../../lib/validations';
import { useNavigate } from 'react-router-dom';
import React, { useState } from 'react';
import { X, FolderOpen, Save } from 'lucide-react';
import type { ProductGroup } from '../../types/models';

type Props = {
  defaultValues?: Partial<ProductFormValues>;
  onSubmit: (data: ProductFormValues) => Promise<void>;
  isSubmitting: boolean;
  groups?: ProductGroup[];
};

export default function ProductForm({ defaultValues, onSubmit, isSubmitting, groups = [] }: Props) {
  const navigate = useNavigate();
  const [tagInput, setTagInput] = useState('');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema) as any,
    defaultValues: {
      code: '',
      name: '',
      manufacturer: '',
      price: 0,
      stock: 0,
      unit: '',
      note: '',
      tags: [],
      groupId: '',
      ...defaultValues,
    },
  });

  const tags = watch('tags') || [];

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const newTag = tagInput.trim();
      if (newTag && !tags.includes(newTag)) {
        setValue('tags', [...tags, newTag], { shouldDirty: true });
        setTagInput('');
      }
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setValue('tags', tags.filter(tag => tag !== tagToRemove), { shouldDirty: true });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Section 1: Basic Info */}
      <div className="card p-6 sm:p-8 space-y-6">
        <h3 className="section-title">
          <span className="section-badge">1</span>
          基本情報
        </h3>
        <div className="grid grid-cols-1 gap-y-5 gap-x-6 sm:grid-cols-6">
          <div className="sm:col-span-2">
            <label htmlFor="code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              商品コード
            </label>
            <input
              type="text"
              id="code"
              {...register('code')}
              className="input-base font-mono"
              placeholder="例: P-001"
            />
          </div>

          <div className="sm:col-span-4">
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              商品名 <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            <input
              type="text"
              id="name"
              {...register('name')}
              className="input-base"
              placeholder="例: 高性能ノートPC"
            />
            {errors.name && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{errors.name.message}</p>}
          </div>

          <div className="sm:col-span-3">
            <label htmlFor="manufacturer" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              メーカー
            </label>
            <input
              type="text"
              id="manufacturer"
              {...register('manufacturer')}
              className="input-base"
              placeholder="例: TechCorp"
            />
          </div>

          {groups.length > 0 && (
            <div className="sm:col-span-3">
              <label htmlFor="groupId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                <span className="inline-flex items-center gap-1.5"><FolderOpen className="w-4 h-4" />グループ</span>
              </label>
              <select
                id="groupId"
                {...register('groupId')}
                className="input-base"
              >
                <option value="">グループなし</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Section 2: Price & Stock */}
      <div className="card p-6 sm:p-8 space-y-6">
        <h3 className="section-title">
          <span className="section-badge">2</span>
          価格・在庫
        </h3>
        <div className="grid grid-cols-1 gap-y-5 gap-x-6 sm:grid-cols-6">
          <div className="sm:col-span-2">
            <label htmlFor="price" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              単価 (¥) <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            <input
              type="number"
              id="price"
              {...register('price')}
              className="input-base"
            />
            {errors.price && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{errors.price.message}</p>}
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="stock" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              在庫数 <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            <input
              type="number"
              id="stock"
              {...register('stock')}
              className="input-base"
            />
            {errors.stock && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{errors.stock.message}</p>}
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="unit" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              単位
            </label>
            <input
              type="text"
              id="unit"
              {...register('unit')}
              className="input-base"
              placeholder="例: 個, 台"
            />
          </div>
        </div>
      </div>

      {/* Section 3: Other */}
      <div className="card p-6 sm:p-8 space-y-6">
        <h3 className="section-title">
          <span className="section-badge">3</span>
          その他
        </h3>
        <div className="grid grid-cols-1 gap-y-5 gap-x-6 sm:grid-cols-6">
          <div className="sm:col-span-6">
            <label htmlFor="tags" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              タグ
            </label>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="inline-flex items-center justify-center w-4 h-4 rounded-full text-indigo-400 hover:bg-indigo-200 hover:text-indigo-600 dark:hover:bg-indigo-800 focus:outline-none transition-colors"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <input
              type="text"
              id="tags"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              className="input-base"
              placeholder="タグを入力してEnterを押す"
            />
          </div>

          <div className="sm:col-span-6">
            <label htmlFor="note" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              備考
            </label>
            <textarea
              id="note"
              rows={3}
              {...register('note')}
              className="input-base resize-none"
              placeholder="特記事項など"
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => navigate('/products')}
          className="btn-secondary"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          {isSubmitting ? '保存中...' : '保存する'}
        </button>
      </div>
    </form>
  );
}
