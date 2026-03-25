import { useEffect, useState } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { quoteSchema, QuoteFormValues } from '../../lib/validations';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Search, Save } from 'lucide-react';
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
    resolver: zodResolver(quoteSchema) as any,
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
          className="input-base"
          placeholder="商品名を入力"
          autoComplete="off"
        />
        {showDropdown && (
          <div className="absolute z-50 left-3 right-3 mt-1 bg-white dark:bg-gray-800 shadow-xl rounded-xl border border-gray-200 dark:border-gray-700 max-h-60 overflow-auto">
            {filteredProducts.length > 0 ? (
              filteredProducts.map(product => (
                <div
                  key={product.id}
                  className="px-4 py-2.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-0 transition-colors"
                  onMouseDown={(e) => {
                    e.preventDefault();
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
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Info */}
        <div className="card p-6 sm:p-8 space-y-6">
          <h2 className="section-title">
            <span className="section-badge">1</span>
            基本情報
          </h2>

          <div className="grid grid-cols-1 gap-y-5 gap-x-6 sm:grid-cols-6">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">見積番号 <span className="text-red-500">*</span></label>
              <input
                type="text"
                {...register('quoteNumber')}
                className="input-base font-mono"
              />
              {errors.quoteNumber && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{errors.quoteNumber.message}</p>}
            </div>

            <div className="sm:col-span-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">件名 <span className="text-red-500">*</span></label>
              <input
                type="text"
                {...register('subject')}
                className="input-base"
                placeholder="見積の件名を入力"
              />
              {errors.subject && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{errors.subject.message}</p>}
            </div>

            <div className="sm:col-span-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">宛名 <span className="text-red-500">*</span></label>
              <input
                type="text"
                {...register('customerName')}
                className="input-base"
                placeholder="顧客名を入力"
              />
              {errors.customerName && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{errors.customerName.message}</p>}
            </div>

            <div className="sm:col-span-3"></div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">作成日 <span className="text-red-500">*</span></label>
              <input
                type="date"
                {...register('issueDate')}
                className="input-base"
              />
              {errors.issueDate && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{errors.issueDate.message}</p>}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">有効期限</label>
              <input
                type="date"
                {...register('expiryDate')}
                className="input-base"
              />
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="card p-6 sm:p-8 space-y-6">
          <h2 className="section-title">
            <span className="section-badge">2</span>
            見積明細
          </h2>

          {errors.items?.root && <p className="text-sm text-red-600 dark:text-red-400">{errors.items.root.message}</p>}

          <div className="overflow-x-auto -mx-6 sm:-mx-8 px-6 sm:px-8">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase w-10"></th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">商品名 <span className="text-red-500">*</span></th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase w-48">メーカー</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase w-32">単価 <span className="text-red-500">*</span></th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase w-24">数量 <span className="text-red-500">*</span></th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase w-32">金額</th>
                  <th className="px-3 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700/60">
                {fields.map((field, index) => (
                  <tr key={field.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-700/50 transition-colors group">
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveItemIndex(index);
                          setIsModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors"
                        title="在庫から選択"
                      >
                        <Search className="w-4 h-4" />
                      </button>
                    </td>
                    <td className="px-3 py-2.5 relative">
                      {renderProductNameCell(index)}
                      {errors.items?.[index]?.productName && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.items[index]?.productName?.message}</p>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="text"
                        {...register(`items.${index}.manufacturer`)}
                        className="input-base"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="number"
                        {...register(`items.${index}.price`)}
                        className="input-base text-right"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="number"
                        {...register(`items.${index}.quantity`)}
                        className="input-base text-right"
                      />
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">
                      ¥{items[index]?.amount?.toLocaleString() || 0}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
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
              className="w-full py-3 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-500 dark:text-gray-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:border-indigo-500 dark:hover:text-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              新しい行を追加
            </button>
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-gray-700">
            <div className="w-72 space-y-2.5">
              <div className="flex justify-between text-sm py-1">
                <span className="text-gray-500 dark:text-gray-400">小計</span>
                <span className="font-medium text-gray-900 dark:text-white">¥{(subtotal || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm py-1">
                <span className="text-gray-500 dark:text-gray-400">消費税 ({TAX_RATE * 100}%)</span>
                <span className="font-medium text-gray-900 dark:text-white">¥{(tax || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-base font-bold border-t border-gray-200 dark:border-gray-700 pt-3">
                <span className="text-gray-900 dark:text-white">合計</span>
                <span className="text-indigo-600 dark:text-indigo-400">¥{(total || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="card p-6 sm:p-8 space-y-4">
          <h2 className="section-title">
            <span className="section-badge">3</span>
            備考
          </h2>
          <textarea
            rows={4}
            {...register('note')}
            className="input-base resize-none"
            placeholder="見積に関する特記事項など"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/quotes')}
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
