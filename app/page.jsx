import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="text-center space-y-8">
        <h1 className="font-display text-4xl font-bold text-gold-700 sm:text-5xl">
          축의금 접수
        </h1>
        <p className="text-gold-500 text-lg">
          결혼식 축의금을 간편하게 접수하고 관리하세요
        </p>
        <Link
          href="/create"
          className="inline-block rounded-lg bg-gold-600 px-8 py-3 text-lg font-semibold text-white shadow-md transition-colors hover:bg-gold-700"
        >
          새 결혼식 만들기
        </Link>
      </div>
    </main>
  );
}
