import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Toaster, toast } from 'sonner'

const CONTRACT = '0x75787a83F7742b109e5BF723cA9d369CB1DA411B'

type FlightStatus = 'ON TIME' | 'DELAYED' | 'BOARDING' | 'PAID OUT' | 'CANCELLED'

type Flight = {
  code: string
  airline: string
  route: string
  gate: string
  sched: string
  est: string
  status: FlightStatus
  premium: string
  payout: string
  delayMin: number
}

const INITIAL_BOARD: Flight[] = [
  { code: 'BA 247', airline: 'BRITISH AIRWAYS', route: 'LHR — JFK', gate: 'A12', sched: '08:40', est: '08:40', status: 'ON TIME', premium: '0.05', payout: '0.40', delayMin: 0 },
  { code: 'LH 401', airline: 'LUFTHANSA', route: 'FRA — IAD', gate: 'B07', sched: '10:15', est: '12:55', status: 'DELAYED', premium: '0.06', payout: '0.42', delayMin: 160 },
  { code: 'AF 118', airline: 'AIR FRANCE', route: 'CDG — SFO', gate: 'C21', sched: '11:05', est: '11:05', status: 'BOARDING', premium: '0.05', payout: '0.38', delayMin: 0 },
  { code: 'EK 203', airline: 'EMIRATES', route: 'DXB — JFK', gate: 'D04', sched: '13:30', est: '17:10', status: 'PAID OUT', premium: '0.08', payout: '0.88', delayMin: 220 },
  { code: 'SQ 322', airline: 'SINGAPORE', route: 'SIN — LHR', gate: 'A02', sched: '14:20', est: '14:20', status: 'ON TIME', premium: '0.07', payout: '0.50', delayMin: 0 },
  { code: 'UA 930', airline: 'UNITED', route: 'SFO — LHR', gate: 'E15', sched: '16:45', est: '19:20', status: 'DELAYED', premium: '0.06', payout: '0.55', delayMin: 155 },
  { code: 'QF 009', airline: 'QANTAS', route: 'PER — LHR', gate: 'F30', sched: '18:10', est: '18:10', status: 'ON TIME', premium: '0.09', payout: '0.60', delayMin: 0 },
  { code: 'DL 044', airline: 'DELTA', route: 'ATL — CDG', gate: 'B19', sched: '19:55', est: '21:40', status: 'DELAYED', premium: '0.06', payout: '0.48', delayMin: 105 },
  { code: 'NH 211', airline: 'ANA', route: 'HND — FRA', gate: 'C08', sched: '21:30', est: '21:30', status: 'BOARDING', premium: '0.07', payout: '0.52', delayMin: 0 },
  { code: 'AC 858', airline: 'AIR CANADA', route: 'YYZ — LHR', gate: 'D17', sched: '22:15', est: '—', status: 'CANCELLED', premium: '0.05', payout: '0.45', delayMin: 999 },
]

const STATUS_STYLE: Record<FlightStatus, string> = {
  'ON TIME': 'text-emerald-300',
  DELAYED: 'text-amber-300',
  BOARDING: 'text-sky-200',
  'PAID OUT': 'text-cyan-300',
  CANCELLED: 'text-rose-300',
}

// A single split-flap character cell that flips when its value changes.
function FlapCell({ char }: { char: string }) {
  return (
    <span className="relative inline-flex h-8 min-w-[0.72em] items-center justify-center overflow-hidden rounded-[3px] bg-[#06223f] px-[1px] text-[#e9f3ff] shadow-inner">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={char}
          initial={{ rotateX: -90, opacity: 0 }}
          animate={{ rotateX: 0, opacity: 1 }}
          exit={{ rotateX: 90, opacity: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="block leading-none"
          style={{ transformOrigin: 'center' }}
        >
          {char === ' ' ? '\u00A0' : char}
        </motion.span>
      </AnimatePresence>
      <span className="pointer-events-none absolute left-0 right-0 top-1/2 h-px bg-black/40" />
    </span>
  )
}

function FlapText({ text, className = '' }: { text: string; className?: string }) {
  return (
    <span className={`inline-flex gap-[2px] font-mono tracking-tight ${className}`}>
      {text.split('').map((c, i) => (
        <FlapCell key={i} char={c} />
      ))}
    </span>
  )
}

function useClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

export default function App() {
  const now = useClock()
  const [board, setBoard] = useState<Flight[]>(INITIAL_BOARD)
  const [selected, setSelected] = useState<Flight | null>(null)
  const [filter, setFilter] = useState<'ALL' | 'DELAYED'>('ALL')

  // Policy form
  const [flightNo, setFlightNo] = useState('')
  const [date, setDate] = useState('')
  const [threshold, setThreshold] = useState(120)
  const [premium, setPremium] = useState(0.05)

  const clock = now.toLocaleTimeString('en-GB', { hour12: false })
  const dateStr = now.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' }).toUpperCase()

  const visible = useMemo(
    () => (filter === 'ALL' ? board : board.filter((f) => f.status === 'DELAYED')),
    [board, filter],
  )

  const stats = useMemo(() => {
    const delayed = board.filter((f) => f.status === 'DELAYED').length
    const paid = board.filter((f) => f.status === 'PAID OUT').length
    const totalPayout = board
      .filter((f) => f.status === 'PAID OUT')
      .reduce((s, f) => s + parseFloat(f.payout), 0)
    return { delayed, paid, totalPayout }
  }, [board])

  function buyPolicy() {
    if (!flightNo.trim()) {
      toast.error('Enter a flight number to insure.')
      return
    }
    const payout = (premium * 8).toFixed(2)
    const newFlight: Flight = {
      code: flightNo.toUpperCase(),
      airline: 'YOUR POLICY',
      route: '— — —',
      gate: '--',
      sched: '--:--',
      est: '--:--',
      status: 'ON TIME',
      premium: premium.toFixed(2),
      payout,
      delayMin: 0,
    }
    setBoard((b) => [newFlight, ...b])
    toast.success(`Policy minted · ${flightNo.toUpperCase()} · payout ${payout} ETH if delayed > ${threshold}m`)
    setFlightNo('')
  }

  function onRowClick(f: Flight) {
    setSelected(f)
    if (f.status === 'DELAYED') {
      toast(`${f.code} delayed ${f.delayMin}m — claim ${f.payout} ETH ready`, { icon: '🛬' })
    }
  }

  function claim(f: Flight) {
    setBoard((b) => b.map((x) => (x.code === f.code ? { ...x, status: 'PAID OUT' } : x)))
    setSelected((s) => (s ? { ...s, status: 'PAID OUT' } : s))
    toast.success(`${f.payout} ETH settled to wallet — claim closed`)
  }

  return (
    <div className="min-h-screen bg-[#F4F8FB] font-mono text-[#0A4D8C]">
      <Toaster position="top-center" richColors theme="dark" />

      {/* Terminal header bar */}
      <header className="sticky top-0 z-20 border-b-4 border-[#0A4D8C] bg-[#0A4D8C] text-white">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3 px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded bg-[#F4F8FB] text-lg text-[#0A4D8C]">✈</div>
            <div className="leading-tight">
              <div className="text-lg font-bold tracking-[0.25em]">FLIGHTSHIELD</div>
              <div className="text-[10px] tracking-[0.35em] text-sky-200">DEPARTURES · PARAMETRIC COVER</div>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded bg-[#06223f] px-3 py-1.5">
            <span className="text-[10px] tracking-[0.3em] text-sky-300">{dateStr}</span>
            <span className="text-2xl font-bold tabular-nums tracking-widest text-emerald-300">{clock}</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] tracking-wider">
            <span className="text-amber-300">⬤ {stats.delayed} DELAYED</span>
            <span className="text-cyan-300">⬤ {stats.paid} PAID</span>
            <span className="hidden text-sky-200 sm:inline">CONTRACT {CONTRACT.slice(0, 6)}…{CONTRACT.slice(-4)}</span>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1500px] gap-5 px-4 py-5 lg:grid-cols-[1fr_320px]">
        {/* THE BOARD */}
        <section className="overflow-hidden rounded-xl border-2 border-[#0A4D8C] bg-[#0a2c4d] shadow-2xl">
          <div className="flex items-center justify-between border-b border-[#0A4D8C]/60 bg-[#06223f] px-4 py-2.5">
            <h2 className="text-sm font-bold tracking-[0.35em] text-amber-300">◗ DEPARTURES</h2>
            <div className="flex gap-1 text-[11px]">
              {(['ALL', 'DELAYED'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded px-2.5 py-1 tracking-widest transition ${
                    filter === f ? 'bg-amber-300 text-[#06223f]' : 'bg-[#0a2c4d] text-sky-200 hover:bg-[#0A4D8C]'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-[1.1fr_1.4fr_0.7fr_0.7fr_1fr_0.9fr] gap-2 border-b border-amber-300/30 px-4 py-2 text-[10px] tracking-[0.25em] text-amber-200/80">
            <span>FLIGHT</span>
            <span>ROUTE</span>
            <span>GATE</span>
            <span>SCHED</span>
            <span>STATUS</span>
            <span className="text-right">PAYOUT</span>
          </div>

          <div className="divide-y divide-white/5">
            {visible.map((f, i) => (
              <motion.button
                key={f.code + i}
                onClick={() => onRowClick(f)}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`grid w-full grid-cols-[1.1fr_1.4fr_0.7fr_0.7fr_1fr_0.9fr] items-center gap-2 px-4 py-2 text-left transition hover:bg-white/5 ${
                  selected?.code === f.code ? 'bg-amber-300/10 ring-1 ring-inset ring-amber-300/40' : ''
                }`}
              >
                <FlapText text={f.code} className="text-sm" />
                <span className="truncate text-sm tracking-widest text-sky-100">{f.route}</span>
                <FlapText text={f.gate} className="text-xs" />
                <FlapText text={f.est === '—' ? f.sched : f.est} className="text-xs" />
                <span className={`text-xs font-bold tracking-widest ${STATUS_STYLE[f.status]}`}>
                  {f.status === 'DELAYED' && <span className="mr-1 animate-pulse">●</span>}
                  {f.status}
                </span>
                <span className="text-right text-sm font-bold tabular-nums text-amber-300">
                  {f.payout === '—' ? '—' : `${f.payout} Ξ`}
                </span>
              </motion.button>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-amber-300/20 bg-[#06223f] px-4 py-2 text-[10px] tracking-[0.25em] text-sky-300">
            <span>LIVE ORACLE FEED · {visible.length} FLIGHTS</span>
            <span className="text-cyan-300">TOTAL SETTLED {stats.totalPayout.toFixed(2)} Ξ</span>
          </div>
        </section>

        {/* SIDE PANEL */}
        <aside className="flex flex-col gap-5">
          {/* Buy policy */}
          <div className="rounded-xl border-2 border-[#0A4D8C] bg-white p-4 shadow-lg">
            <h3 className="mb-3 border-b-2 border-dashed border-[#0A4D8C]/30 pb-2 text-xs font-bold tracking-[0.3em] text-[#0A4D8C]">
              ✓ INSURE A FLIGHT
            </h3>
            <label className="mb-1 block text-[10px] tracking-widest text-[#0A4D8C]/70">FLIGHT NUMBER</label>
            <input
              value={flightNo}
              onChange={(e) => setFlightNo(e.target.value)}
              placeholder="e.g. BA 248"
              className="mb-3 w-full rounded border-2 border-[#0A4D8C]/30 bg-[#F4F8FB] px-3 py-2 text-sm uppercase tracking-widest outline-none focus:border-[#0A4D8C]"
            />
            <label className="mb-1 block text-[10px] tracking-widest text-[#0A4D8C]/70">DEPARTURE DATE</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mb-3 w-full rounded border-2 border-[#0A4D8C]/30 bg-[#F4F8FB] px-3 py-2 text-sm outline-none focus:border-[#0A4D8C]"
            />
            <label className="mb-1 block text-[10px] tracking-widest text-[#0A4D8C]/70">
              DELAY THRESHOLD · <span className="font-bold text-[#0A4D8C]">{threshold} MIN</span>
            </label>
            <input
              type="range"
              min={30}
              max={300}
              step={15}
              value={threshold}
              onChange={(e) => setThreshold(+e.target.value)}
              className="mb-3 w-full accent-[#0A4D8C]"
            />
            <label className="mb-1 block text-[10px] tracking-widest text-[#0A4D8C]/70">
              PREMIUM · <span className="font-bold text-[#0A4D8C]">{premium.toFixed(2)} Ξ</span>
            </label>
            <input
              type="range"
              min={0.01}
              max={0.2}
              step={0.01}
              value={premium}
              onChange={(e) => setPremium(+e.target.value)}
              className="mb-3 w-full accent-[#0A4D8C]"
            />
            <div className="mb-3 flex items-center justify-between rounded bg-[#0A4D8C] px-3 py-2 text-white">
              <span className="text-[10px] tracking-widest">EST. PAYOUT</span>
              <span className="text-lg font-bold tabular-nums text-amber-300">{(premium * 8).toFixed(2)} Ξ</span>
            </div>
            <button
              onClick={buyPolicy}
              className="w-full rounded bg-amber-400 py-2.5 text-sm font-bold tracking-[0.2em] text-[#06223f] transition hover:bg-amber-300"
            >
              MINT POLICY →
            </button>
          </div>

          {/* Selected flight / claim ticket */}
          <div className="rounded-xl border-2 border-[#0A4D8C] bg-[#0a2c4d] p-4 text-white shadow-lg">
            <h3 className="mb-3 text-xs font-bold tracking-[0.3em] text-amber-300">🎫 CLAIM TICKET</h3>
            <AnimatePresence mode="wait">
              {selected ? (
                <motion.div
                  key={selected.code}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-2 text-sm"
                >
                  <div className="flex items-baseline justify-between">
                    <FlapText text={selected.code} className="text-base" />
                    <span className={`text-xs font-bold ${STATUS_STYLE[selected.status]}`}>{selected.status}</span>
                  </div>
                  <div className="text-xs tracking-widest text-sky-200">{selected.airline}</div>
                  <div className="border-t border-dashed border-white/20 pt-2 text-xs tracking-widest text-sky-100">
                    {selected.route} · GATE {selected.gate}
                  </div>
                  <div className="flex justify-between text-xs text-sky-200">
                    <span>SCHED {selected.sched}</span>
                    <span>EST {selected.est}</span>
                  </div>
                  {selected.delayMin > 0 && selected.delayMin < 999 && (
                    <div className="text-xs text-amber-300">DELAY · {selected.delayMin} MIN</div>
                  )}
                  <div className="mt-2 flex items-center justify-between rounded bg-[#06223f] px-3 py-2">
                    <span className="text-[10px] tracking-widest text-sky-300">PAYOUT</span>
                    <span className="text-xl font-bold tabular-nums text-amber-300">{selected.payout} Ξ</span>
                  </div>
                  {selected.status === 'DELAYED' ? (
                    <button
                      onClick={() => claim(selected)}
                      className="w-full rounded bg-emerald-400 py-2 text-sm font-bold tracking-[0.2em] text-[#06223f] transition hover:bg-emerald-300"
                    >
                      CLAIM {selected.payout} Ξ
                    </button>
                  ) : selected.status === 'PAID OUT' ? (
                    <div className="rounded border border-cyan-400/40 py-2 text-center text-xs tracking-widest text-cyan-300">
                      ✓ SETTLED ON-CHAIN
                    </div>
                  ) : (
                    <div className="rounded border border-white/15 py-2 text-center text-xs tracking-widest text-sky-300">
                      MONITORING · NO DELAY YET
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.p
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="py-6 text-center text-xs tracking-widest text-sky-400"
                >
                  ◗ SELECT A ROW ON THE BOARD
                  <br />
                  <span className="text-sky-500">DELAYED FLIGHTS ARE CLAIMABLE</span>
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </aside>
      </main>

      <footer className="border-t-2 border-[#0A4D8C]/20 bg-[#0A4D8C] py-3 text-center text-[10px] tracking-[0.3em] text-sky-200">
        FLIGHTSHIELD · ORACLE-VERIFIED PARAMETRIC PAYOUTS · {CONTRACT}
      </footer>
    </div>
  )
}
