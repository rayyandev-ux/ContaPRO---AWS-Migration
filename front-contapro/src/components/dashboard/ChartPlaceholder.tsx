import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ChartPlaceholder() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm text-gray-600">Total Visitors</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">Last 3 months</Button>
            <Button variant="outline" size="sm">Last 30 days</Button>
            <Button variant="outline" size="sm">Last 7 days</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-48 w-full">
          <svg viewBox="0 0 600 200" className="h-full w-full">
            <defs>
              <linearGradient id="grad" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#9CA3AF" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#9CA3AF" stopOpacity="0.1" />
              </linearGradient>
            </defs>
            <path d="M0 150 C 60 120, 120 170, 180 130 S 300 170, 360 140 S 480 180, 540 150 L 600 200 L 0 200 Z" fill="url(#grad)" />
            <path d="M0 150 C 60 120, 120 170, 180 130 S 300 170, 360 140 S 480 180, 540 150" stroke="#6B7280" strokeWidth="2" fill="none" />
          </svg>
        </div>
        <div className="mt-3 flex gap-2 flex-wrap">
          {[
            "Outline",
            "Past Performance",
            "Key Personnel",
            "Focus Documents",
          ].map((label) => (
            <Button key={label} variant="ghost" size="sm" className="border rounded-md">
              {label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}