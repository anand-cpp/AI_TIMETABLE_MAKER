import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/ui/Button';
import { Home, ArrowLeft, Sparkles } from 'lucide-react';

const NotFound = () => {
  const navigate = useNavigate();
  const { isAdmin, isTeacher, isAuthenticated } = useAuth();

  const getHomeRoute = () => {
    if (isAdmin) return '/admin';
    if (isTeacher) return '/teacher';
    return '/student';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-950 via-primary-900 to-primary-800 flex items-center justify-center p-4">
      <div className="text-center animate-fade-in">
        {/* Logo */}
        <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-8">
          <Sparkles className="w-8 h-8 text-white" />
        </div>

        {/* 404 */}
        <h1 className="text-8xl font-black text-white/20 leading-none">404</h1>
        <h2 className="text-2xl font-bold text-white mt-4">Page Not Found</h2>
        <p className="text-white/60 mt-3 max-w-sm mx-auto text-sm leading-relaxed">
          The page you're looking for doesn't exist or has been moved.
        </p>

        {/* Actions */}
        <div className="flex items-center justify-center gap-3 mt-8">
          <Button
            onClick={() => navigate(-1)}
            variant="outline"
            className="border-white/30 text-white hover:bg-white/10"
            leftIcon={<ArrowLeft className="w-4 h-4" />}
          >
            Go Back
          </Button>
          <Button
            onClick={() => navigate(getHomeRoute())}
            className="bg-white text-primary-700 hover:bg-white/90"
            leftIcon={<Home className="w-4 h-4" />}
          >
            Go Home
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;