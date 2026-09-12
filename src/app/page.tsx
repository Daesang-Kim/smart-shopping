import ItemBrowser from "@/components/ItemBrowser";

export default function HomePage() {
  return (
    <main className="flex-1 flex justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <p className="text-surface/70 text-xs tracking-wide mb-3 px-1">
          오늘 이 가격, 싼 걸까?
        </p>
        <ItemBrowser />
      </div>
    </main>
  );
}
