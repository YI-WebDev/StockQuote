import { useEffect, useState } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { quoteSchema, QuoteFormValues } from '../../lib/validations';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Search } from 'lucide-react';
import ProductSelectModal from './ProductSelectModal';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { generateQuoteNumber } from '../../lib/quoteNumber';
import { calculateItemAmount, calculateQuoteTotals } from '../../lib/quoteCalculations';
import { TAX_RATE } from '../../config/constants';
import type { ProductForSelect } from '../../types/models';

type Props = {
  defaultValues?: Partial<QuoteFormValues>;
  onSubmit: (data: QuoteFormValues) => Promise<void>;
  isSubmitting: boolean;
};

export default function QuoteForm({ defaultValues, onSubmit, isSubmitting }: Props) {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);
  const [products, setProducts] = useState<ProductForSelect[]>([]);
  const [activeDropdownIndex, setActiveDropdownIndex] = useState<number | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'products'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ProductForSelect[]);
    });
    return () => unsubscribe();
  }, []);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteSchema) as any, // zod v4とreact-hook-formの型不整合を回避
    defaultValues: {
      quoteNumber: generateQuoteNumber(),
      subject: '',
      customerName: '',
      issueDate: new Date().toISOString().split('T')[0],
      expiryDate: '',
      note: '',
      subtotal: 0,
      tax: 0,
      total: 0,
      items: [{ productId: null, productName: '', manufacturer: '', price: 0, quantity: 1, amount: 0 }],
      ...defaultValues,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const items = useWatch({ control, name: 'items' });
  const subtotal = useWatch({ control, name: 'subtotal' });
  const tax = useWatch({ control, name: 'tax' });
  const total = useWatch({ control, name: 'total' });

  // Auto-calculate amounts
  useEffect(() => {
    items.forEach((item, index) => {
      const amount = calculateItemAmount(item.price, item.quantity);
      if (item.amount !== amount) {
        setValue(`items.${index}.amount`, amount);
      }
    });

    const totals = calculateQuoteTotals(items);
    setValue('subtotal', totals.subtotal);
    setValue('tax', totals.tax);
    setValue('total', totals.total);
  }, [items, setValue]);

  const handleProductSelect = (product: ProductForSelect, index: number) => {
    setValue(`items.${index}.productId`, product.id);
    setValue(`items.${index}.productName`, product.name);
    setValue(`items.${index}.manufacturer`, product.manufacturer || '');
    setValue(`items.${index}.price`, product.price);
    setValue(`items.${index}.quantity`, 1);
    setValue(`items.${index}.amount`, product.price);
    setActiveDropdownIndex(null);
  };

  const handleModalProductSelect = (product: ProductForSelect) => {
    if (activeItemIndex !== null) {
      handleProductSelect(product, activeItemIndex);
    }
  };

  const renderProductNameCell = (index: number) => {
    const { onChange, onBlur, name, ref } = register(`items.${index}.productName`);
    const currentName = items[index]?.productName || '';
    const showDropdown = activeDropdownIndex === index && currentName.length > 0;
    const filteredProducts = products.filter(p =>
      p.name.toLowerCase().includes(currentName.toLowerCase())
    );

    return (
      <>
        <input
          type="text"
          name={name}
          ref={ref}
          onChange={(e) => {
            onChange(e);
            setActiveDropdownIndex(index);
          }}
          onBlur={(e) => {
            onBlur(e);
            setTimeout(() => setActiveDropdownIndex(null), 150);
          }}
          onFocus={() => setActiveDropdownIndex(index)}
          className="block w-full sm:text-sm border-gray-300 dark:border-gray-600 rounded-md p-2 border bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
          placeholder="商品名を入力"
          autoComplete="off"
        />
        {showDropdown && (
          <div className="absolute z-50 left-3 right-3 mt-1 bg-white dark:bg-gray-800 shadow-lg rounded-md border border-gray-200 dark:border-gray-700 max-h-60 overflow-auto">
            {filteredProducts.length > 0 ? (
              filteredProducts.map(product => (
                <div
                  key={product.id}
                  className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-0 transition-colors"
                  onMouseDown={(e) => {
                    e.preventDefault(); // Prevent input blur
                    handleProductSelect(product, index);
                  }}
                >
                  <div className="font-medium text-sm text-gray-900 dark:text-white">{product.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    ¥{product.price.toLocaleString()} {product.manufacturer ? `| ${product.manufacturer}` : ''}
                  </div>
                </div>
              ))
            ) : (
              <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                候補が見つかりません
              </div>
            )}
          </div>
        )}
      </>
    );
  };

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 space-y-6 transition-colors">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">基本情報</h2>

          <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">見積番号 <span className="text-red-500">*</span></label>
              <input
                type="text"
                {...register('quoteNumber')}
                className="mt-1 block w-full sm:text-sm border-gray-300 dark:border-gray-600 rounded-md p-2 border bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              />
              {errors.quoteNumber && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.quoteNumber.message}</p>}
            </div>

            <div className="sm:col-span-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">件名 <span className="text-red-500">*</span></label>
              <input
                type="text"
                {...register('subject')}
                className="mt-1 block w-full sm:text-sm border-gray-300 dark:border-gray-600 rounded-md p-2 border bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              />
              {errors.subject && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.subject.message}</p>}
            </div>

            <div className="sm:col-span-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">宛名 <span className="text-red-500">*</span></label>
              <input
                type="text"
                {...register('customerName')}
                className="mt-1 block w-full sm:text-sm border-gray-300 dark:border-gray-600 rounded-md p-2 border bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              />
              {errors.customerName && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.customerName.message}</p>}
            </div>

            <div className="sm:col-span-3"></div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">作成日 <span className="text-red-500">*</span></label>
              <input
                type="date"
                {...register('issueDate')}
                className="mt-1 block w-full sm:text-sm border-gray-300 dark:border-gray-600 rounded-md p-2 border bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              />
              {errors.issueDate && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.issueDate.message}</p>}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">有効期限</label>
              <input
                type="date"
                {...register('expiryDate')}
                className="mt-1 block w-full sm:text-sm border-gray-300 dark:border-gray-600 rounded-md p-2 border bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 space-y-6 transition-colors">
          <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-2">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">見積明細</h2>
          </div>

          {errors.items?.root && <p className="text-sm text-red-600 dark:text-red-400">{errors.items.root.message}</p>}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-10"></th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">商品名 <span className="text-red-500">*</span></th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-48">メーカー</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-32">単価 <span className="text-red-500">*</span></th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-24">数量 <span className="text-red-500">*</span></th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-32">金額</th>
                  <th className="px-3 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {fields.map((field, index) => (
                  <tr key={field.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveItemIndex(index);
                          setIsModalOpen(true);
                        }}
                        className="text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                        title="在庫から選択"
                      >
                        <Search className="w-5 h-5" />
                      </button>
                    </td>
                    <td className="px-3 py-2 relative">
                      {renderProductNameCell(index)}
                      {errors.items?.[index]?.productName && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.items[index]?.productName?.message}</p>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        {...register(`items.${index}.manufacturer`)}
                        className="block w-full sm:text-sm border-gray-300 dark:border-gray-600 rounded-md p-2 border bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        {...register(`items.${index}.price`)}
                        className="block w-full sm:text-sm border-gray-300 dark:border-gray-600 rounded-md p-2 border bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-indigo-500 focus:border-indigo-500 text-right transition-colors"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        {...register(`items.${index}.quantity`)}
                        className="block w-full sm:text-sm border-gray-300 dark:border-gray-600 rounded-md p-2 border bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-indigo-500 focus:border-indigo-500 text-right transition-colors"
                      />
                    </td>
                    <td className="px-3 py-2 text-right text-sm text-gray-900 dark:text-white">
                      ¥{items[index]?.amount?.toLocaleString() || 0}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-2">
            <button
              type="button"
              onClick={() => append({ productId: null, productName: '', manufacturer: '', price: 0, quantity: 1, amount: 0 })}
              className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:border-indigo-500 hover:text-indigo-600 dark:hover:border-indigo-400 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all flex items-center justify-center"
            >
              <Plus className="w-5 h-5 mr-2" />
              新しい行を追加
            </button>
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="w-64 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">小計</span>
                <span className="text-gray-900 dark:text-white">¥{(subtotal || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">消費税 ({TAX_RATE * 100}%)</span>
                <span className="text-gray-900 dark:text-white">¥{(tax || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-base font-bold border-t border-gray-200 dark:border-gray-700 pt-2">
                <span className="text-gray-900 dark:text-white">合計</span>
                <span className="text-gray-900 dark:text-white">¥{(total || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 space-y-4 transition-colors">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">備考</label>
          <textarea
            rows={4}
            {...register('note')}
            className="block w-full sm:text-sm border-gray-300 dark:border-gray-600 rounded-md p-2 border bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
            placeholder="見積に関する特記事項など"
          />
        </div>

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => navigate('/quotes')}
            className="bg-white dark:bg-gray-800 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? '保存中...' : '見積を保存'}
          </button>
        </div>
      </form>

      <ProductSelectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelect={handleModalProductSelect}
      />
    </>
  );
}
