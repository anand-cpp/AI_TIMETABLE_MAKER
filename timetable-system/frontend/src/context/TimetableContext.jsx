import { createContext, useContext, useState, useCallback } from 'react';
import timetableService from '../services/timetableService';
import toast from 'react-hot-toast';

const TimetableContext = createContext(null);

export const TimetableProvider = ({ children }) => {
  const [versions, setVersions] = useState([]);
  const [activeVersion, setActiveVersion] = useState(null);
  const [acceptedTimetable, setAcceptedTimetable] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(false);

  // ── Load all versions ──────────────────────────────────────────────────────
  const loadVersions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await timetableService.getVersions();
      setVersions(res.data.versions || []);
    } catch (err) {
      toast.error('Failed to load timetable versions');
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Load single version ────────────────────────────────────────────────────
  const loadVersion = useCallback(async (id) => {
    try {
      setLoading(true);
      const res = await timetableService.getVersion(id);
      setActiveVersion(res.data.timetable);
      return res.data.timetable;
    } catch (err) {
      toast.error('Failed to load timetable version');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Load accepted timetable ────────────────────────────────────────────────
  const loadAccepted = useCallback(async () => {
    try {
      const res = await timetableService.getAccepted();
      setAcceptedTimetable(res.data.timetable);
      return res.data.timetable;
    } catch {
      setAcceptedTimetable(null);
      return null;
    }
  }, []);

  // ── Generate timetable ─────────────────────────────────────────────────────
  const generate = useCallback(async (options = {}) => {
    try {
      setGenerating(true);
      const res = await timetableService.generate(options);
      await loadVersions();
      toast.success(`Timetable generated! Quality: ${res.data.timetable?.qualityScore?.overall || 0}/100`);
      return res;
    } catch (err) {
      const msg = err.response?.data?.message || 'Generation failed';
      toast.error(msg);
      throw err;
    } finally {
      setGenerating(false);
    }
  }, [loadVersions]);

  // ── Accept version ─────────────────────────────────────────────────────────
  const acceptVersion = useCallback(async (id) => {
    try {
      await timetableService.acceptVersion(id);
      await loadVersions();
      await loadAccepted();
      toast.success('Timetable accepted as official');
    } catch (err) {
      toast.error('Failed to accept timetable');
      throw err;
    }
  }, [loadVersions, loadAccepted]);

  // ── Delete version ─────────────────────────────────────────────────────────
  const deleteVersion = useCallback(async (id) => {
    try {
      await timetableService.deleteVersion(id);
      await loadVersions();
      if (activeVersion?._id === id) setActiveVersion(null);
      toast.success('Version deleted');
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to delete version';
      toast.error(msg);
      throw err;
    }
  }, [loadVersions, activeVersion]);

  const value = {
    versions,
    activeVersion,
    acceptedTimetable,
    generating,
    loading,
    setActiveVersion,
    loadVersions,
    loadVersion,
    loadAccepted,
    generate,
    acceptVersion,
    deleteVersion,
  };

  return (
    <TimetableContext.Provider value={value}>
      {children}
    </TimetableContext.Provider>
  );
};

export const useTimetable = () => {
  const context = useContext(TimetableContext);
  if (!context) {
    throw new Error('useTimetable must be used within TimetableProvider');
  }
  return context;
};

export default TimetableContext;