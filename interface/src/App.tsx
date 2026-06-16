import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Toaster, toast } from 'sonner'
import { read, write, CONTRACT, connectWallet, isWalletConnected } from './genlayer'

type FlightStatus = 'ON TIME' | 'DELAYED' | 'BOARDING' | 'PAID OUT' | 'CANCELLED'

type Flight = {
  key: string
  code: string
  route: string
  status: FlightStatus
  delayMin: number
  threshold: number
  eligible: boolean
  delayFound: boolean
  reasoning: string
  rawStatus: string
}

const STATUS_STYLE: Record<FlightStatus, string> = {
  'ON TIME': 'text-emerald-300',
  DELAYED: 'text-amber-300',
  BOARDING: 'text-sky-200',
  'PAID OUT': 'text-cyan-300',
  CANCELLED: 'text-rose-300',
}

// Map the on-chain policy status into a board status badge.
function mapStatus(raw: string, delayFound: boolean): FlightStatus {
  const s = (raw || '').toLowerCase()
  if (s.includes('paid') || s.includes('claim')) return 'PAID OUT'
  if (s.includes('deni') || s.includes('reject')) return 'CANCELLED'
  if (delayFound) return 'DELAYED'
  return 'ON TIME'
}

function policyToFlight(i: number, p: any): Flight {
  const delayMin = Number(p?.delay_found ?? 0)
  const rawStatus = String(p?.status ?? 'active')
  const eligible = Boolean(p?.eligible)
  const delayFound = rawStatus !== 'active' && delayMin > 0
  return {
    key: String(i),
    code: String(p?.flight ?? `POLICY ${i}`),
    route: String(p?.date ?? '— — —'),
    status: mapStatus(rawStatus, delayMin > 0),
    delayMin,
    threshold: Number(p?.threshold_min ?? 0),
    eligible,
    delayFound,
    reasoning: String(p?.reasoning ?? ''),
    rawStatus,
  }
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
  const [board, setBoard] = useState<Flight[]>([])
  const [selected, setSelected] = useState<Flight | null>(null)
  const [filter, setFilter] = useState<'ALL' | 'DELAYED'>('ALL')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [claimingKey, setClaimingKey] = useState<string | null>(null)
  const [chainStats, setChainStats] = useState({ policies: 0, paid: 0, denied: 0 })
  const [wallet, setWallet] = useState<string | null>(null)

  const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

  async function handleConnect() {
    try {
      const addr = await connectWallet()
      setWallet(addr)
      toast.success(`Wallet connected · ${shortAddr(addr)}`)
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to connect wallet')
    }
  }

  // Policy form
  const [flightNo, setFlightNo] = useState('')
  const [date, setDate] = useState('')
  const [threshold, setThreshold] = useState(120)

  const clock = now.toLocaleTimeString('en-GB', { hour12: false })
  const dateStr = now.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' }).toUpperCase()

  const visible = useMemo(
    () => (filter === 'ALL' ? board : board.filter((f) => f.status === 'DELAYED')),
    [board, filter],
  )

  async function loadPolicies() {
    setLoading(true)
    try {
      const stats = (await read('stats')) as any
      const policies = Number(stats?.policies ?? 0)
      setChainStats({
        policies,
        paid: Number(stats?.paid ?? 0),
        denied: Number(stats?.denied ?? 0),
      })
      const loaded: Flight[] = []
      for (let i = 0; i < policies; i++) {
        try {
          const p = (await read('get_policy', [String(i)])) as any
          if (p) loaded.push(policyToFlight(i, p))
        } catch {
          // skip unreadable policy
        }
      }
      setBoard(loaded.reverse())
    } catch (e: any) {
      toast.error(`Failed to load policies: ${e?.message ?? e}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPolicies()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function buyPolicy() {
    if (!flightNo.trim()) {
      toast.error('Enter a flight number to insure.')
      return
    }
    if (!date) {
      toast.error('Pick a departure date.')
      return
    }
    setBusy(true)
    const tid = toast.loading('Minting policy on-chain… (30–60s)')
    try {
      await write('buy_policy', [flightNo.toUpperCase(), date, threshold])
      const stats = (await read('stats')) as any
      const policies = Number(stats?.policies ?? 0)
      toast.success(`Policy minted · ${flightNo.toUpperCase()} · ${policies} active policies`, { id: tid })
      setFlightNo('')
      await loadPolicies()
    } catch (e: any) {
      toast.error(`Mint failed: ${e?.message ?? e}`, { id: tid })
    } finally {
      setBusy(false)
    }
  }

  function onRowClick(f: Flight) {
    setSelected(f)
  }

  async function claim(f: Flight) {
    setClaimingKey(f.key)
    const tid = toast.loading(`Filing claim for ${f.code}… (30–60s)`)
    try {
      await write('file_claim', [f.key])
      const p = (await read('get_policy', [f.key])) as any
      const updated = policyToFlight(Number(f.key), p)
      setBoard((b) => b.map((x) => (x.key === f.key ? updated : x)))
      setSelected((s) => (s && s.key === f.key ? updated : s))
      const stats = (await read('stats')) as any
      setChainStats({
        policies: Number(stats?.policies ?? 0),
        paid: Number(stats?.paid ?? 0),
        denied: Number(stats?.denied ?? 0),
      })
      if (updated.status === 'PAID OUT') {
        toast.success(`Claim approved — delay confirmed, payout settled`, { id: tid })
      } else if (updated.status === 'CANCELLED') {
        toast.error(`Claim denied — ${updated.reasoning || 'no qualifying delay found'}`, { id: tid })
      } else {
        toast(`Claim filed — status: ${updated.rawStatus}`, { id: tid })
      }
    } catch (e: any) {
      toast.error(`Claim failed: ${e?.message ?? e}`, { id: tid })
    } finally {
      setClaimingKey(null)
    }
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
            <span className="text-sky-200">⬤ {chainStats.policies} POLICIES</span>
            <span className="text-cyan-300">⬤ {chainStats.paid} PAID</span>
            <span className="text-rose-300">⬤ {chainStats.denied} DENIED</span>
            <span className="hidden text-sky-200 sm:inline">CONTRACT {CONTRACT.slice(0, 6)}…{CONTRACT.slice(-4)}</span>
            <button
              onClick={handleConnect}
              className="rounded bg-amber-400 px-3 py-1.5 text-[11px] font-bold tracking-[0.2em] text-[#06223f] transition hover:bg-amber-300"
            >
              {wallet ? shortAddr(wallet) : isWalletConnected() ? 'CONNECTED' : 'CONNECT WALLET'}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1500px] gap-5 px-4 py-5 lg:grid-cols-[1fr_320px]">
        {/* THE BOARD */}
        <section className="overflow-hidden rounded-xl border-2 border-[#0A4D8C] bg-[#0a2c4d] shadow-2xl">
          <div className="flex items-center justify-between border-b border-[#0A4D8C]/60 bg-[#06223f] px-4 py-2.5">
            <h2 className="text-sm font-bold tracking-[0.35em] text-amber-300">◗ POLICIES</h2>
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
            <span>DATE</span>
            <span>THRESH</span>
            <span>DELAY</span>
            <span>STATUS</span>
            <span className="text-right">CLAIM</span>
          </div>

          <div className="divide-y divide-white/5">
            {visible.map((f, i) => (
              <motion.button
                key={f.key}
                onClick={() => onRowClick(f)}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`grid w-full grid-cols-[1.1fr_1.4fr_0.7fr_0.7fr_1fr_0.9fr] items-center gap-2 px-4 py-2 text-left transition hover:bg-white/5 ${
                  selected?.key === f.key ? 'bg-amber-300/10 ring-1 ring-inset ring-amber-300/40' : ''
                }`}
              >
                <FlapText text={f.code} className="text-sm" />
                <span className="truncate text-sm tracking-widest text-sky-100">{f.route}</span>
                <FlapText text={`${f.threshold}m`} className="text-xs" />
                <FlapText text={f.delayMin > 0 ? `${f.delayMin}m` : '—'} className="text-xs" />
                <span className={`text-xs font-bold tracking-widest ${STATUS_STYLE[f.status]}`}>
                  {f.status === 'DELAYED' && <span className="mr-1 animate-pulse">●</span>}
                  {f.status}
                </span>
                <span className="text-right text-sm font-bold tabular-nums text-amber-300">
                  {f.status === 'ON TIME' || f.status === 'DELAYED' ? 'FILE' : '✓'}
                </span>
              </motion.button>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-amber-300/20 bg-[#06223f] px-4 py-2 text-[10px] tracking-[0.25em] text-sky-300">
            <span>{loading ? 'LOADING ORACLE FEED…' : `LIVE ORACLE FEED · ${visible.length} POLICIES`}</span>
            <span className="text-cyan-300">{chainStats.paid} SETTLED · {chainStats.denied} DENIED</span>
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
              className="mb-4 w-full accent-[#0A4D8C]"
            />
            <div className="mb-3 rounded bg-[#0A4D8C]/5 px-3 py-2 text-[10px] leading-relaxed tracking-wider text-[#0A4D8C]/70">
              A claim pays out when validators confirm an actual departure delay at or above your threshold.
            </div>
            <button
              onClick={buyPolicy}
              disabled={busy}
              className="w-full rounded bg-amber-400 py-2.5 text-sm font-bold tracking-[0.2em] text-[#06223f] transition hover:bg-amber-300 disabled:opacity-50"
            >
              {busy ? 'MINTING…' : 'MINT POLICY →'}
            </button>
          </div>

          {/* Selected flight / claim ticket */}
          <div className="rounded-xl border-2 border-[#0A4D8C] bg-[#0a2c4d] p-4 text-white shadow-lg">
            <h3 className="mb-3 text-xs font-bold tracking-[0.3em] text-amber-300">🎫 CLAIM TICKET</h3>
            <AnimatePresence mode="wait">
              {selected ? (
                <motion.div
                  key={selected.key}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-2 text-sm"
                >
                  <div className="flex items-baseline justify-between">
                    <FlapText text={selected.code} className="text-base" />
                    <span className={`text-xs font-bold ${STATUS_STYLE[selected.status]}`}>{selected.status}</span>
                  </div>
                  <div className="text-xs tracking-widest text-sky-200">POLICY #{selected.key}</div>
                  <div className="border-t border-dashed border-white/20 pt-2 text-xs tracking-widest text-sky-100">
                    DEP {selected.route} · THRESHOLD {selected.threshold}m
                  </div>
                  <div className="flex justify-between text-xs text-sky-200">
                    <span>DELAY FOUND</span>
                    <span className={selected.delayFound ? 'text-amber-300' : 'text-sky-400'}>
                      {selected.rawStatus === 'active' ? 'NOT YET' : `${selected.delayMin}m`}
                    </span>
                  </div>
                  {selected.reasoning && (
                    <div className="rounded bg-[#06223f] px-3 py-2 text-[11px] leading-relaxed tracking-normal text-sky-200">
                      {selected.reasoning}
                    </div>
                  )}
                  {selected.status === 'ON TIME' || selected.status === 'DELAYED' ? (
                    <button
                      onClick={() => claim(selected)}
                      disabled={claimingKey === selected.key}
                      className="w-full rounded bg-emerald-400 py-2 text-sm font-bold tracking-[0.2em] text-[#06223f] transition hover:bg-emerald-300 disabled:opacity-50"
                    >
                      {claimingKey === selected.key ? 'FILING…' : 'FILE CLAIM'}
                    </button>
                  ) : selected.status === 'PAID OUT' ? (
                    <div className="rounded border border-cyan-400/40 py-2 text-center text-xs tracking-widest text-cyan-300">
                      ✓ SETTLED ON-CHAIN
                    </div>
                  ) : (
                    <div className="rounded border border-rose-400/40 py-2 text-center text-xs tracking-widest text-rose-300">
                      ✕ CLAIM DENIED
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
                  ◗ SELECT A POLICY ROW
                  <br />
                  <span className="text-sky-500">FILE A CLAIM TO TRIGGER ORACLE</span>
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
