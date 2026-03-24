import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { productSchema, ProductFormValues } from '../../lib/validations';
import { useNavigate } from 'react-router-dom';
import React, { useState } from 'react';
import { X } from 'lucide-react';

type Props = {
  defaultValues?: Partial<ProductFormValues>;
  onSubmit: (data: ProductFormValues) => Promise<void>;
  isSubmitting: boolean;
};

export default function ProductForm({ defaultValues, onSubmit, isSubmitting }: Props) {
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 card p-6 sm:p-8">

      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 pb-2 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
          <span className="w-5 h-5 rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-bold">1</span>
          基本情報
        </h3>
        <div className="grid grid-cols-1 gap-y-6 gap-x-6 sm:grid-cols-6">
          <div className="sm:col-span-2">
            <label htmlFor="code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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

          <div className="sm:col-span-6">
            <label htmlFor="manufacturer" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 pb-2 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
          <span className="w-5 h-5 rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-bold">2</span>
          価格・在庫
        </h3>
        <div className="grid grid-cols-1 gap-y-6 gap-x-6 sm:grid-cols-6">
          <div className="sm:col-span-2">
            <label htmlFor="price" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
            <label htmlFor="stock" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
            <label htmlFor="unit" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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

      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 pb-2 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
          <span className="w-5 h-5 rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-bold">3</span>
          その他
        </h3>
        <div className="grid grid-cols-1 gap-y-6 gap-x-6 sm:grid-cols-6">
          <div className="sm:col-span-6">
            <label htmlFor="tags" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              タグ
            </label>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-indigo-400 hover:bg-indigo-200 hover:text-indigo-600 dark:hover:bg-indigo-800 focus:outline-none"
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
            <label htmlFor="note" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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

      <div className="pt-5 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
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
          {isSubmitting ? '保存中...' : '保存する'}
        </button>
      </div>
    </form>
  );
}
