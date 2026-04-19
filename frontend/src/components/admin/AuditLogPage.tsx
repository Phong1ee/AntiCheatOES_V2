import { useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  FileText,
  Search,
  Download,
  Filter,
  Calendar,
  User,
  Activity,
  AlertCircle,
  CheckCircle,
  Info,
  AlertTriangle,
} from 'lucide-react';

interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  userId: string;
  action: string;
  category: 'auth' | 'exam' | 'user' | 'system' | 'question';
  severity: 'low' | 'medium' | 'high' | 'critical';
  ipAddress: string;
  details: string;
  status: 'success' | 'failed' | 'warning';
}

const mockLogs: AuditLog[] = [
  {
    id: '1',
    timestamp: '2025-11-24 11:45:23',
    user: 'John Doe',
    userId: 'U001',
    action: 'Exam Submitted',
    category: 'exam',
    severity: 'low',
    ipAddress: '192.168.1.105',
    details: 'Midterm Exam - Database Systems submitted successfully',
    status: 'success',
  },
  {
    id: '2',
    timestamp: '2025-11-24 11:32:15',
    user: 'Admin User',
    userId: 'A001',
    action: 'User Created',
    category: 'user',
    severity: 'medium',
    ipAddress: '192.168.1.100',
    details: 'New student account created: jane.smith@university.edu',
    status: 'success',
  },
  {
    id: '3',
    timestamp: '2025-11-24 11:20:08',
    user: 'Robert Brown',
    userId: 'U005',
    action: 'Login Failed',
    category: 'auth',
    severity: 'high',
    ipAddress: '203.45.67.89',
    details: 'Multiple failed login attempts detected (5 attempts)',
    status: 'failed',
  },
  {
    id: '4',
    timestamp: '2025-11-24 11:15:42',
    user: 'Jane Smith',
    userId: 'T002',
    action: 'Exam Published',
    category: 'exam',
    severity: 'medium',
    ipAddress: '192.168.1.110',
    details: 'Final Exam - Data Structures published for CS201',
    status: 'success',
  },
  {
    id: '5',
    timestamp: '2025-11-24 11:05:30',
    user: 'System',
    userId: 'SYS',
    action: 'Backup Completed',
    category: 'system',
    severity: 'low',
    ipAddress: 'localhost',
    details: 'Automated database backup completed successfully',
    status: 'success',
  },
  {
    id: '6',
    timestamp: '2025-11-24 10:50:18',
    user: 'Emily Davis',
    userId: 'T006',
    action: 'Question Added',
    category: 'question',
    severity: 'low',
    ipAddress: '192.168.1.115',
    details: 'New multiple-choice question added to Database Systems bank',
    status: 'success',
  },
  {
    id: '7',
    timestamp: '2025-11-24 10:35:55',
    user: 'Michael Johnson',
    userId: 'U003',
    action: 'Exam Violation',
    category: 'exam',
    severity: 'high',
    ipAddress: '192.168.1.120',
    details: 'Tab switching detected during Quiz 3 - Normalization',
    status: 'warning',
  },
  {
    id: '8',
    timestamp: '2025-11-24 10:20:12',
    user: 'Admin User',
    userId: 'A001',
    action: 'User Suspended',
    category: 'user',
    severity: 'high',
    ipAddress: '192.168.1.100',
    details: 'User account suspended due to policy violation: robert.b@university.edu',
    status: 'success',
  },
  {
    id: '9',
    timestamp: '2025-11-24 10:05:47',
    user: 'System',
    userId: 'SYS',
    action: 'Security Alert',
    category: 'system',
    severity: 'critical',
    ipAddress: '45.67.89.123',
    details: 'Suspicious activity detected: Multiple access attempts from unknown IP',
    status: 'warning',
  },
  {
    id: '10',
    timestamp: '2025-11-24 09:45:33',
    user: 'Sarah Williams',
    userId: 'A004',
    action: 'Settings Updated',
    category: 'system',
    severity: 'medium',
    ipAddress: '192.168.1.100',
    details: 'System configuration updated: Exam duration limits modified',
    status: 'success',
  },
];

export function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>(mockLogs);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.details.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || log.category === categoryFilter;
    const matchesSeverity = severityFilter === 'all' || log.severity === severityFilter;
    const matchesStatus = statusFilter === 'all' || log.status === statusFilter;
    return matchesSearch && matchesCategory && matchesSeverity && matchesStatus;
  });

  const handleExportLogs = () => {
    const csv = [
      ['Timestamp', 'User', 'User ID', 'Action', 'Category', 'Severity', 'IP Address', 'Details', 'Status'],
      ...filteredLogs.map((log) => [
        log.timestamp,
        log.user,
        log.userId,
        log.action,
        log.category,
        log.severity,
        log.ipAddress,
        log.details,
        log.status,
      ]),
    ]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const getCategoryBadge = (category: string) => {
    const styles = {
      auth: 'bg-blue-100 text-blue-700 border-blue-300',
      exam: 'bg-purple-100 text-purple-700 border-purple-300',
      user: 'bg-teal-100 text-teal-700 border-teal-300',
      system: 'bg-gray-100 text-gray-700 border-gray-300',
      question: 'bg-green-100 text-green-700 border-green-300',
    };
    return styles[category as keyof typeof styles] || styles.system;
  };

  const getSeverityBadge = (severity: string) => {
    const styles = {
      low: 'bg-green-100 text-green-700 border-green-300',
      medium: 'bg-amber-100 text-amber-700 border-amber-300',
      high: 'bg-orange-100 text-orange-700 border-orange-300',
      critical: 'bg-red-100 text-red-700 border-red-300',
    };
    return styles[severity as keyof typeof styles] || styles.low;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="size-4 text-green-600" />;
      case 'failed':
        return <AlertCircle className="size-4 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="size-4 text-amber-600" />;
      default:
        return <Info className="size-4 text-blue-600" />;
    }
  };

  const stats = [
    {
      label: 'Total Events',
      value: logs.length,
      color: 'from-blue-500 to-cyan-600',
    },
    {
      label: 'Critical',
      value: logs.filter((l) => l.severity === 'critical').length,
      color: 'from-red-500 to-pink-600',
    },
    {
      label: 'Failed Actions',
      value: logs.filter((l) => l.status === 'failed').length,
      color: 'from-orange-500 to-red-600',
    },
    {
      label: 'Warnings',
      value: logs.filter((l) => l.status === 'warning').length,
      color: 'from-amber-500 to-orange-600',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-3xl text-gray-900 mb-2">Audit Log</h1>
          <p className="text-gray-600">Track all system activities and user actions</p>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {stats.map((stat) => (
            <Card key={stat.label} className="p-4 bg-white border border-gray-200 shadow-sm">
              <div className="text-2xl text-gray-900 mb-1">{stat.value}</div>
              <div className="text-sm text-gray-600">{stat.label}</div>
            </Card>
          ))}
        </div>

        {/* Filters Bar */}
        <Card className="p-4 bg-white border border-gray-200 shadow-sm mb-6">
          <div className="flex flex-col lg:flex-row gap-3">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
              <Input
                placeholder="Search logs by user, action, or details..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Category Filter */}
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full lg:w-40">
                <Filter className="size-4 mr-2" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="auth">Authentication</SelectItem>
                <SelectItem value="exam">Exams</SelectItem>
                <SelectItem value="user">Users</SelectItem>
                <SelectItem value="system">System</SelectItem>
                <SelectItem value="question">Questions</SelectItem>
              </SelectContent>
            </Select>

            {/* Severity Filter */}
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-full lg:w-36">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severity</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full lg:w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
              </SelectContent>
            </Select>

            {/* Export Button */}
            <Button
              onClick={handleExportLogs}
              variant="outline"
              className="gap-2"
            >
              <Download className="size-4" />
              Export
            </Button>
          </div>
        </Card>

        {/* Logs Table */}
        <Card className="bg-white border border-gray-200 shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left p-4 text-sm text-gray-700">Timestamp</th>
                  <th className="text-left p-4 text-sm text-gray-700">User</th>
                  <th className="text-left p-4 text-sm text-gray-700">Action</th>
                  <th className="text-left p-4 text-sm text-gray-700">Category</th>
                  <th className="text-left p-4 text-sm text-gray-700">Severity</th>
                  <th className="text-left p-4 text-sm text-gray-700">Details</th>
                  <th className="text-center p-4 text-sm text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4">
                      <div className="text-sm text-gray-900 flex items-center gap-2">
                        <Calendar className="size-3 text-gray-400" />
                        {log.timestamp}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm text-gray-900 flex items-center gap-2">
                        <User className="size-3 text-gray-400" />
                        {log.user}
                      </div>
                      <div className="text-xs text-gray-500">{log.ipAddress}</div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm text-gray-900 flex items-center gap-2">
                        <Activity className="size-3 text-gray-400" />
                        {log.action}
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge className={getCategoryBadge(log.category)}>{log.category}</Badge>
                    </td>
                    <td className="p-4">
                      <Badge className={getSeverityBadge(log.severity)}>{log.severity}</Badge>
                    </td>
                    <td className="p-4">
                      <div className="text-sm text-gray-700 max-w-md truncate">
                        {log.details}
                      </div>
                    </td>
                    <td className="p-4 text-center">{getStatusIcon(log.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredLogs.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <FileText className="size-12 mx-auto mb-3 text-gray-400" />
                <p>No audit logs found</p>
              </div>
            )}
          </div>
        </Card>

        {/* Results Count */}
        {filteredLogs.length > 0 && (
          <div className="mt-4 text-center text-sm text-gray-600">
            Showing {filteredLogs.length} of {logs.length} log entries
          </div>
        )}
      </main>
    </div>
  );
}
