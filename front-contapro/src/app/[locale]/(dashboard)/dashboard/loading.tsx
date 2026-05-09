import SankeySkeleton from "@/components/dashboard/SankeySkeleton";

export default function Loading() {
  return (
    <section className="space-y-6 max-w-[1600px] w-full mx-auto px-6 md:px-8 xl:px-12 py-6 md:py-8 lg:py-10">
      <div className="bg-white/10 backdrop-blur-2xl shadow-2xl border border-white/20 rounded-2xl overflow-hidden mt-6">
        <div className="px-8 pt-8 pb-6 border-b border-white/10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <div className="h-12 w-48 bg-white/10 rounded-lg animate-pulse" />
              <div className="h-6 w-32 bg-white/5 rounded-md animate-pulse" />
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="h-10 w-32 bg-white/10 rounded-full animate-pulse" />
              <div className="h-10 w-40 bg-white/20 rounded-full animate-pulse" />
            </div>
          </div>
        </div>

        <div className="px-8 py-8">
          <div className="flex flex-col gap-6">
            {/* Date Filter Row Skeleton */}
            <div className="flex justify-end items-center mb-2">
              <div className="flex items-center gap-3">
                <div className="h-4 w-32 bg-white/5 rounded animate-pulse" />
                <div className="h-[42px] w-[240px] bg-white/10 rounded-xl border border-white/10 animate-pulse" />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Top Cards - Skeletons */}
              <div className="lg:col-span-3 h-[400px] bg-white/5 border border-white/10 rounded-3xl p-6 animate-pulse" />
              <div className="lg:col-span-3 h-[400px] bg-white/5 border border-white/10 rounded-3xl p-6 animate-pulse" />
              <div className="lg:col-span-3 h-[400px] bg-white/5 border border-white/10 rounded-3xl p-6 animate-pulse" />
              <div className="lg:col-span-3 h-[400px] bg-white/5 border border-white/10 rounded-3xl p-6 animate-pulse" />

              {/* Main Chart - Sankey Skeleton */}
              <div className="lg:col-span-12">
                <SankeySkeleton />
              </div>

              {/* Bottom Row */}
              <div className="lg:col-span-4 h-[350px] bg-white/5 border border-white/10 rounded-3xl p-6 animate-pulse" />
              <div className="lg:col-span-4 h-[350px] bg-white/5 border border-white/10 rounded-3xl p-6 animate-pulse" />
              <div className="lg:col-span-4 h-[350px] bg-white/5 border border-white/10 rounded-3xl p-6 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
