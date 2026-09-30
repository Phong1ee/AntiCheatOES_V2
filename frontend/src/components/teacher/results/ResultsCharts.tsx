import { Bar, BarChart, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import type { ResultBreakdownItem, ScoreDistributionBucket } from '../../../types/teacher-results';

interface ResultsChartsProps {
  scoreDistribution: ScoreDistributionBucket[];
  submissionBreakdown: ResultBreakdownItem[];
  passFailBreakdown: ResultBreakdownItem[];
  finalizedScoreCount: number;
}

const submissionColors = ['#0d9488', '#f59e0b', '#94a3b8'];
const passFailColors = ['#16a34a', '#dc2626'];

function BreakdownChart({ title, data, colors }: { title: string; data: ResultBreakdownItem[]; colors: string[] }) {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  return (
    <Card className="rounded-2xl border-0 shadow-md">
      <CardHeader className="pb-0"><CardTitle className="text-base text-gray-800">{title}</CardTitle></CardHeader>
      <CardContent className="h-64 pt-3">
        {total === 0 ? <p className="flex h-full items-center justify-center text-sm text-gray-500">No data yet</p> : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="count" nameKey="label" cx="50%" cy="45%" innerRadius={48} outerRadius={78} paddingAngle={0} stroke="none">
                {data.map((item, index) => <Cell key={item.key} fill={colors[index % colors.length]} stroke="none" />)}
              </Pie>
              <Tooltip formatter={(value) => [value, 'Students']} />
              <Legend verticalAlign="bottom" height={38} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function ResultsCharts({ scoreDistribution, submissionBreakdown, passFailBreakdown, finalizedScoreCount }: ResultsChartsProps) {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <Card className="rounded-2xl border-0 shadow-md xl:col-span-2">
        <CardHeader className="pb-0"><CardTitle className="text-base text-gray-800">Score Distribution</CardTitle><p className="text-sm font-normal text-gray-500">{finalizedScoreCount} finalized student score{finalizedScoreCount === 1 ? '' : 's'}</p></CardHeader>
        <CardContent className="h-72 pt-4">
          {finalizedScoreCount === 0 ? <p className="flex h-full items-center justify-center text-sm text-gray-500">No finalized scores yet</p> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scoreDistribution} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: '#f0fdfa' }} formatter={(value) => [value, 'Students']} />
                <Bar dataKey="count" name="Students" fill="#0d9488" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
      <BreakdownChart title="Submission Status" data={submissionBreakdown} colors={submissionColors} />
      <BreakdownChart title="Pass / Not Passed" data={passFailBreakdown} colors={passFailColors} />
    </div>
  );
}
