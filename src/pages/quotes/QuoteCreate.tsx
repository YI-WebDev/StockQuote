import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import QuoteForm from './QuoteForm';
import { QuoteFormValues } from '../../lib/validations';

export default function QuoteCreate() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (data: QuoteFormValues) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const docRef = await addDoc(collection(db, 'quotes'), {
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      toast.success('見積を作成しました');
      navigate(`/quotes/${docRef.id}`);
    } catch (err: any) {
      console.error("Firestore Error:", err);
      toast.error('見積の作成に失敗しました');
      setError('見積の作成に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">見積作成</h1>
      
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-400 p-4">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      <QuoteForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
    </div>
  );
}
