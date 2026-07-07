import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useResponsive } from '@/hooks/useResponsive';
import { cn } from '@/lib/utils';
import {
  BarChart3,
  TrendingUp,
  PieChart,
  Activity,
  Calendar,
  Users
} from 'lucide-react';

interface ChartData {
  name: string;
  value: number;
  color?: string;
}

interface ResponsiveChartsProps {
  data: {
    documentStats: ChartData[];
    departmentStats: ChartData[];
    monthlyTrends: ChartData[];
    userActivity: ChartData[];
  };
  className?: string;
}

export const ResponsiveCharts: React.FC<ResponsiveChartsProps> = ({
  data,
  className
}) => {
  const { isMobile, isTablet } = useResponsive();

  const SimpleBarChart: React.FC<{ data: ChartData[]; title: string; icon: React.ComponentType<any> }> = ({ 
    data, 
    title, 
    icon: Icon 
  }) => {
    const maxValue = Math.max(...data.map(d => d.value));
    
    return (
      <Card className="shadow-elegant">
        <CardHeader className={cn(isMobile && "pb-3")}>
          <CardTitle className={cn(
            "flex items-center gap-2",
            isMobile ? "text-lg" : "text-xl"
          )}>
            <Icon className="w-5 h-5 text-primary" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.map((item, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className={cn(
                    "font-medium",
                    isMobile ? "text-sm" : "text-base"
                  )}>
                    {item.name}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {item.value}
                  </Badge>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className={cn(
                      "h-2 rounded-full transition-all duration-500",
                      item.color || "bg-primary"
                    )}
                    style={{ width: `${(item.value / maxValue) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  const SimplePieChart: React.FC<{ data: ChartData[]; title: string; icon: React.ComponentType<any> }> = ({ 
    data, 
    title, 
    icon: Icon 
  }) => {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    
    return (
      <Card className="shadow-elegant">
        <CardHeader className={cn(isMobile && "pb-3")}>
          <CardTitle className={cn(
            "flex items-center gap-2",
            isMobile ? "text-lg" : "text-xl"
          )}>
            <Icon className="w-5 h-5 text-primary" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {data.map((item, index) => (
                <div key={index} className="text-center">
                  <div className={cn(
                    "rounded-full mx-auto mb-2 flex items-center justify-center font-bold text-white",
                    item.color || "bg-primary",
                    isMobile ? "w-12 h-12 text-sm" : "w-16 h-16 text-lg"
                  )}>
                    {Math.round((item.value / total) * 100)}%
                  </div>
                  <p className={cn(
                    "font-medium",
                    isMobile ? "text-xs" : "text-sm"
                  )}>
                    {item.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.value} items
                  </p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const LineChart: React.FC<{ data: ChartData[]; title: string; icon: React.ComponentType<any> }> = ({ 
    data, 
    title, 
    icon: Icon 
  }) => {
    const maxValue = Math.max(...data.map(d => d.value));
    const minValue = Math.min(...data.map(d => d.value));
    
    return (
      <Card className="shadow-elegant">
        <CardHeader className={cn(isMobile && "pb-3")}>
          <CardTitle className={cn(
            "flex items-center gap-2",
            isMobile ? "text-lg" : "text-xl"
          )}>
            <Icon className="w-5 h-5 text-primary" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className={cn(
              "relative bg-muted/30 rounded-lg p-4",
              isMobile ? "h-32" : "h-40"
            )}>
              <div className="flex items-end justify-between h-full">
                {data.map((item, index) => (
                  <div key={index} className="flex flex-col items-center gap-2 flex-1">
                    <div
                      className="bg-primary rounded-t transition-all duration-500"
                      style={{
                        height: `${((item.value - minValue) / (maxValue - minValue)) * 80 + 20}%`,
                        width: isMobile ? '16px' : '24px'
                      }}
                    />
                    <span className={cn(
                      "font-medium",
                      isMobile ? "text-xs" : "text-sm"
                    )}>
                      {item.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className={cn(
      "space-y-6",
      className
    )}>
      <div className={cn(
        "grid gap-6",
        isMobile ? "grid-cols-1" : isTablet ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-2"
      )}>
        <SimpleBarChart
          data={data.documentStats}
          title="Document Status"
          icon={BarChart3}
        />
        
        <SimplePieChart
          data={data.departmentStats}
          title="Department Distribution"
          icon={PieChart}
        />
      </div>

      <div className={cn(
        "grid gap-6",
        isMobile ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2"
      )}>
        <LineChart
          data={data.monthlyTrends}
          title="Monthly Trends"
          icon={TrendingUp}
        />
        
        <SimpleBarChart
          data={data.userActivity}
          title="User Activity"
          icon={Users}
        />
      </div>
    </div>
  );
};