import { Card } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, Label } from 'recharts';

interface MatchingVisualsProps {
  data: {
    status: string;
    value: number;
  }[];
}

const COLORS = ['#ef4444', '#eab308', '#22c55e'];
const RADIAN = Math.PI / 180;

const MatchingVisuals = ({ data }: MatchingVisualsProps) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, value }: any) => {
    if (value === 0) return null;
    
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    const percentage = (percent * 100).toFixed(0);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        className="text-xs md:text-sm font-medium"
      >
        {`${percentage}%`}
      </text>
    );
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-2 rounded-lg shadow-lg border border-primary-lightest">
          <p className="font-semibold text-primary-darkest">{data.status}</p>
          <p className="text-primary-dark">Count: {data.value}</p>
          <p className="text-primary-dark">
            Percentage: {((data.value / total) * 100).toFixed(1)}%
          </p>
        </div>
      );
    }
    return null;
  };

  const CustomLegend = ({ payload }: any) => {
    return (
      <div className="flex flex-wrap justify-center gap-4 mt-4">
        {payload.map((entry: any, index: number) => (
          <div key={`legend-${index}`} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-sm text-primary-darker">
              {entry.value}: {entry.payload.value}
              {entry.payload.value > 0 && 
                ` (${((entry.payload.value / total) * 100).toFixed(1)}%)`}
            </span>
          </div>
        ))}
      </div>
    );
  };

  // Calculate fixed dimensions for the pie chart
  const containerSize = Math.min(300, 400);
  const outerRadius = containerSize * 0.35;

  return (
    <Card className="p-4 md:p-6 bg-secondary-light border-primary-lighter">
      <h2 className="text-lg md:text-xl font-semibold mb-4 text-center text-primary-darkest">
        Matching Results Overview
      </h2>
      <div className="h-[300px] md:h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderCustomizedLabel}
              outerRadius={outerRadius}
              fill="#8884d8"
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
              <Label
                content={({ viewBox }) => {
                  const centerX = outerRadius;
                  const centerY = outerRadius;
                  return (
                    <text
                      x={centerX}
                      y={centerY}
                      textAnchor="middle"
                      dominantBaseline="central"
                      className="text-sm md:text-base font-medium text-primary-darkest"
                    >
                      Total: {total}
                    </text>
                  );
                }}
                position="center"
              />
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend content={<CustomLegend />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};

export default MatchingVisuals;