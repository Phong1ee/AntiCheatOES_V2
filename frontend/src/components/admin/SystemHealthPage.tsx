import { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import {
  Activity,
  Server,
  Database,
  HardDrive,
  Cpu,
  Zap,
  Users,
  FileText,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';

export function SystemHealthPage() {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const systemMetrics = [
    {
      id: 1,
      name: 'Server Status',
      value: 'Online',
      status: 'healthy',
      icon: Server,
      color: 'from-green-500 to-emerald-600',
      uptime: '99.9%',
      lastChecked: '2 mins ago',
    },
    {
      id: 2,
      name: 'Database',
      value: 'Connected',
      status: 'healthy',
      icon: Database,
      color: 'from-blue-500 to-cyan-600',
      uptime: '99.8%',
      lastChecked: '1 min ago',
    },
    {
      id: 3,
      name: 'CPU Usage',
      value: '42%',
      status: 'healthy',
      icon: Cpu,
      color: 'from-purple-500 to-pink-600',
      trend: 'up',
      change: '+5%',
    },
    {
      id: 4,
      name: 'Memory Usage',
      value: '68%',
      status: 'warning',
      icon: HardDrive,
      color: 'from-amber-500 to-orange-600',
      trend: 'up',
      change: '+12%',
    },
    {
      id: 5,
      name: 'Storage',
      value: '45.2 GB',
      status: 'healthy',
      icon: HardDrive,
      color: 'from-teal-500 to-blue-600',
      total: '100 GB',
      percentage: 45,
    },
    {
      id: 6,
      name: 'API Response',
      value: '145ms',
      status: 'healthy',
      icon: Zap,
      color: 'from-yellow-500 to-amber-600',
      trend: 'down',
      change: '-8ms',
    },
  ];

  const activeServices = [
    { name: 'Web Server', status: 'running', port: 3000, requests: 1245 },
    { name: 'Database Server', status: 'running', port: 5432, connections: 48 },
    { name: 'Redis Cache', status: 'running', port: 6379, hitRate: '94%' },
    { name: 'File Storage', status: 'running', port: 9000, files: 3421 },
    { name: 'Email Service', status: 'running', port: 587, sent: 234 },
    { name: 'Backup Service', status: 'idle', port: 8080, lastBackup: '2h ago' },
  ];

  const recentAlerts = [
    {
      id: 1,
      type: 'warning',
      message: 'High memory usage detected',
      timestamp: '5 mins ago',
      resolved: false,
    },
    {
      id: 2,
      type: 'info',
      message: 'Database backup completed successfully',
      timestamp: '2 hours ago',
      resolved: true,
    },
    {
      id: 3,
      type: 'success',
      message: 'System update installed',
      timestamp: '5 hours ago',
      resolved: true,
    },
    {
      id: 4,
      type: 'info',
      message: 'SSL certificate renewed',
      timestamp: '1 day ago',
      resolved: true,
    },
  ];

  const statistics = [
    { label: 'Active Users', value: '248', icon: Users, change: '+12%' },
    { label: 'Active Exams', value: '15', icon: FileText, change: '+3%' },
    { label: 'API Calls/min', value: '342', icon: Activity, change: '-5%' },
    { label: 'Total Storage', value: '45.2GB', icon: HardDrive, change: '+2.1GB' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl text-gray-900">System Health Monitoring</h1>
            <Badge className="bg-green-100 text-green-700 border-green-300">
              All Systems Operational
            </Badge>
          </div>
          <p className="text-gray-600">
            Real-time monitoring • Last updated: {currentTime.toLocaleTimeString()}
          </p>
        </div>

        {/* Quick Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {statistics.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label} className="p-4 bg-white border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <Icon className="size-5 text-gray-500" />
                  <span
                    className={`text-xs ${
                      stat.change.startsWith('+') ? 'text-green-600' : 'text-gray-500'
                    }`}
                  >
                    {stat.change}
                  </span>
                </div>
                <div className="text-2xl text-gray-900 mb-1">{stat.value}</div>
                <div className="text-sm text-gray-600">{stat.label}</div>
              </Card>
            );
          })}
        </div>

        {/* System Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          {systemMetrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <Card
                key={metric.id}
                className="p-6 bg-white border border-gray-200 shadow-md hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div
                    className={`p-3 bg-gradient-to-br ${metric.color} rounded-lg shadow-md`}
                  >
                    <Icon className="size-6 text-white" />
                  </div>
                  <Badge
                    className={
                      metric.status === 'healthy'
                        ? 'bg-green-100 text-green-700 border-green-300'
                        : 'bg-amber-100 text-amber-700 border-amber-300'
                    }
                  >
                    {metric.status === 'healthy' ? (
                      <CheckCircle className="size-3 mr-1" />
                    ) : (
                      <AlertCircle className="size-3 mr-1" />
                    )}
                    {metric.status}
                  </Badge>
                </div>

                <h3 className="text-sm text-gray-600 mb-2">{metric.name}</h3>
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-2xl text-gray-900">{metric.value}</span>
                  {metric.trend && (
                    <span
                      className={`flex items-center text-xs ${
                        metric.trend === 'up' ? 'text-red-600' : 'text-green-600'
                      }`}
                    >
                      {metric.trend === 'up' ? (
                        <TrendingUp className="size-3 mr-1" />
                      ) : (
                        <TrendingDown className="size-3 mr-1" />
                      )}
                      {metric.change}
                    </span>
                  )}
                </div>

                {metric.uptime && (
                  <div className="text-xs text-gray-500">
                    Uptime: {metric.uptime} • {metric.lastChecked}
                  </div>
                )}

                {metric.percentage && (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>Used</span>
                      <span>{metric.total}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full bg-gradient-to-r ${metric.color}`}
                        style={{ width: `${metric.percentage}%` }}
                      />
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        {/* Active Services & Recent Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Active Services */}
          <Card className="p-6 bg-white border border-gray-200 shadow-md">
            <h2 className="text-xl text-gray-900 mb-4 flex items-center gap-2">
              <Server className="size-5 text-teal-600" />
              Active Services
            </h2>
            <div className="space-y-3">
              {activeServices.map((service) => (
                <div
                  key={service.name}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        service.status === 'running' ? 'bg-green-500' : 'bg-gray-400'
                      }`}
                    />
                    <div>
                      <div className="text-sm text-gray-900">{service.name}</div>
                      <div className="text-xs text-gray-500">Port: {service.port}</div>
                    </div>
                  </div>
                  <Badge
                    className={
                      service.status === 'running'
                        ? 'bg-green-100 text-green-700 border-green-300'
                        : 'bg-gray-100 text-gray-700 border-gray-300'
                    }
                  >
                    {service.status}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>

          {/* Recent Alerts */}
          <Card className="p-6 bg-white border border-gray-200 shadow-md">
            <h2 className="text-xl text-gray-900 mb-4 flex items-center gap-2">
              <AlertCircle className="size-5 text-orange-600" />
              Recent Alerts
            </h2>
            <div className="space-y-3">
              {recentAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-3 rounded-lg border ${
                    alert.type === 'warning'
                      ? 'bg-amber-50 border-amber-200'
                      : alert.type === 'success'
                      ? 'bg-green-50 border-green-200'
                      : 'bg-blue-50 border-blue-200'
                  }`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <span
                      className={`text-sm ${
                        alert.type === 'warning'
                          ? 'text-amber-900'
                          : alert.type === 'success'
                          ? 'text-green-900'
                          : 'text-blue-900'
                      }`}
                    >
                      {alert.message}
                    </span>
                    {alert.resolved && (
                      <CheckCircle className="size-4 text-green-600 flex-shrink-0" />
                    )}
                  </div>
                  <div className="text-xs text-gray-600">{alert.timestamp}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
