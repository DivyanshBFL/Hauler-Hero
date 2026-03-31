import { memo } from "react";

const MappingSkeleton = () => {
  return (
    <div className="w-full px-6 py-4 space-y-2 select-none pointer-events-none">
      {Array.from({ length: 14 }).map((_, i) => (
        <div key={i} className="grid grid-cols-[1fr_auto_1fr] gap-[5rem] items-center">
          {/* Source Skeleton Box */}
          <div className="flex items-center h-[30px] px-3 rounded-md border border-[#00000010] bg-slate-50/40 animate-pulse relative">
            <div className="h-2 w-24 bg-slate-200/60 rounded" />
            <div className="ml-auto h-4 w-12 bg-slate-100/60 rounded" />
            <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-[#00000005] bg-white" />
          </div>

          {/* Edge Space Placeholder */}
          <div className="w-8 flex justify-center">
             <div className="w-full h-[1px] bg-slate-100/30" />
          </div>

          {/* Target Skeleton Box */}
          <div className="flex items-center h-[30px] px-3 rounded-lg border border-[#00000010] bg-slate-50/40 animate-pulse relative">
            <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-[#00000005] bg-white" />
            <div className="h-2 w-32 bg-slate-200/60 rounded" />
            <div className="ml-auto h-4 w-12 bg-slate-100/60 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
};

export default memo(MappingSkeleton);
