import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { doc, getDoc, updateDoc, collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import ProductForm from './ProductForm';
import { ProductFormValues } from '../../lib/validations';
import Spinner from '../../components/Spinner';
import type { ProductGroup } from '../../types/models';

export default function ProductEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialData, setInitialData] = useState<Partial<ProductFormValues> | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [groups, setGroups] = useState<ProductGroup[]>([]);

  useEffect(() => {
    getDocs(query(collection(db, 'productGroups'), orderBy('order', 'asc')))
      .then(snap => setGroups(snap.docs.map(d => ({ id: d.id, ...d.data() })) as ProductGroup[]))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, 'products', id);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) throw new Error('商品の取得に失敗しました');
        const data = docSnap.data();
        setCreatedAt(data.createdAt);
        // Null values from DB should be converted to empty strings for the form
        setInitialData({
          code: data.code || '',
          name: data.name,
          manufacturer: data.manufacturer || '',
          price: data.price,
          stock: data.stock,
          unit: data.unit || '',
          note: data.note || '',
          tags: data.tags || [],
          groupId: data.groupId || '',
        });
      } catch (err: any) {
        console.error("Firestore Error:", err);
        toast.error('商品の取得に失敗しました');
        setError('商品の取得に失敗しました');
      }
    };
    fetchProduct();
  }, [id]);

  const handleSubmit = async (data: ProductFormValues) => {
    if (!id) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const docRef = doc(db, 'products', id);
      await updateDoc(docRef, {
        ...data,
        createdAt: createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      toast.success('商品を更新しました');
      navigate('/products');
    } catch (err: any) {
      console.error("Firestore Error:", err);
      toast.error('商品の更新に失敗しました');
      setError('商品の更新に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (error && !initialData) {
    return <div className="text-red-600">{error}</div>;
  }

  if (!initialData) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">商品編集</h1>
      
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <ProductForm defaultValues={initialData} onSubmit={handleSubmit} isSubmitting={isSubmitting} groups={groups} />
    </div>
  );
}
