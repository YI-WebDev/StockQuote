import { useState, useEffect } from 'react';
import { X, Plus, Pencil, Trash2, Check, GripVertical } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDocs, where, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'react-hot-toast';
import type { ProductGroup } from '../types/models';

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export default function GroupManageModal({ isOpen, onClose }: Props) {
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const q = query(collection(db, 'productGroups'), orderBy('order', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setGroups(snap.docs.map(d => ({ id: d.id, ...d.data() })) as ProductGroup[]);
    });
    return () => unsub();
  }, [isOpen]);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    if (groups.some(g => g.name === name)) {
      toast.error('同じ名前のグループが既に存在します');
      return;
    }
    try {
      await addDoc(collection(db, 'productGroups'), {
        name,
        order: groups.length,
        createdAt: new Date().toISOString(),
      });
      setNewName('');
      toast.success('グループを作成しました');
    } catch {
      toast.error('グループの作成に失敗しました');
    }
  };

  const handleUpdate = async (id: string) => {
    const name = editingName.trim();
    if (!name) return;
    if (groups.some(g => g.name === name && g.id !== id)) {
      toast.error('同じ名前のグループが既に存在します');
      return;
    }
    try {
      await updateDoc(doc(db, 'productGroups', id), { name });
      setEditingId(null);
      toast.success('グループ名を更新しました');
    } catch {
      toast.error('グループ名の更新に失敗しました');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      // Unset groupId on all products in this group
      const productsSnap = await getDocs(query(collection(db, 'products'), where('groupId', '==', id)));
      if (productsSnap.size > 0) {
        const batch = writeBatch(db);
        productsSnap.docs.forEach(d => batch.update(d.ref, { groupId: '' }));
        await batch.commit();
      }
      await deleteDoc(doc(db, 'productGroups', id));
      setDeletingId(null);
      toast.success('グループを削除しました');
    } catch {
      toast.error('グループの削除に失敗しました');
    }
  };

  const moveGroup = async (index: number, direction: 'up' | 'down') => {
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= groups.length) return;
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'productGroups', groups[index].id), { order: swapIndex });
      batch.update(doc(db, 'productGroups', groups[swapIndex].id), { order: index });
      await batch.commit();
    } catch {
      toast.error('並び替えに失敗しました');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">グループ管理</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Create new group */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="新しいグループ名"
              className="input-base flex-1"
            />
            <button
              onClick={handleCreate}
              disabled={!newName.trim()}
              className="btn-primary px-3 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Group list */}
        <div className="max-h-80 overflow-y-auto">
          {groups.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">グループがありません</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">上のフォームから作成してください</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700/60">
              {groups.map((group, index) => (
                <li key={group.id} className="flex items-center gap-2 px-4 py-3 group hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                  {/* Reorder buttons */}
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button
                      onClick={() => moveGroup(index, 'up')}
                      disabled={index === 0}
                      className="p-0.5 text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 disabled:opacity-30 disabled:cursor-default transition-colors"
                      title="上に移動"
                    >
                      <GripVertical className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {editingId === group.id ? (
                    <div className="flex-1 flex items-center gap-2">
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleUpdate(group.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        className="input-base flex-1 text-sm py-1.5"
                        autoFocus
                      />
                      <button
                        onClick={() => handleUpdate(group.id)}
                        className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : deletingId === group.id ? (
                    <div className="flex-1 flex items-center justify-between">
                      <span className="text-sm text-red-600 dark:text-red-400">
                        「{group.name}」を削除しますか？
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(group.id)}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium text-white bg-red-600 hover:bg-red-700 transition-colors"
                        >
                          削除
                        </button>
                        <button
                          onClick={() => setDeletingId(null)}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span className="flex-1 text-sm font-medium text-gray-900 dark:text-white truncate">
                        {group.name}
                      </span>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setEditingId(group.id);
                            setEditingName(group.name);
                          }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          title="名前変更"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeletingId(group.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          title="削除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
