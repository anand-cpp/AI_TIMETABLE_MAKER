import { useState } from 'react';
import Button from '../ui/Button';
import { MessageSquare } from 'lucide-react';

const SuggestionForm = ({ onSubmit, loading }) => {
  const [message, setMessage] = useState('');
  const minLen = 10;
  const maxLen = 1000;
  const remaining = maxLen - message.length;
  const isValid = message.trim().length >= minLen;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isValid) return;
    onSubmit(message.trim());
    setMessage('');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="form-group">
        <label className="form-label">
          Your Suggestion <span className="text-red-500">*</span>
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          maxLength={maxLen}
          placeholder="Share your feedback about the timetable, scheduling preferences, or any concerns..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
        />
        <div className="flex items-center justify-between mt-1">
          <span className={`text-xs ${message.trim().length < minLen && message.length > 0 ? 'text-red-500' : 'text-gray-400'}`}>
            {message.trim().length < minLen
              ? `${minLen - message.trim().length} more characters needed`
              : 'Good length'}
          </span>
          <span className={`text-xs ${remaining < 100 ? 'text-orange-500' : 'text-gray-400'}`}>
            {remaining} remaining
          </span>
        </div>
      </div>

      <Button
        type="submit"
        loading={loading}
        disabled={!isValid}
        leftIcon={<MessageSquare className="w-4 h-4" />}
      >
        Submit Suggestion
      </Button>
    </form>
  );
};

export default SuggestionForm;