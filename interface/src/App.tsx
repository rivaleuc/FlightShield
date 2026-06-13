import { useState } from 'react'
import { motion } from 'framer-motion'
import { Toaster, toast } from 'sonner'

const CONTRACT = '0x75787a83F7742b109e5BF723cA9d369CB1DA411B'

type FlightStatus = 'ON TIME' | 'DELAYED' | 'PAID OUT' | 'BOARDING'
type Flight = {
  code: string
  route: string
  sched: string
  est: string
  status: FlightStatus
  payout: string
}

const BOARD: Flight[] = [
  { code: 'BA 247', route: 'LHR → JFK', sched: '08:40', est: '08:40', status: 'ON TIME', payout: '—' },
  { code: 'LH 401', route: 'FRA → IAD', sched: '10:15', est: '12:55', status: 'DELAYED', payout: '0.42 ETH' },
  { code: 'AF 118', route: 'CDG → SFO', sched: '11:05', est: '11:05', status: 'BOARDING', payout: '—' },
  { code: 'EK 203', route: 'DXB → JFK', sched: '13:30', est: '17:10', status: 'PAID OUT', payout: '0.88 ETH' },
  { code: 'SQ 322', route: 'SIN → LHR', sched: '14:20', est: '14:20', status: 'ON TIME', payout: '—' },
  { code: 'UA 930', route: 'SFO → LHR', sched: '16:45', est: '19:20', status: 'DELAYED', payout: '0.55 ETH' },
]

const STEPS = [
  {
    n: '01',
    title: 'Pick Your Flight',
    body: 'Enter any flight number. We pull the scheduled departure from on-chain oracle feeds.',
  },
  {
    n: '02',
    title: 'Set Your Cover',
    body: 'Choose a delay threshold and premium. The smart contract quotes an instant payout.',
  },
  {
    n: '03',
    title: 'Oracle Watches',
    body: 'Trusted flight-data oracles monitor your departure in real time — no claims to file.',
  },
  {
    n: '04',
    title: 'Auto Payout',
    body: 'If your flight is delayed past the threshold, the contract pays your wallet automatically.',
  },
]

const FEATURES = [
  { icon: '⚡', title: 'Instant Settlement', body: 'No paperwork, no adjusters. Payouts execute the moment the delay is confirmed.' },
  { icon: '🛰️', title: 'Oracle-Verified Data', body: 'Departure and arrival times sourced from decentralized aviation oracles.' },
  { icon: '🔒', title: 'Funds in Escrow', body: 'Premiums and payouts are locked in audited smart contracts — fully transparent.' },
  { icon: '🌍', title: 'Global Coverage', body: 'Insure any commercial flight across 4,000+ airports worldwide.' },
  { icon: '📜', title: 'Parametric Policies', body: 'Objective triggers mean no disputes. Delay = payout. Simple.' },
  { icon: '💸', title: 'Fair Pricing', body: 'Premiums priced by live delay-risk models, not opaque underwriting.' },
]

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  show: { opacity: 1, y: 0 },
}

const statusStyles: Record<FlightStatus, string> = {
  'ON TIME': 'text-emerald-600',
  DELAYED: 'text-amber-600',
  'PAID OUT': 'text-[#0A4D8C]',
  BOARDING: 'text-sky-600',
}

function App() {
  const [flight, setFlight] = useState('')
  const [threshold, setThreshold] = useState('120')
  const [premium, setPremium] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!flight || !premium) {
      toast.error('Enter a flight number and a premium to get a quote.')
      return
    }
    setLoading(true)
    toast.loading('Querying oracle for flight status…', { id: 'policy' })
    setTimeout(() => {
      setLoading(false)
      const delayed = Math.random() > 0.5
      if (delayed) {
        const payout = (parseFloat(premium) * 8).toFixed(3)
        toast.success(
          `${flight.toUpperCase()} delayed past ${threshold} min — payout of ${payout} ETH triggered ✈️`,
          { id: 'policy' },
        )
      } else {
        toast.info(`${flight.toUpperCase()} is on time. Policy active — you're covered.`, {
          id: 'policy',
        })
      }
    }, 3000)
  }

  return (
    <div className="min-h-screen bg-[#F4F8FB] text-slate-800 font-sans antialiased selection:bg-[#0A4D8C] selection:text-white">
      <Toaster position="top-right" richColors />

      {/* Navbar */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-[#F4F8FB]/85 border-b border-slate-200">
        <nav className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
          <a href="#" className="flex items-center gap-2 font-extrabold text-xl tracking-tight text-[#0A4D8C]">
            <span className="grid place-items-center h-9 w-9 rounded-xl bg-[#0A4D8C] text-white text-lg">
              ✈
            </span>
            <span>FlightShield</span>
          </a>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-500">
            <a href="#board" className="hover:text-[#0A4D8C] transition">Live Board</a>
            <a href="#how" className="hover:text-[#0A4D8C] transition">How it Works</a>
            <a href="#features" className="hover:text-[#0A4D8C] transition">Coverage</a>
            <a href="#quote" className="hover:text-[#0A4D8C] transition">Get a Quote</a>
          </div>
          <a
            href="#quote"
            className="rounded-full bg-[#0A4D8C] px-5 py-2 text-sm font-semibold text-white hover:bg-[#083d70] transition"
          >
            Insure a Flight
          </a>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute -top-40 right-0 h-[460px] w-[760px] rounded-full blur-3xl"
          style={{ background: 'radial-gradient(closest-side, rgba(10,77,140,0.12), transparent)' }}
        />
        <div className="mx-auto max-w-7xl px-6 py-24 md:py-32 grid lg:grid-cols-2 gap-12 items-center relative">
          <div>
            <motion.div
              initial="hidden"
              animate="show"
              variants={fadeUp}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 rounded-full border border-[#0A4D8C]/20 bg-white px-4 py-1.5 text-xs font-semibold text-[#0A4D8C] uppercase tracking-widest shadow-sm"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Parametric · On-chain · Claimless
            </motion.div>

            <motion.h1
              initial="hidden"
              animate="show"
              variants={fadeUp}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mt-6 text-5xl md:text-6xl font-extrabold leading-[1.02] tracking-tight text-slate-900"
            >
              Flight delayed?
              <br />
              <span className="text-[#0A4D8C]">You're paid before you land.</span>
            </motion.h1>

            <motion.p
              initial="hidden"
              animate="show"
              variants={fadeUp}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mt-6 max-w-xl text-lg text-slate-600"
            >
              FlightShield is parametric flight-delay insurance built on smart contracts.
              No claims, no call centers — just automatic payouts triggered by oracle-verified delays.
            </motion.p>

            <motion.div
              initial="hidden"
              animate="show"
              variants={fadeUp}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-9 flex flex-col sm:flex-row gap-4"
            >
              <a
                href="#quote"
                className="rounded-full bg-[#0A4D8C] px-8 py-4 font-semibold text-white text-center hover:bg-[#083d70] transition"
              >
                Get a Quote
              </a>
              <a
                href="#board"
                className="rounded-full border border-slate-300 bg-white px-8 py-4 font-semibold text-slate-700 text-center hover:border-[#0A4D8C] hover:text-[#0A4D8C] transition"
              >
                View Live Board
              </a>
            </motion.div>

            <motion.div
              initial="hidden"
              animate="show"
              variants={fadeUp}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="mt-12 grid grid-cols-3 gap-6 max-w-md"
            >
              {[
                ['4,000+', 'Airports'],
                ['90s', 'Avg. payout'],
                ['$2.1M', 'Paid out'],
              ].map(([stat, label]) => (
                <div key={label}>
                  <div className="text-2xl md:text-3xl font-extrabold text-[#0A4D8C]">{stat}</div>
                  <div className="mt-1 text-xs uppercase tracking-widest text-slate-400">{label}</div>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Hero board preview */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="rounded-2xl bg-slate-900 p-5 shadow-2xl shadow-slate-300/60 ring-1 ring-slate-800"
          >
            <div className="flex items-center justify-between text-amber-300 font-mono text-xs uppercase tracking-widest mb-4">
              <span>Departures</span>
              <span className="text-emerald-400">● Live</span>
            </div>
            <div className="space-y-2 font-mono text-sm">
              {BOARD.slice(0, 4).map((f) => (
                <div
                  key={f.code}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg bg-slate-800/60 px-3 py-2"
                >
                  <div className="flex items-center gap-3 text-amber-200">
                    <span className="font-bold">{f.code}</span>
                    <span className="text-slate-400">{f.route}</span>
                  </div>
                  <span
                    className={`text-xs font-bold ${
                      f.status === 'DELAYED' || f.status === 'PAID OUT'
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {f.status}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Live Flight Board */}
      <section id="board" className="mx-auto max-w-7xl px-6 py-20">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          variants={fadeUp}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900">Live Flight Board</h2>
          <p className="mt-2 text-slate-500">Oracle-tracked departures and active FlightShield policies.</p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
          variants={fadeUp}
          transition={{ duration: 0.5 }}
          className="overflow-hidden rounded-2xl bg-slate-900 shadow-xl ring-1 ring-slate-800"
        >
          <div className="grid grid-cols-[1.1fr_1.4fr_0.8fr_0.8fr_1fr_1fr] gap-2 px-5 py-3 font-mono text-[11px] uppercase tracking-widest text-slate-400 border-b border-slate-700">
            <span>Flight</span>
            <span>Route</span>
            <span>Sched</span>
            <span>Est</span>
            <span>Status</span>
            <span className="text-right">Payout</span>
          </div>
          <div className="divide-y divide-slate-800">
            {BOARD.map((f, i) => (
              <motion.div
                key={f.code}
                initial={{ opacity: 0, x: -12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: i * 0.05 }}
                className="grid grid-cols-[1.1fr_1.4fr_0.8fr_0.8fr_1fr_1fr] gap-2 px-5 py-4 font-mono text-sm text-amber-100 hover:bg-slate-800/50 transition"
              >
                <span className="font-bold text-amber-300">{f.code}</span>
                <span className="text-slate-300">{f.route}</span>
                <span>{f.sched}</span>
                <span className={f.est !== f.sched ? 'text-amber-400' : ''}>{f.est}</span>
                <span className={`font-bold ${statusStyles[f.status]} brightness-150`}>{f.status}</span>
                <span className="text-right text-emerald-400 font-bold">{f.payout}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* How it Works */}
      <section id="how" className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <motion.h2
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={fadeUp}
            transition={{ duration: 0.5 }}
            className="text-3xl md:text-4xl font-extrabold text-center text-slate-900"
          >
            How it <span className="text-[#0A4D8C]">Works</span>
          </motion.h2>

          <div className="mt-14 grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map((s, i) => (
              <motion.div
                key={s.n}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: '-60px' }}
                variants={fadeUp}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="rounded-2xl border border-slate-200 bg-[#F4F8FB] p-6"
              >
                <div className="font-mono text-4xl font-extrabold text-[#0A4D8C]/25">{s.n}</div>
                <h3 className="mt-3 text-lg font-bold text-slate-900">{s.title}</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{s.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-7xl px-6 py-20">
        <motion.h2
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          variants={fadeUp}
          transition={{ duration: 0.5 }}
          className="text-3xl md:text-4xl font-extrabold text-center text-slate-900"
        >
          Coverage you can <span className="text-[#0A4D8C]">trust.</span>
        </motion.h2>

        <div className="mt-14 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-60px' }}
              variants={fadeUp}
              transition={{ duration: 0.5, delay: i * 0.06 }}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition"
            >
              <div className="text-3xl">{f.icon}</div>
              <h3 className="mt-4 text-lg font-bold text-slate-900">{f.title}</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{f.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Quote Form */}
      <section id="quote" className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={fadeUp}
            transition={{ duration: 0.5 }}
            className="rounded-3xl border border-slate-200 bg-[#F4F8FB] p-8 md:p-10 shadow-sm"
          >
            <h2 className="text-3xl font-extrabold text-slate-900">Get an Instant Quote</h2>
            <p className="mt-2 text-slate-600">
              Enter your flight details. We&apos;ll simulate an oracle check and settlement in 3 seconds.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label className="block text-sm font-semibold mb-2 text-slate-700">Flight number</label>
                <input
                  value={flight}
                  onChange={(e) => setFlight(e.target.value)}
                  placeholder="e.g. BA 247"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-mono outline-none focus:border-[#0A4D8C] focus:ring-2 focus:ring-[#0A4D8C]/20 transition placeholder:text-slate-400"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2 text-slate-700">
                  Delay threshold (minutes)
                </label>
                <select
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-[#0A4D8C] focus:ring-2 focus:ring-[#0A4D8C]/20 transition"
                >
                  <option value="60">60 minutes</option>
                  <option value="120">120 minutes</option>
                  <option value="180">180 minutes</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2 text-slate-700">Premium (ETH)</label>
                <input
                  value={premium}
                  onChange={(e) => setPremium(e.target.value)}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.05"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-mono outline-none focus:border-[#0A4D8C] focus:ring-2 focus:ring-[#0A4D8C]/20 transition placeholder:text-slate-400"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[#0A4D8C] px-6 py-4 font-semibold text-white hover:bg-[#083d70] transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? 'Checking oracle…' : 'Get Quote & Bind Policy'}
              </button>
            </form>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-[#F4F8FB]">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2 font-extrabold text-lg text-[#0A4D8C]">
              <span className="grid place-items-center h-8 w-8 rounded-xl bg-[#0A4D8C] text-white">
                ✈
              </span>
              FlightShield
            </div>
            <div className="text-sm text-slate-500 text-center">
              Contract:{' '}
              <code className="font-mono text-[#0A4D8C] break-all">{CONTRACT}</code>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-slate-200 text-center text-xs text-slate-400">
            © {new Date().getFullYear()} FlightShield. Parametric cover is illustrative. Not financial advice.
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
