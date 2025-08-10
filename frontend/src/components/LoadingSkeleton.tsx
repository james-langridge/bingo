export function LoadingSkeleton({ type = 'default' }: { type?: 'default' | 'board' | 'list' }) {
  if (type === 'board') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 py-8">
        <div className="container mx-auto px-4">
          <div className="h-10 bg-gray-200 rounded-lg animate-pulse mx-auto w-48 mb-6"></div>
          <div className="grid grid-cols-5 gap-2 p-4 max-w-2xl mx-auto">
            {[...Array(25)].map((_, i) => (
              <div key={i} className="aspect-square bg-gray-200 rounded-xl animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  
  if (type === 'list') {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow-md p-6">
            <div className="h-6 bg-gray-200 rounded animate-pulse mb-3"></div>
            <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
        <p className="mt-4 text-gray-600 animate-pulse">Loading...</p>
      </div>
    </div>
  );
}