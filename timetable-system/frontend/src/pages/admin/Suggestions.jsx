import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import SuggestionList from '../../components/suggestions/SuggestionList';
import suggestionService from '../../services/suggestionService';
import { CheckCheck, MessageSquare } from 'lucide-react';
import { cn } from '../../utils/cn';

const Suggestions = () => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [markAllLoading, setMarkAllLoading] = useState(false);
  const [filter, setFilter] = useState('all');

  const load = async () => {
    try {
      setLoading(true);
      const params = filter === 'unread'
        ? { isRead: false }
        : filter === 'read'
        ? { isRead: true }
        : {};
      const res = await suggestionService.getAll(params);
      setSuggestions(res.data.suggestions || []);
    } catch {
      toast.error('Failed to load suggestions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filter]);

  const handleMarkRead = async (id) => {
    try {
      await suggestionService.markAsRead(id);
      setSuggestions((prev) =>
        prev.map((s) =>
          s._id === id ? { ...s, isRead: true, readAt: new Date() } : s
        )
      );
      toast.success('Marked as read');
    } catch {
      toast.error('Failed to mark as read');
    }
  };

  const handleMarkAll = async () => {
    try {
      setMarkAllLoading(true);
      const res = await suggestionService.markAllAsRead();
      toast.success(`${res.data.modifiedCount} suggestion(s) marked as read`);
      load();
    } catch {
      toast.error('Failed to mark all as read');
    } finally {
      setMarkAllLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleteLoading(true);
      await suggestionService.delete(deleteTarget._id);
      toast.success('Suggestion deleted');
      setDeleteTarget(null);
      load();
    } catch {
      toast.error('Failed to delete suggestion');
    } finally {
      setDeleteLoading(false);
    }
  };

  const unreadCount = suggestions.filter((s) => !s.isRead).length;

  return (
    <div>
      <PageHeader
        title="Suggestions"
        description="Teacher feedback and suggestions"
        action={
          unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAll}
              loading={markAllLoading}
              leftIcon={<CheckCheck className="w-4 h-4" />}
            >
              Mark All Read ({unreadCount})
            </Button>
          )
        }
      />

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {[
          { value: 'all', label: 'All' },
          { value: 'unread', label: 'Unread' },
          { value: 'read', label: 'Read' },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={cn(
              'px-4 py-1.5 rounded-full text-sm font-medium transition-all',
              filter === tab.value
                ? 'bg-primary-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
            )}
          >
            {tab.label}
            {tab.value === 'unread' && unreadCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-white/20 rounded-full">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="card p-5">
        {loading ? (
          <div className="py-8 text-center text-gray-400 text-sm">
            Loading suggestions...
          </div>
        ) : (
          <SuggestionList
            suggestions={suggestions}
            isAdmin
            onMarkRead={handleMarkRead}
            onDelete={setDeleteTarget}
          />
        )}
      </div>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleteLoading}
        title="Delete Suggestion"
        message="Delete this suggestion permanently?"
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
};

export default Suggestions;