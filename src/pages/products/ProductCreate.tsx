import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { collection, addDoc, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import ProductForm from './ProductForm';
import { ProductFormValues } from '../../lib/validations';
import type { ProductGroup } from '../../types/models';

export default function ProductCreate() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<ProductGroup[]>([]);

  useEffect(() => {
    getDocs(query(collection(db, 'productGroups'), orderBy('order', 'asc')))
      .then(snap => setGroups(snap.docs.map(d => ({ id: d.id, ...d.data() })) as ProductGroup[]))
      .catch(() => {});
  }, []);

  const handleSubmit = async (data: ProductFormValues) => {
    setIsSubmitting(true);
    setError(null);
    try {
      await addDoc(collection(db, 'products'), {
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      toast.success('商品を登録しました');
      navigate('/products');
    } catch (err: any) {
      console.error("Firestore Error:", err);
      toast.error('商品の登録に失敗しました');
      setError('商品の登録に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">商品登録</h1>
      
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <ProductForm onSubmit={handleSubmit} isSubmitting={isSubmitting} groups={groups} />
    </div>
  );
}
