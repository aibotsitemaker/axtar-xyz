export function CardSkeleton() {
  return (
    <div className="card p-5 animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-2xl bg-gray-100 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 bg-gray-100 rounded-full w-3/4" />
          <div className="h-3 bg-gray-100 rounded-full w-1/2" />
          <div className="h-3 bg-gray-100 rounded-full w-1/3" />
        </div>
      </div>
      <div className="space-y-2 mb-4">
        <div className="h-3 bg-gray-100 rounded-full w-full" />
        <div className="h-3 bg-gray-100 rounded-full w-5/6" />
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-gray-50">
        <div className="h-3 bg-gray-100 rounded-full w-1/3" />
        <div className="h-8 bg-gray-100 rounded-xl w-20" />
      </div>
    </div>
  )
}

export function ElanSkeleton() {
  return (
    <div className="card p-5 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="h-5 bg-gray-100 rounded-full w-20" />
        <div className="h-3 bg-gray-100 rounded-full w-10" />
      </div>
      <div className="h-4 bg-gray-100 rounded-full w-3/4 mb-2" />
      <div className="space-y-2 mb-4">
        <div className="h-3 bg-gray-100 rounded-full w-full" />
        <div className="h-3 bg-gray-100 rounded-full w-4/5" />
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-gray-50">
        <div className="h-3 bg-gray-100 rounded-full w-1/3" />
        <div className="h-8 bg-gray-100 rounded-xl w-24" />
      </div>
    </div>
  )
}

export function ProfileSkeleton() {
  return (
    <div className="card p-6 animate-pulse">
      <div className="flex items-start gap-4 mb-4">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-5 bg-gray-100 rounded-full w-1/2" />
          <div className="h-3 bg-gray-100 rounded-full w-1/3" />
          <div className="h-4 bg-gray-100 rounded-full w-1/4" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-gray-100 rounded-full w-full" />
        <div className="h-3 bg-gray-100 rounded-full w-5/6" />
        <div className="h-3 bg-gray-100 rounded-full w-4/6" />
      </div>
    </div>
  )
}

export function GridSkeleton({ count = 6, Component = CardSkeleton }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => <Component key={i} />)}
    </div>
  )
}
