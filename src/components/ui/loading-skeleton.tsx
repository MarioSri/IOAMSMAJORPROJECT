import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface LoadingSkeletonProps {
  variant?: 'card' | 'list' | 'table' | 'dashboard' | 'form';
  count?: number;
  className?: string;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  variant = 'card',
  count = 3,
  className
}) => {
  const renderCardSkeleton = () => (
    <Card className="shadow-elegant">
      <CardHeader>
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-24" />
        </div>
      </CardContent>
    </Card>
  );

  const renderListSkeleton = () => (
    <div className="space-y-3">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
          <Skeleton className="w-10 h-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  );

  const renderTableSkeleton = () => (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-4 p-4 border-b">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-4" />
        ))}
      </div>
      {[...Array(count)].map((_, i) => (
        <div key={i} className="grid grid-cols-4 gap-4 p-4">
          {[...Array(4)].map((_, j) => (
            <Skeleton key={j} className="h-4" />
          ))}
        </div>
      ))}
    </div>
  );

  const renderDashboardSkeleton = () => (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <Skeleton className="w-12 h-12 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Content Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => renderCardSkeleton())}
      </div>
    </div>
  );

  const renderFormSkeleton = () => (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
      </CardHeader>
      <CardContent className="space-y-6">
        {[...Array(count)].map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
        <div className="flex gap-2 pt-4">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-20" />
        </div>
      </CardContent>
    </Card>
  );

  const renderSkeleton = () => {
    switch (variant) {
      case 'list':
        return renderListSkeleton();
      case 'table':
        return renderTableSkeleton();
      case 'dashboard':
        return renderDashboardSkeleton();
      case 'form':
        return renderFormSkeleton();
      default:
        return (
          <div className="space-y-4">
            {[...Array(count)].map((_, i) => (
              <div key={i}>{renderCardSkeleton()}</div>
            ))}
          </div>
        );
    }
  };

  return (
    <div className={cn("animate-pulse", className)}>
      {renderSkeleton()}
    </div>
  );
};

export const DashboardSkeleton: React.FC = () => (
  <LoadingSkeleton variant="dashboard" />
);

export const FormSkeleton: React.FC = () => (
  <LoadingSkeleton variant="form" />
);

export const ListSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => (
  <LoadingSkeleton variant="list" count={count} />
);

export const TableSkeleton: React.FC<{ count?: number }> = ({ count = 10 }) => (
  <LoadingSkeleton variant="table" count={count} />
);