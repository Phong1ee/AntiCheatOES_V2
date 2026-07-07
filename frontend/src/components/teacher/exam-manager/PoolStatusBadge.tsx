import { Badge } from '../../ui/badge';
import { Shuffle, Users, Hash } from 'lucide-react';
import { Tooltip } from '../../ui/tooltip';

interface PoolConfig {
  subject: string;
  rules: {
    knowledgeDomain: string;
    difficulty: 'easy' | 'medium' | 'hard';
    count: number;
    available: number;
  }[];
  totalQuestions: number;
}

interface PoolStatusBadgeProps {
  poolConfig: PoolConfig | null;
  isPoolMode: boolean;
  compact?: boolean;
}

export function PoolStatusBadge({ poolConfig, isPoolMode, compact = false }: PoolStatusBadgeProps) {
  if (!isPoolMode || !poolConfig) {
    return null;
  }

  if (compact) {
    return (
      <Badge className="bg-gradient-to-r from-purple-500 to-pink-600 text-white">
        <Shuffle className="size-3 mr-1" />
        Pool: {poolConfig.totalQuestions}Q
      </Badge>
    );
  }

  const domainCount = new Set(poolConfig.rules.map(r => r.knowledgeDomain)).size;
  const totalAvailable = poolConfig.rules.reduce((sum, rule) => sum + rule.available, 0);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Badge className="bg-gradient-to-r from-purple-500 to-pink-600 text-white">
        <Users className="size-3 mr-1" />
        Randomized Per Student
      </Badge>
      
      <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300">
        <Hash className="size-3 mr-1" />
        {poolConfig.totalQuestions} questions drawn from {totalAvailable}
      </Badge>

      <Badge variant="outline" className="bg-pink-50 text-pink-700 border-pink-300">
        {domainCount} knowledge domain{domainCount !== 1 ? 's' : ''}
      </Badge>
    </div>
  );
}
