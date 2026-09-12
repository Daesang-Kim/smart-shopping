export default function Loading() {
  return (
    <main className="flex-1 flex justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="bg-surface rounded-2xl px-6 py-10 shadow-2xl text-center">
          <p className="text-ink font-bold mb-2">가격 정보를 불러오는 중...</p>
          <p className="text-ink-dim text-xs">
            처음 조회하는 품목은 데이터를 새로 수집하느라 몇 초 정도 걸릴 수 있어요.
          </p>
        </div>
      </div>
    </main>
  );
}
