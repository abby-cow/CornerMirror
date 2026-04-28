export default function InsightsPage() {
  return (
    <main className="min-h-screen bg-[#f7f4ff] px-4 py-8 text-zinc-950">
      <div className="mx-auto w-full max-w-sm">
        <div className="rounded-[24px] bg-white p-5 shadow-sm">
          <h1 className="text-xl font-semibold">练习记录分析</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            这里后续会放：月度练习次数、连续打卡、舞种分布、练习时长趋势等。
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-[#f3efff] p-4">
              <div className="text-xs text-zinc-600">本月打卡</div>
              <div className="mt-1 text-2xl font-semibold">12</div>
            </div>
            <div className="rounded-2xl bg-[#fff4ea] p-4">
              <div className="text-xs text-zinc-600">累计时长</div>
              <div className="mt-1 text-2xl font-semibold">18h</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

