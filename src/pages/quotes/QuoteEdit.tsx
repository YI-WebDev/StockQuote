import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import QuoteForm from './QuoteForm';
import { QuoteFormValues } from '../../lib/validations';
import Spinner from '../../components/Spinner';

export default function QuoteEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialData, setInitialData] = useState<Partial<QuoteFormValues> | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);

  useEffect(() => {
    const fetchQuote = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, 'quotes', id);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) throw new Error('見積の取得に失敗しました');
        const data = docSnap.data();
        setCreatedAt(data.createdAt);
        
        setInitialData({
          quoteNumber: data.quoteNumber,
          subject: data.subject,
          customerName: data.customerName,
          issueDate: new Date(data.issueDate).toISOString().split('T')[0],
          expiryDate: data.expiryDate ? new Date(data.expiryDate).toISOString().split('T')[0] : '',
          note: data.note || '',
          subtotal: data.subtotal,
          tax: data.tax,
          total: data.total,
          items: data.items.map((item: any) => ({
            productId: item.productId,
            productName: item.productName,
            manufacturer: item.manufacturer || '',
            price: item.price,
            quantity: item.quantity,
            amount: item.amount,
          })),
        });
      } catch (err: any) {
        console.error("Firestore Error:", err);
        toast.error('見積の取得に失敗しました');
        setError('見積の取得に失敗しました');
      }
    };
    fetchQuote();
  }, [id]);

  const handleSubmit = async (data: QuoteFormValues) => {
    if (!id) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const docRef = doc(db, 'quotes', id);
      await updateDoc(docRef, {
        ...data,
        createdAt: createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      toast.success('見積を更新しました');
      navigate(`/quotes/${id}`);
    } catch (err: any) {
      console.error("Firestore Error:", err);
      toast.error('見積の更新に失敗しました');
      setError('見積の更新に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (error && !initialData) {
    return <div className="text-red-600 dark:text-red-400">{error}</div>;
  }

  if (!initialData) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">見積編集</h1>
      
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-400 p-4">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      <QuoteForm defaultValues={initialData} onSubmit={handleSubmit} isSubmitting={isSubmitting} />
    </div>
  );
}
