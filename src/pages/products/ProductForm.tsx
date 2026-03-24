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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 bg-white dark:bg-gray-800 p-8 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
      
      <div>
        <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">基本情報</h3>
        <div className="grid grid-cols-1 gap-y-6 gap-x-6 sm:grid-cols-6">
          <div className="sm:col-span-2">
            <label htmlFor="code" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              商品コード
            </label>
            <div className="mt-1">
              <input
                type="text"
                id="code"
                {...register('code')}
                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md p-2.5 border transition-colors"
                placeholder="例: P-001"
              />
            </div>
          </div>

          <div className="sm:col-span-4">
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              商品名 <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            <div className="mt-1">
              <input
                type="text"
                id="name"
                {...register('name')}
                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md p-2.5 border transition-colors"
                placeholder="例: 高性能ノートPC"
              />
              {errors.name && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.name.message}</p>}
            </div>
          </div>

          <div className="sm:col-span-6">
            <label htmlFor="manufacturer" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              メーカー
            </label>
            <div className="mt-1">
              <input
                type="text"
                id="manufacturer"
                {...register('manufacturer')}
                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md p-2.5 border transition-colors"
                placeholder="例: TechCorp"
              />
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">価格・在庫</h3>
        <div className="grid grid-cols-1 gap-y-6 gap-x-6 sm:grid-cols-6">
          <div className="sm:col-span-2">
            <label htmlFor="price" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              単価 (¥) <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            <div className="mt-1">
              <input
                type="number"
                id="price"
                {...register('price')}
                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md p-2.5 border transition-colors"
              />
              {errors.price && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.price.message}</p>}
            </div>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="stock" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              在庫数 <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            <div className="mt-1">
              <input
                type="number"
                id="stock"
                {...register('stock')}
                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md p-2.5 border transition-colors"
              />
              {errors.stock && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.stock.message}</p>}
            </div>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="unit" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              単位
            </label>
            <div className="mt-1">
              <input
                type="text"
                id="unit"
                {...register('unit')}
                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md p-2.5 border transition-colors"
                placeholder="例: 個, 台"
              />
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">その他</h3>
        <div className="grid grid-cols-1 gap-y-6 gap-x-6 sm:grid-cols-6">
          <div className="sm:col-span-6">
            <label htmlFor="tags" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              タグ
            </label>
            <div className="mt-1">
              <div className="flex flex-wrap gap-2 mb-2">
                {tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-indigo-400 hover:bg-indigo-200 hover:text-indigo-500 dark:hover:bg-indigo-800 focus:outline-none"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <input
                type="text"
                id="tags"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md p-2.5 border transition-colors"
                placeholder="タグを入力してEnterを押す"
              />
            </div>
          </div>

          <div className="sm:col-span-6">
            <label htmlFor="note" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              備考
            </label>
            <div className="mt-1">
              <textarea
                id="note"
                rows={3}
                {...register('note')}
                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md p-2.5 border transition-colors"
                placeholder="特記事項など"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-4">
        <button
          type="button"
          onClick={() => navigate('/products')}
          className="bg-white dark:bg-gray-800 py-2.5 px-5 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-900 transition-colors"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex justify-center py-2.5 px-5 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-900 disabled:opacity-50 transition-colors"
        >
          {isSubmitting ? '保存中...' : '保存'}
        </button>
      </div>
    </form>
  );
}
