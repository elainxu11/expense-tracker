export default function Dashboard() {
  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-bold text-slate-900">Dashboard</h1>
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border-2 border-blue-200 shadow">
          <p className="text-sm font-semibold text-blue-900 mb-2">Total Spent (This Month)</p>
          <p className="text-4xl font-bold text-blue-900">--</p>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border-2 border-green-200 shadow">
          <p className="text-sm font-semibold text-green-900 mb-2">Income (This Month)</p>
          <p className="text-4xl font-bold text-green-900">--</p>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6 border-2 border-purple-200 shadow">
          <p className="text-sm font-semibold text-purple-900 mb-2">Net</p>
          <p className="text-4xl font-bold text-purple-900">--</p>
        </div>
      </div>
      <p className="text-slate-700 text-lg">Start by uploading a credit card statement to see your spending breakdown.</p>
    </div>
  );
}
