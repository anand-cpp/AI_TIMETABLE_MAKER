import React, { useState, useEffect } from 'react';
import { ShieldCheck, Zap, RotateCcw, Search, Filter, Clock, User, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';
import overrideService from '../../services/overrideService';
import toast from 'react-hot-toast';

const OverrideLog = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await overrideService.getLogs();
      if (res.success) {
        setLogs(res.data.logs || []);
      }
    } catch (err) {
      console.error('Failed to fetch override logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleRevert = async (id) => {
    try {
      const res = await overrideService.revertLog(id);
      if (res.success) {
        setLogs((prev) =>
          prev.map((log) => (log._id === id ? { ...log, status: 'REVERTED' } : log))
        );
      }
    } catch (err) {
      console.error('Failed to revert override:', err);
    }
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      (log.teacherName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.subjectName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.className || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.issueDescription || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.selectedOption || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || log.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalCount = logs.length;
  const approvedCount = logs.filter((l) => l.status === 'APPROVED').length;
  const revertedCount = logs.filter((l) => l.status === 'REVERTED').length;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-main flex items-center gap-2.5">
            <ShieldCheck className="w-7 h-7 text-accent" />
            <span>Manual Overrides Log</span>
          </h1>
          <p className="text-sm text-muted mt-1">
            Complete audit trail of all admin permission requests, constraint waivers, and schedule overrides
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-surface-alt border border-theme hover:bg-hover text-main transition-colors flex items-center gap-2 w-fit"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Refresh Logs</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-surface border border-theme shadow-sm">
          <div className="text-xs font-medium text-muted uppercase">Total Requests Recorded</div>
          <div className="text-2xl font-bold text-main mt-1 flex items-center gap-2">
            <span>{totalCount}</span>
            <FileText className="w-5 h-5 text-muted" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-surface border border-theme shadow-sm">
          <div className="text-xs font-medium text-muted uppercase">Approved Overrides</div>
          <div className="text-2xl font-bold text-accent mt-1 flex items-center gap-2">
            <span>{approvedCount}</span>
            <Zap className="w-5 h-5 text-accent" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-surface border border-theme shadow-sm">
          <div className="text-xs font-medium text-muted uppercase">Reverted Overrides</div>
          <div className="text-2xl font-bold text-muted mt-1 flex items-center gap-2">
            <span>{revertedCount}</span>
            <RotateCcw className="w-5 h-5 text-muted" />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 rounded-xl bg-surface border border-theme flex flex-col md:flex-row items-center justify-between gap-3 shadow-sm">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by teacher, subject, or issue..."
            className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-theme bg-surface-alt text-main focus:outline-none focus:border-accent"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <Filter className="w-4 h-4 text-muted" />
          <span className="text-xs font-medium text-muted">Status:</span>
          {['ALL', 'APPROVED', 'REVERTED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                statusFilter === st
                  ? 'bg-accent text-white'
                  : 'bg-surface-alt hover:bg-hover text-muted'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-surface border border-theme rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-muted text-sm flex items-center justify-center gap-2">
            <Clock className="w-5 h-5 animate-spin text-accent" />
            <span>Loading override logs...</span>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-muted text-sm space-y-2">
            <AlertCircle className="w-8 h-8 text-muted mx-auto" />
            <p className="font-semibold text-main">No override logs found</p>
            <p className="text-xs text-muted">Generated timetable permission requests and manual overrides will appear here</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-alt/70 text-muted uppercase tracking-wider border-b border-theme">
                <tr>
                  <th className="p-3.5">Timestamp & Admin</th>
                  <th className="p-3.5">Type & Target</th>
                  <th className="p-3.5">Issue Description</th>
                  <th className="p-3.5">Approved Option / Impact</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme/60">
                {filteredLogs.map((log) => (
                  <tr key={log._id} className="hover:bg-hover/50 transition-colors">
                    <td className="p-3.5">
                      <div className="font-semibold text-main">
                        {new Date(log.createdAt || log.appliedAt).toLocaleString()}
                      </div>
                      <div className="text-[11px] text-muted flex items-center gap-1 mt-0.5">
                        <User className="w-3 h-3 text-accent" />
                        <span>{log.approvedBy || 'Admin'}</span>
                      </div>
                    </td>

                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded-md bg-accent/10 text-accent font-mono text-[10px] font-bold uppercase">
                        {log.requestType}
                      </span>
                      <div className="font-semibold text-main mt-1">{log.teacherName || log.subjectName}</div>
                      <div className="text-[11px] text-muted">{log.className}</div>
                    </td>

                    <td className="p-3.5 max-w-xs text-muted">
                      <p className="line-clamp-2 leading-relaxed">{log.issueDescription}</p>
                    </td>

                    <td className="p-3.5 max-w-xs">
                      <div className="font-medium text-main">{log.selectedOption}</div>
                      {log.impact && <div className="text-[11px] text-muted mt-0.5">{log.impact}</div>}
                    </td>

                    <td className="p-3.5">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase flex items-center gap-1 w-fit ${
                          log.status === 'APPROVED'
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : 'bg-muted/10 text-muted'
                        }`}
                      >
                        {log.status === 'APPROVED' && <CheckCircle2 className="w-3 h-3" />}
                        <span>{log.status}</span>
                      </span>
                    </td>

                    <td className="p-3.5 text-right">
                      {log.status === 'APPROVED' ? (
                        <button
                          onClick={() => handleRevert(log._id)}
                          className="px-3 py-1.5 rounded-lg border border-theme text-muted hover:text-danger hover:border-danger/40 hover:bg-danger/5 transition-colors font-medium text-[11px]"
                        >
                          Revert
                        </button>
                      ) : (
                        <span className="text-muted text-[11px]">Reverted</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default OverrideLog;
