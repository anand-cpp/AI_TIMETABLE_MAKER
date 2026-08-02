import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import SuggestionForm from '../../components/suggestions/SuggestionForm';
import SuggestionList from '../../components/suggestions/SuggestionList';
import suggestionService from '../../services/suggestionService';
import { MessageSquare } from 'lucide-react';

const MySuggestions = () => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const res = await suggestionService.getMine();
      setSuggestions(res.data.suggestions || []);
    } catch {
      toast.error('Failed to load suggestions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (message) => {
    try {
      setSubmitLoading(true);
      await suggestionService.create(message);
      toast.success('Suggestion submitted successfully!');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit suggestion');
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="My Suggestions"
        description="Share your feedback about the timetable with the admin"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Submit form */}
        <div className="lg:col-span-1">
          <Card>
            <Card.Header>
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary-600" />
                <Card.Title>New Suggestion</Card.Title>
              </div>
              <Card.Description>
                Share feedback about scheduling, timing preferences, or any concerns.
                The admin will review your suggestions.
              </Card.Description>
            </Card.Header>
            <Card.Content>
              <SuggestionForm
                onSubmit={handleSubmit}
                loading={submitLoading}
              />
            </Card.Content>
          </Card>
        </div>

        {/* My past suggestions */}
        <div className="lg:col-span-2">
          <Card>
            <Card.Header>
              <Card.Title>
                My Submitted Suggestions
                {suggestions.length > 0 && (
                  <span className="ml-2 text-sm text-gray-400 font-normal">
                    ({suggestions.length})
                  </span>
                )}
              </Card.Title>
              <Card.Description>
                Your previously submitted feedback
              </Card.Description>
            </Card.Header>
            <Card.Content>
              {loading ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  Loading...
                </div>
              ) : (
                <SuggestionList
                  suggestions={suggestions}
                  isAdmin={false}
                />
              )}
            </Card.Content>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default MySuggestions;